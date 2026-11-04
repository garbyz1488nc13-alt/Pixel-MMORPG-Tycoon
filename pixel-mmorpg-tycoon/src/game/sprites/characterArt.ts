import type { CreatureType } from '@/data/creatureTypes';
import { NPC_TYPES, type NpcTypeDef } from '@/data/npcTypes';
import type { ArtCanvas } from './ArtCanvas';

/** 16×16 humanoid template. o outline, h hair, s skin, e eye, b body, B belt, a accent, l legs, f feet. */
const HEAD_BODY = [
  '................',
  '.....oooooo.....',
  '....ohhhhhho....',
  '....ohssssho....',
  '....osesseso....',
  '.....oooooo.....',
  '...obbbbbbbbo...',
  '..osbbbaabbbso..',
  '..osbbbaabbbso..',
  '..oobbbbbbbboo..',
  '...oBBBBBBBBo...',
];
const LEGS_A = ['....ollllllo....', '....olloollo....', '....olo..olo....', '...offo..offo...', '................'];
const LEGS_B = ['....ollllllo....', '....ollo.llo....', '...ollo...olo...', '...ffo.....off..', '................'];
export const HUMANOID_FRAMES = [[...HEAD_BODY, ...LEGS_A], [...HEAD_BODY, ...LEGS_B]];

export interface HumanoidLook {
  h: string; s: string; b: string; B: string; a: string; l: string; f: string; e?: string;
  accessory?: NpcTypeDef['accessory'] | 'ears' | 'ribs' | 'tusks' | 'horns';
  weapon?: 'spear' | 'dagger' | 'axe' | 'hammer' | 'staff' | 'sword' | 'bow';
}

export function drawHumanoid(a: ArtCanvas, look: HumanoidLook, frame: number, ox = 0, oy = 0) {
  const colors: Record<string, string> = { o: '#1a1020', h: look.h, s: look.s, e: look.e ?? '#1a1020', b: look.b, B: look.B, a: look.a, l: look.l, f: look.f };
  a.shadow(ox + 8, oy + 15, 5, 1);
  a.pattern(HUMANOID_FRAMES[frame], colors, ox, oy);
  const P = (x: number, y: number, c: string) => a.px(ox + x, oy + y, c);
  switch (look.accessory) {
    case 'helmet':
      for (let x = 5; x <= 10; x++) { P(x, 1, '#b8c0c8'); P(x, 2, x % 2 ? '#8d97a3' : '#b8c0c8'); }
      P(4, 2, '#5f6873'); P(11, 2, '#5f6873'); P(7, 0, '#c23b32'); P(8, 0, '#c23b32');
      break;
    case 'hood':
      for (let x = 5; x <= 10; x++) { P(x, 1, look.b); P(x, 2, look.b); }
      for (const y of [2, 3, 4]) { P(4, y, look.b); P(11, y, look.b); }
      P(3, 4, '#1a1020'); P(12, 4, '#1a1020');
      break;
    case 'strawhat':
      for (let x = 2; x <= 13; x++) P(x, 2, x % 3 ? '#e8d27a' : '#c9b05a');
      for (let x = 5; x <= 10; x++) { P(x, 1, '#e8d27a'); P(x, 0, '#c9b05a'); }
      break;
    case 'hat':
      for (let x = 3; x <= 12; x++) P(x, 1, look.B);
      for (let x = 5; x <= 10; x++) { P(x, 0, look.B); P(x, 1, x === 5 || x === 10 ? look.B : look.a); }
      break;
    case 'apron':
      for (let y = 7; y <= 11; y++) for (let x = 6; x <= 9; x++) P(x, y, '#8a6a4a');
      break;
    case 'headband':
      for (let x = 5; x <= 10; x++) P(x, 2, look.a);
      P(4, 3, look.a); P(3, 4, look.a);
      break;
    case 'crown':
      for (let x = 5; x <= 10; x++) P(x, 1, '#f2c14e');
      P(5, 0, '#f2c14e'); P(7, 0, '#f2c14e'); P(8, 0, '#f2c14e'); P(10, 0, '#f2c14e');
      break;
    case 'ears':
      P(3, 3, look.s); P(2, 2, look.s); P(12, 3, look.s); P(13, 2, look.s);
      break;
    case 'ribs':
      for (const y of [7, 9]) for (const x of [4, 6, 9, 11]) P(x, y, look.B);
      break;
    case 'tusks':
      P(6, 5, '#f5f0e0'); P(9, 5, '#f5f0e0');
      break;
    case 'horns':
      P(4, 1, '#f5f0e0'); P(3, 0, '#f5f0e0'); P(11, 1, '#f5f0e0'); P(12, 0, '#f5f0e0');
      break;
  }
  switch (look.weapon) {
    case 'spear':
      for (let y = 2; y <= 13; y++) P(14, y, '#8a5a34');
      P(14, 0, '#d8dde2'); P(14, 1, '#b8c0c8'); P(13, 1, '#b8c0c8'); P(15, 1, '#b8c0c8');
      break;
    case 'dagger':
      P(14, 6, '#d8dde2'); P(14, 7, '#d8dde2'); P(14, 8, '#5e3b20');
      break;
    case 'axe':
      for (let y = 3; y <= 10; y++) P(14, y, '#5e3b20');
      P(13, 3, '#b8c0c8'); P(15, 3, '#b8c0c8'); P(13, 4, '#b8c0c8'); P(15, 4, '#b8c0c8'); P(15, 5, '#b8c0c8');
      break;
    case 'hammer':
      for (let y = 5; y <= 10; y++) P(14, y, '#5e3b20');
      P(13, 4, '#4a4a52'); P(14, 4, '#4a4a52'); P(15, 4, '#4a4a52'); P(13, 5, '#4a4a52'); P(15, 5, '#4a4a52');
      break;
    case 'staff':
      for (let y = 1; y <= 13; y++) P(14, y, '#6e4a2c');
      P(14, 0, look.a); P(13, 0, look.a); P(15, 0, look.a);
      break;
    case 'sword':
      for (let y = 2; y <= 8; y++) P(14, y, '#e0e8f0');
      P(13, 9, '#b0832a'); P(14, 9, '#b0832a'); P(15, 9, '#b0832a'); P(14, 10, '#5e3b20');
      break;
    case 'bow':
      for (let y = 3; y <= 12; y++) P(y < 5 || y > 10 ? 13 : 14, y, '#8a5a34');
      for (let y = 3; y <= 12; y++) P(12, y, '#e8e4d4');
      break;
  }
}

export function npcLook(t: NpcTypeDef): HumanoidLook {
  const weapon: HumanoidLook['weapon'] = t.key === 'guard' ? 'spear' : t.key === 'blacksmith' ? 'hammer' : t.key === 'healer' || t.key === 'questgiver' ? 'staff' : undefined;
  return { ...t.palette, accessory: t.accessory, weapon };
}

export const NPC_LOOKS = Object.fromEntries(NPC_TYPES.map((t) => [t.key, npcLook(t)]));

/** Simulated players: one look per class (they're adventurers, so brighter than townsfolk). */
export const PLAYER_LOOKS: Record<string, HumanoidLook> = {
  warrior: { h: '#6a3a1a', s: '#f0c39a', b: '#c23b32', B: '#5f6873', a: '#d8dde2', l: '#5f6873', f: '#2a2f36', accessory: 'helmet', weapon: 'sword' },
  mage: { h: '#d8d8f0', s: '#f2c9a5', b: '#3a5ad2', B: '#22348a', a: '#7fd7ff', l: '#2a3a8a', f: '#1a1a3a', accessory: 'hat', weapon: 'staff' },
  archer: { h: '#c9883a', s: '#e8b98f', b: '#3f8a4a', B: '#5e3b20', a: '#f2c14e', l: '#4a3a22', f: '#2b1d12', accessory: 'hood', weapon: 'bow' },
  rogue: { h: '#1a1a24', s: '#d9a07a', b: '#3a2a4a', B: '#14101a', a: '#b56cff', l: '#24182e', f: '#100c14', accessory: 'hood', weapon: 'dagger' },
  paladin: { h: '#f5e6a8', s: '#f2c9a5', b: '#f0eadc', B: '#b0832a', a: '#f2c14e', l: '#c9c1b1', f: '#6a5b4a', accessory: 'crown', weapon: 'hammer' },
};

const HUMANOID_CREATURES: Partial<Record<CreatureType, HumanoidLook>> = {
  goblin: { h: '#2f4a1a', s: '#6fae3a', b: '#7a5a3a', B: '#4a3420', a: '#c9b05a', l: '#5a4630', f: '#2b1d12', e: '#ffd04a', accessory: 'ears', weapon: 'dagger' },
  skeleton: { h: '#e8e4d4', s: '#e8e4d4', b: '#d8d4c4', B: '#8a867a', a: '#d8d4c4', l: '#d8d4c4', f: '#b8b4a4', e: '#1a1020', accessory: 'ribs', weapon: 'dagger' },
  zombie: { h: '#3a3a2a', s: '#8fa86a', b: '#4a5a7a', B: '#2a344a', a: '#6a3a3a', l: '#3a3a4a', f: '#2a2a2a', e: '#e2574c' },
  orc: { h: '#1a1a1a', s: '#5a7a3a', b: '#6a4a30', B: '#3a2818', a: '#9aa3ad', l: '#4a3a2a', f: '#1a1410', e: '#e2574c', accessory: 'tusks', weapon: 'axe' },
  boss: { h: '#2a0a0a', s: '#a8302a', b: '#2a2030', B: '#14101a', a: '#f2c14e', l: '#2a2030', f: '#14101a', e: '#ffd04a', accessory: 'horns', weapon: 'staff' },
};

/** Creature sprite at 16×16 art (size 1) or 32×32 art (size 2). */
export function drawCreature(a: ArtCanvas, type: CreatureType, frame: number) {
  const hl = HUMANOID_CREATURES[type];
  if (hl && type !== 'boss') return drawHumanoid(a, hl, frame);
  switch (type) {
    case 'slime': {
      const squish = frame ? 1 : 0;
      a.shadow(8, 14, 6, 1.2);
      a.ellipse(8, 10 + squish * 0.5, 6 + squish, 4.5 - squish * 0.5, '#5ac84a', '#2a6a26');
      a.ellipse(6, 8.5, 2, 1.2, '#b8f0a0');
      a.px(6, 10, '#1a1020'); a.px(10, 10, '#1a1020');
      a.px(8, 12, '#2a6a26');
      break;
    }
    case 'wolf': {
      const G = '#8d8f96', D = '#5f6168', L = '#b4b6bc';
      a.shadow(8, 14, 6, 1.2);
      a.rect(3, 7, 9, 4, G); a.hline(3, 11, 7, L); a.hline(3, 11, 10, D);
      a.rect(10, 4, 4, 4, G); a.px(14, 6, G); a.px(15, 6, '#1a1020'); a.px(12, 5, '#ffd04a'); a.px(10, 3, D); a.px(12, 3, D);
      a.line(3, 8, 0, 5 + frame, G);
      const legs = frame ? [[4, 0], [6, 1], [9, 1], [11, 0]] : [[4, 1], [6, 0], [9, 0], [11, 1]];
      for (const [x, o] of legs) a.vline(x, 11, 13 - o, D);
      break;
    }
    case 'spider': {
      a.shadow(8, 14, 7, 1.5);
      for (let i = 0; i < 4; i++) {
        const y = 7 + i * 1.5;
        const k = (i + frame) % 2;
        a.line(6, y, 1, y - 2 + k * 3, '#2a1a2a'); a.line(1, y - 2 + k * 3, 0, y + 3, '#2a1a2a');
        a.line(10, y, 15, y - 2 + (1 - k) * 3, '#2a1a2a'); a.line(15, y - 2 + (1 - k) * 3, 15, y + 3, '#2a1a2a');
      }
      a.ellipse(8, 10, 4, 3.5, '#3a2a4a', '#1a1020');
      a.ellipse(8, 6, 2.5, 2, '#2a1a3a');
      a.px(7, 6, '#e2574c'); a.px(9, 6, '#e2574c'); a.px(8, 11, '#b56cff');
      break;
    }
    case 'dragon': {
      const R = '#c23b32', D = '#7a1a14', L = '#e86a4a', B = '#f2c14e';
      a.shadow(16, 29, 12, 2);
      const wy = frame ? 4 : 8;
      for (let i = 0; i < 10; i++) { a.line(12, 14, 3 + i * 0.4, wy + i, i % 3 ? D : R); a.line(20, 14, 29 - i * 0.4, wy + i, i % 3 ? D : R); }
      a.ellipse(16, 19, 8, 6, R, D);
      a.ellipse(16, 21, 5, 3, B);
      a.rect(14, 9, 4, 6, R);
      a.ellipse(16, 7, 4, 3.5, R, D); a.px(14, 6, B); a.px(18, 6, B); a.px(13, 3, L); a.px(19, 3, L); a.px(12, 2, L); a.px(20, 2, L);
      a.rect(15, 10, 2, 1, '#ff7a2a');
      a.line(22, 22, 29, 27, R); a.line(29, 27, 30, 24, D);
      for (const x of [11, 19]) a.rect(x, 24, 3, 4, D);
      break;
    }
    case 'boss': {
      // Big humanoid: draw the 16px look at 2× by plotting each art pixel as a 2×2 block.
      const big = { px: (x: number, y: number, c: string) => a.rect(x * 2, y * 2, 2, 2, c), rect: () => undefined } as unknown as ArtCanvas;
      const proxy = new Proxy(a, {
        get: (t, k) => (k === 'px' ? big.px : k === 'shadow' ? (cx: number, cy: number, rx: number, ry: number) => t.shadow(cx * 2, cy * 2, rx * 2, ry * 2) : (t as any)[k]),
      }) as ArtCanvas;
      drawHumanoid(proxy, HUMANOID_CREATURES.boss!, frame);
      break;
    }
  }
}
