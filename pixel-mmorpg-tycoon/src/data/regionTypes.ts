export type RegionType = 'town' | 'village' | 'city' | 'forest' | 'dungeon' | 'cave' | 'wilderness' | 'safezone' | 'pvpzone';

/**
 * PvP rules: 'none' — nobody may attack players; 'flagged' — only PvP-minded
 * players attack others; 'open' — everyone who enters fights everyone.
 */
export type PvpRule = 'none' | 'flagged' | 'open';

export interface RegionTypeDef {
  key: RegionType;
  name: string;
  color: number;
  safe: boolean;
  pvp: PvpRule;
  /** Has a "Populate" generator. */
  populate: boolean;
  /** What this region does (English source). */
  description: string;
}

export const REGION_TYPES: readonly RegionTypeDef[] = [
  { key: 'village', name: 'Village', color: 0xf2c14e, safe: true, pvp: 'none', populate: true, description: 'Safe settlement: no PvP. Players rest, trade and socialise here.' },
  { key: 'town', name: 'Town', color: 0xffa94d, safe: true, pvp: 'none', populate: true, description: 'Safe settlement with shops, a smithy and a tavern. No PvP.' },
  { key: 'city', name: 'City', color: 0xff7a59, safe: true, pvp: 'none', populate: true, description: 'Big safe settlement with every service. No PvP.' },
  { key: 'forest', name: 'Forest', color: 0x6cc551, safe: false, pvp: 'flagged', populate: true, description: 'Hunting ground with trees and wolves. PvP players may attack here.' },
  { key: 'dungeon', name: 'Dungeon', color: 0xb56cff, safe: false, pvp: 'flagged', populate: true, description: 'Walled crypt with skeletons and a boss lair. PvP players may attack here.' },
  { key: 'cave', name: 'Cave', color: 0x9aa3ad, safe: false, pvp: 'flagged', populate: true, description: 'Spider nest with ore to mine. PvP players may attack here.' },
  { key: 'wilderness', name: 'Wilderness', color: 0x7fd7ff, safe: false, pvp: 'flagged', populate: false, description: 'Lawless land between towns: no guards, PvP players hunt others here. Explorers love it, casual players fear it.' },
  { key: 'pvpzone', name: 'PvP Zone', color: 0xe2574c, safe: false, pvp: 'open', populate: false, description: 'Battleground: everyone inside fights everyone. PvP players flock here, kills give XP and season points; casual players avoid it.' },
  { key: 'safezone', name: 'Safe Zone', color: 0x9cf0c0, safe: true, pvp: 'none', populate: false, description: 'Protected area: nobody can attack players here. Put it around towns and roads to stop ganking.' },
];
const BY = new Map(REGION_TYPES.map((t) => [t.key, t]));
export const getRegionType = (k: RegionType): RegionTypeDef => BY.get(k) ?? REGION_TYPES[6];

export const PVP_LABEL: Record<PvpRule, string> = { none: 'PvP: off', flagged: 'PvP: PvP players only', open: 'PvP: everyone' };
