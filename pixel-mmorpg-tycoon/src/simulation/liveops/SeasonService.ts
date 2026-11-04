import type { EntityId } from '@/core/ids';
import { EventBus } from '@/core/EventBus';
import { getBehavior } from '@/data/playerTypes';
import type { SeasonRecord } from '@/models/sim';
import type { ActorManager } from '../actors/ActorManager';
import type { ClanService } from '../clans/ClanService';
import type { PlayerManager } from '../players/PlayerManager';
import { MINUTES_PER_DAY } from '../time';
import type { WorldRuntime } from '../WorldRuntime';

export type SeasonEvents = { ended: { record: SeasonRecord; next: number } };

/** Clan leagues by season points (English source labels). */
export const LEAGUES: { key: string; label: string; min: number; color: string }[] = [
  { key: 'legend', label: 'Legend', min: 2500, color: '#f2a03a' },
  { key: 'diamond', label: 'Diamond', min: 1200, color: '#7fd7ff' },
  { key: 'platinum', label: 'Platinum', min: 600, color: '#3ad6c5' },
  { key: 'gold', label: 'Gold', min: 250, color: '#f2c14e' },
  { key: 'silver', label: 'Silver', min: 80, color: '#c8c8c8' },
  { key: 'bronze', label: 'Bronze', min: 0, color: '#b0723a' },
];
export const leagueFor = (points: number) => LEAGUES.find((l) => points >= l.min) ?? LEAGUES[LEAGUES.length - 1];
export const SEASON_LENGTHS = [3, 7, 14];

/**
 * Competitive seasons: clans earn points from boss kills (world firsts count triple),
 * players from quests, level-ups, raids and PvP. At the end of a season the best get
 * fame and titles, everyone who took part is happy, and the ladder resets.
 */
export class SeasonService {
  readonly events = new EventBus<SeasonEvents>();
  private unsubs: (() => void)[] = [];

  constructor(private world: WorldRuntime, actors: ActorManager, private pm: PlayerManager, private clans: ClanService) {
    this.unsubs.push(
      clans.events.on('raidEnded', ({ record }) => {
        if (record.result !== 'win') return;
        const area = world.entities.get('spawnAreas', record.lairId);
        const lvl = (area && world.entities.get('creatureTemplates', area.templateId)?.level) ?? 1;
        if (record.clanId) this.addClan(record.clanId, lvl * 10 * (record.worldFirst ? 3 : 1));
      }),
      clans.events.on('raidMembers', ({ members, level }) => { for (const id of members) this.addPlayer(id, level * 2); }),
      pm.events.on('questDone', ({ player }) => this.addPlayer(player.id, 5)),
      pm.events.on('levelUp', ({ player, level }) => this.addPlayer(player.id, level)),
      actors.events.on('died', ({ victim, killer }) => {
        if (victim.kind !== 'player' || killer?.kind !== 'player') return;
        const s = this.state;
        s.pvp[killer.defId] = (s.pvp[killer.defId] ?? 0) + 1;
        this.addPlayer(killer.defId, 3);
      }),
    );
  }

  get state() {
    return this.world.sim.season;
  }

  endsAt(): number {
    return this.state.startedAt + this.state.lengthDays * MINUTES_PER_DAY;
  }

  private addClan(id: EntityId, n: number): void {
    this.state.clanPoints[id] = (this.state.clanPoints[id] ?? 0) + n;
  }

  private addPlayer(id: EntityId, n: number): void {
    this.state.playerPoints[id] = (this.state.playerPoints[id] ?? 0) + n;
  }

  clanStandings() {
    return this.clans.clans().map((c) => ({ clan: c, points: this.state.clanPoints[c.id] ?? 0 })).sort((a, b) => b.points - a.points);
  }

  playerStandings(limit = 10) {
    return Object.entries(this.state.playerPoints).map(([id, points]) => ({ player: this.pm.get(id), points })).filter((x) => x.player).sort((a, b) => b.points - a.points).slice(0, limit);
  }

  pvpStandings(limit = 10) {
    return Object.entries(this.state.pvp).map(([id, kills]) => ({ player: this.pm.get(id), kills })).filter((x) => x.player).sort((a, b) => b.kills - a.kills).slice(0, limit);
  }

  hourly(): void {
    const now = this.world.clock.totalMinutes;
    const left = this.endsAt() - now;
    // The final day: competitive players love the race to the top.
    if (left > 0 && left <= MINUTES_PER_DAY) {
      for (const p of this.pm.online()) {
        const w = getBehavior(p.behavior).weights;
        if (w.fight > 1 || w.pvp > 0.5 || p.clanId) this.pm.feel(p, 'season', 0.3);
      }
    }
    if (now >= this.endsAt()) this.endSeason();
  }

  /** Close the season: rewards, titles, history, reset. */
  endSeason(): SeasonRecord {
    const s = this.state;
    const clans = this.clanStandings().filter((x) => x.points > 0);
    const players = this.playerStandings(5);
    const pvp = this.pvpStandings(5);
    const record: SeasonRecord = {
      number: s.number,
      endedAt: this.world.clock.totalMinutes,
      topClans: clans.slice(0, 5).map((x) => ({ name: x.clan.name, tag: x.clan.tag, points: x.points })),
      topPlayers: players.map((x) => ({ name: x.player!.name, points: x.points })),
      topPvp: pvp.map((x) => ({ name: x.player!.name, kills: x.kills })),
    };
    // Rewards: clan fame by league, champion titles, everyone who competed is happy.
    clans.forEach((x, i) => { x.clan.fame += Math.round(x.points / 2) + (i === 0 ? 300 : 0); });
    players.slice(0, 3).forEach((x, i) => (x.player!.titles ??= []).push(`${['Champion', 'Runner-up', 'Third place'][i]} · S${s.number}`));
    if (pvp[0]) (pvp[0].player!.titles ??= []).push(`Warlord · S${s.number}`);
    for (const id of Object.keys(s.playerPoints)) { const p = this.pm.get(id); if (p) this.pm.feel(p, 'season', 2); }
    if (Object.keys(s.playerPoints).length) this.world.sim.popularity = Math.min(100, this.world.sim.popularity + 2);
    s.history.push(record);
    if (s.history.length > 20) s.history.shift();
    s.number++;
    s.startedAt = this.world.clock.totalMinutes;
    s.clanPoints = {};
    s.playerPoints = {};
    s.pvp = {};
    this.events.emit('ended', { record, next: s.number });
    return record;
  }

  dispose(): void {
    this.unsubs.forEach((u) => u());
  }
}
