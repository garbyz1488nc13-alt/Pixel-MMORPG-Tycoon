import { FACTORS } from '@/data/playerTypes';
import type { FactorKey, PlayerState } from '@/models/sim';
import type { WorldRuntime } from '@/simulation/WorldRuntime';

/** What the designer can do about each complaint (English source, translated in the UI). */
export const FACTOR_HINT: Partial<Record<FactorKey, string>> = {
  noContent: 'Add spawn areas with monsters around levels {range} — that is where most players are.',
  tooHard: 'Monsters near players are too strong. Add easier spawn areas or lower monster damage.',
  noQuests: 'Quest hunters ran out of quests. Add quests for levels {range}.',
  crowded: 'Hunting spots are crowded. Raise "Max alive" in spawn areas or add more areas.',
  expensive: 'Players cannot afford shop items. Lower the merchant markup or item values.',
  poor: 'Players struggle to earn gold. Raise the buyback rate, loot or quest rewards.',
  pvpKilled: 'PvP players gank others. Add Safe Zone regions around towns and roads.',
  boredom: 'Players have seen everything. Add new regions, dungeons and quests.',
  queue: 'The server is full. Upgrade the server tier in the Studio tab.',
  unpaid: 'The treasury could not pay quest rewards. Raise taxes or lower rewards.',
  death: 'Players die a lot. Check monster damage, add healers or cheaper potions.',
  cheaters: 'Cheaters are active. Check "Reports & suspects" in the Community tab and ban them, or turn on anti-cheat.',
  p2w: 'Players hate the pay-to-win cash shop. Switch the Studio cash shop to cosmetics or boosts.',
  drama: 'Clans fall apart after wipes and loot fights. Make bosses beatable for their level and raid size.',
  antiCheatPain: 'Players hate the kernel-level anti-cheat. Consider the Advanced level instead.',
};

export interface FactorSummary { key: FactorKey; total: number; players: number }

/** Sum factor contributions over players (online by default). */
export function summarizeFactors(players: PlayerState[]): { good: FactorSummary[]; bad: FactorSummary[] } {
  const acc = new Map<FactorKey, FactorSummary>();
  for (const p of players)
    for (const [k, v] of Object.entries(p.factors) as [FactorKey, number][]) {
      if (!v) continue;
      const s = acc.get(k) ?? { key: k, total: 0, players: 0 };
      s.total += v;
      s.players++;
      acc.set(k, s);
    }
  const all = [...acc.values()];
  return {
    good: all.filter((s) => FACTORS[s.key].positive).sort((a, b) => b.total - a.total),
    bad: all.filter((s) => !FACTORS[s.key].positive).sort((a, b) => a.total - b.total),
  };
}

/** Level range where most players are (e.g. "3–6"). */
export function crowdLevelRange(players: PlayerState[]): string {
  if (!players.length) return '1–3';
  const lv = players.map((p) => p.level).sort((a, b) => a - b);
  const lo = lv[Math.floor(lv.length * 0.2)];
  const hi = lv[Math.floor(lv.length * 0.8)];
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}

/** Players per level band vs monsters per level band (for the content gap chart). */
export function levelCoverage(world: WorldRuntime, players: PlayerState[]): { band: string; players: number; monsters: number }[] {
  const bands = [[1, 3], [4, 6], [7, 10], [11, 15], [16, 20], [21, 30], [31, 50], [51, 200]];
  return bands.map(([lo, hi]) => ({
    band: lo === 51 ? '51+' : `${lo}–${hi}`,
    players: players.filter((p) => p.level >= lo && p.level <= hi).length,
    monsters: world.entities.list('spawnAreas').reduce((n, a) => {
      const tpl = world.entities.get('creatureTemplates', a.templateId);
      return n + (tpl && tpl.level >= lo && tpl.level <= hi ? a.maxCount : 0);
    }, 0),
  })).filter((b, i) => i < 3 || b.players || b.monsters);
}
