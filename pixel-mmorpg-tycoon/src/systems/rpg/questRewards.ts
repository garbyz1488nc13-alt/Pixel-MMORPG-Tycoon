import type { QuestDef } from '@/models/rpg';
import type { WorldRuntime } from '@/simulation/WorldRuntime';
import { xpToNext } from './progression';

/**
 * Standard quest rewards, so lazy designers don't have to tune numbers by hand.
 * Every objective is priced by the work it takes (monsters' XP and level, item
 * values, travel), with a floor based on the quest's level.
 */
export function autoRewards(q: QuestDef, world: WorldRuntime): QuestDef['rewards'] {
  const s = world.entities;
  const lv = Math.max(1, q.requiredLevel);
  const need = xpToNext(lv, world.rpg.progression) || 500;
  let xp = 0, gold = 0;
  for (const o of q.objectives) {
    switch (o.type) {
      case 'kill':
      case 'boss': {
        const tpl = o.targetId ? s.get('creatureTemplates', o.targetId) : undefined;
        const each = tpl?.xpReward ?? 10;
        xp += each * o.count * (o.type === 'boss' ? 1 : 1.5);
        gold += (tpl?.level ?? lv) * o.count * (o.type === 'boss' ? 25 : 2);
        break;
      }
      case 'collect':
      case 'gather':
      case 'deliver': {
        const it = o.targetId ? s.get('items', o.targetId) : undefined;
        const value = Math.max(1, it?.value ?? 5);
        xp += o.count * (8 + lv * 3) * (o.type === 'deliver' ? 1.2 : 1);
        gold += o.count * value * (o.type === 'deliver' ? 1.1 : 0.8);
        break;
      }
      case 'explore':
        xp += need * 0.25;
        gold += 5 + lv * 3;
        break;
      case 'talk':
        xp += need * 0.1;
        gold += 2 + lv;
        break;
    }
  }
  xp = Math.max(xp, need * 0.15);
  if (q.repeatable) { xp *= 0.7; gold *= 0.7; }
  return { xp: Math.round(xp), currency: Math.max(1, Math.round(gold)), items: q.rewards.items };
}
