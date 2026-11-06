import type { ArtCanvas } from './ArtCanvas';

/**
 * Procedural pixel art for map objects. Canvas size in art pixels is
 * (w*16) × ((h+overhang)*16); the footprint is the bottom h*16 rows.
 */
type Painter = (a: ArtCanvas) => void;

const OUT = '#1a1020';
const WOOD = '#8a5a34', WOOD_D = '#5e3b20', WOOD_L = '#b07a4a';
const STONE = '#8d8f96', STONE_D = '#5f6168', STONE_L = '#b4b6bc';
const LEAF = '#3f8f35', LEAF_D = '#2a6a26', LEAF_L = '#66b84a', LEAF_X = '#8fd468';

function canopy(a: ArtCanvas, cx: number, cy: number, rx: number, ry: number, c = LEAF, d = LEAF_D, l = LEAF_L) {
  a.ellipse(cx, cy, rx, ry, c, d);
  a.ellipse(cx - rx * 0.3, cy - ry * 0.35, rx * 0.45, ry * 0.35, l);
  a.px(cx - rx * 0.4, cy - ry * 0.5, LEAF_X);
  a.px(cx + rx * 0.2, cy - ry * 0.1, l);
  a.ellipse(cx + rx * 0.35, cy + ry * 0.45, rx * 0.4, ry * 0.25, d);
}

function trunk(a: ArtCanvas, x: number, top: number, bottom: number) {
  a.rect(x, top, 3, bottom - top + 1, WOOD);
  a.vline(x, top, bottom, WOOD_D);
  a.vline(x + 2, top, bottom, WOOD_L);
}

function pine(a: ArtCanvas, snow: boolean) {
  a.shadow(8, 30, 6, 2);
  trunk(a, 7, 24, 30);
  const tiers = [[3, 9, 4], [9, 16, 6], [15, 24, 7]];
  for (const [y0, y1, half] of tiers) {
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / (y1 - y0);
      const hw = Math.round(1 + t * half);
      a.hline(8 - hw, 8 + hw, y, LEAF_D);
      if (hw > 1) a.hline(8 - hw + 1, 8 + hw - 1, y, '#2f7a2c');
      if (hw > 2) a.hline(8 - hw + 1, 7, y, '#3f9a38');
    }
    if (snow) {
      const hw = 2 + half - 3;
      a.hline(8 - hw, 8 + hw - 2, y0 + 2, '#f2f6fa');
      a.hline(8 - 1, 8 + 1, y0, '#f2f6fa');
    }
  }
  a.px(8, 2, LEAF_D);
}

function rockShape(a: ArtCanvas, cx: number, cy: number, rx: number, ry: number) {
  a.shadow(cx, cy + ry - 1, rx + 1, 2);
  a.ellipse(cx, cy, rx, ry, STONE, STONE_D);
  a.ellipse(cx - rx * 0.3, cy - ry * 0.35, rx * 0.45, ry * 0.3, STONE_L);
  a.hline(cx - rx * 0.4, cx + rx * 0.5, cy + ry * 0.55, STONE_D);
}

function roof(a: ArtCanvas, x: number, y: number, w: number, h: number, c: string, d: string, l: string) {
  for (let j = 0; j < h; j++) {
    const inset = Math.max(0, Math.round((h - j - 1) * 0.35));
    a.hline(x + inset, x + w - 1 - inset, y + j, j % 3 === 2 ? d : c);
    a.px(x + inset, y + j, d);
    a.px(x + w - 1 - inset, y + j, d);
  }
  a.hline(x + Math.round((h - 1) * 0.35), x + w - 1 - Math.round((h - 1) * 0.35), y, l);
  a.hline(x, x + w - 1, y + h, OUT);
}

function walls(a: ArtCanvas, x: number, y: number, w: number, h: number, c: string, d: string, beams = true) {
  a.rect(x, y, w, h, c);
  a.outlineRect(x, y, w, h, d);
  if (beams) {
    for (let bx = x + 5; bx < x + w - 2; bx += 8) a.vline(bx, y, y + h - 1, WOOD_D);
    a.hline(x, x + w - 1, y + 1, WOOD_D);
  }
}

function door(a: ArtCanvas, x: number, y: number, w = 4, h = 7) {
  a.rect(x, y, w, h, WOOD_D);
  a.rect(x + 1, y + 1, w - 2, h - 1, WOOD);
  a.px(x + w - 2, y + Math.floor(h / 2), '#f2c14e');
}

function windowAt(a: ArtCanvas, x: number, y: number, lit = '#ffe08a') {
  a.rect(x, y, 4, 4, OUT);
  a.rect(x + 1, y + 1, 2, 2, lit);
  a.px(x + 1, y + 1, '#fff6c8');
}

function house(a: ArtCanvas, roofC: [string, string, string], wallC: [string, string], windows: number, chimney = false) {
  const W = a.w, H = a.h;
  const wallTop = Math.round(H * 0.5);
  a.shadow(W / 2, H - 2, W / 2 - 1, 2);
  walls(a, 1, wallTop, W - 2, H - wallTop - 1, wallC[0], wallC[1]);
  const dw = 5;
  door(a, Math.floor(W / 2 - dw / 2), H - 9, dw, 8);
  for (let i = 0; i < windows; i++) {
    const wx = Math.round(((i + 1) * W) / (windows + 1)) - 2;
    if (Math.abs(wx + 2 - W / 2) > 4) windowAt(a, wx, wallTop + 5);
  }
  if (chimney) {
    a.rect(W - 9, 3, 4, 10, STONE_D);
    a.rect(W - 8, 3, 2, 9, STONE);
  }
  roof(a, 0, 6, W, wallTop - 4, roofC[0], roofC[1], roofC[2]);
}

export const OBJECT_ART: Record<string, Painter> = {
  tree_oak: (a) => {
    a.shadow(8, 30, 7, 2);
    trunk(a, 7, 20, 30);
    a.px(6, 30, WOOD_D); a.px(10, 30, WOOD_D);
    canopy(a, 8, 12, 7.5, 9);
  },
  tree_pine: (a) => pine(a, false),
  tree_snow: (a) => pine(a, true),
  tree_palm: (a) => {
    a.shadow(8, 30, 5, 2);
    for (let y = 10; y <= 30; y++) {
      const x = 7 + Math.round(Math.sin((y - 10) / 7) * 2);
      a.rect(x, y, 2, 1, y % 3 === 0 ? WOOD_D : '#a77a48');
    }
    const top = [8, 9];
    for (const [dx, dy, len] of [[-1, -0.3, 7], [1, -0.3, 7], [-1, 0.5, 6], [1, 0.5, 6], [0.2, -1, 5]] as const) {
      for (let i = 0; i < len; i++) a.px(top[0] + dx * i, top[1] + dy * i + (i * i) / 10, i % 2 ? LEAF : LEAF_L);
      for (let i = 1; i < len; i++) a.px(top[0] + dx * i, top[1] + 1 + dy * i + (i * i) / 10, LEAF_D);
    }
    a.px(8, 10, '#6e4a2c'); a.px(9, 11, '#6e4a2c');
  },
  tree_dead: (a) => {
    a.shadow(8, 30, 5, 2);
    trunk(a, 7, 12, 30);
    const br = '#6e5a4a';
    a.line(8, 16, 3, 9, br); a.line(8, 14, 13, 7, br); a.line(5, 12, 4, 6, br); a.line(11, 10, 13, 4, br); a.line(8, 12, 8, 5, br);
  },
  rock: (a) => rockShape(a, 8, 10, 6, 4.5),
  boulder: (a) => {
    rockShape(a, 16, 19, 13, 10);
    a.line(10, 14, 16, 22, STONE_D);
  },
  ore_rock: (a) => {
    rockShape(a, 8, 10, 6, 4.5);
    for (const [x, y] of [[6, 9], [9, 11], [10, 8], [5, 12]]) a.px(x, y, '#f2c14e');
    a.px(8, 10, '#5aa9e6');
  },
  bush: (a) => {
    a.shadow(8, 14, 6, 1.5);
    a.ellipse(8, 10, 6.5, 4.5, LEAF, LEAF_D);
    a.ellipse(6, 8.5, 3, 2, LEAF_L);
    a.px(5, 8, LEAF_X);
  },
  berry_bush: (a) => {
    OBJECT_ART.bush(a);
    for (const [x, y] of [[5, 10], [9, 8], [11, 11], [7, 12], [10, 10]]) a.px(x, y, '#d8344a');
  },
  house_small: (a) => house(a, ['#b8442a', '#7a2a1a', '#e06a4a'], ['#e8d4a8', '#9a7a52'], 2),
  house_large: (a) => house(a, ['#3a6aa8', '#24467a', '#5a8ad0'], ['#e8d4a8', '#9a7a52'], 3, true),
  shop: (a) => {
    house(a, ['#3f8a4a', '#24532b', '#6cc551'], ['#efe0bc', '#9a7a52'], 2);
    const y = Math.round(a.h * 0.5) + 2;
    for (let x = 2; x < a.w - 2; x++) a.vline(x, y, y + 3, Math.floor(x / 3) % 2 ? '#f5f5f5' : '#3f8a4a');
    a.hline(2, a.w - 3, y + 4, OUT);
    a.rect(a.w / 2 - 5, 8, 10, 6, WOOD); a.outlineRect(a.w / 2 - 5, 8, 10, 6, WOOD_D); a.rect(a.w / 2 - 1, 10, 2, 2, '#f2c14e');
  },
  smithy: (a) => {
    house(a, ['#4f4f58', '#2d2d34', '#6e6e78'], ['#8d8f96', '#4c4e55'], 1, true);
    a.ellipse(a.w - 7, 1.5, 2.5, 1.5, 'rgba(200,200,210,0.6)');
    const ax = 4, ay = a.h - 7;
    a.rect(ax, ay, 7, 2, '#3a3a44'); a.rect(ax + 2, ay + 2, 3, 3, '#2a2a30'); a.px(ax + 6, ay - 1, '#ff7a2a');
  },
  tavern: (a) => {
    house(a, ['#7a4a2a', '#4e2c16', '#a06a40'], ['#d8b888', '#8a6a42'], 4, true);
    const sx = 6, sy = Math.round(a.h * 0.5) - 1;
    a.rect(sx, sy, 7, 6, WOOD); a.outlineRect(sx, sy, 7, 6, WOOD_D);
    a.rect(sx + 2, sy + 1, 3, 4, '#f2c14e'); a.px(sx + 5, sy + 2, '#f2c14e'); a.hline(sx + 2, sx + 4, sy + 1, '#fff6c8');
  },
  hotel: (a) => {
    // Three storeys of rooms with lit windows and a sign.
    const W = a.w, H = a.h;
    a.shadow(W / 2, H - 2, W / 2 - 1, 2);
    const top = 16;
    a.rect(2, top, W - 4, H - top - 1, '#c9a27a'); a.outlineRect(2, top, W - 4, H - top - 1, '#7a5a3a');
    for (let y = top + 10; y < H - 4; y += 11) a.hline(2, W - 3, y, '#a07a52');
    for (let fl = 0; fl < 3; fl++) for (let x = 6; x < W - 6; x += 8) { const wy = top + 3 + fl * 11; a.rect(x, wy, 5, 5, '#5a9ed8'); a.outlineRect(x, wy, 5, 5, '#4a3a2a'); a.px(x + 1, wy + 1, '#cfe8ff'); }
    door(a, W / 2 - 3, H - 10, 6, 9);
    for (let j = 0; j < 12; j++) a.hline(2 + Math.round(j * 0.6), W - 3 - Math.round(j * 0.6), top - 1 - j, j % 3 === 2 ? '#6a2a2a' : '#8a3a32');
    a.rect(W / 2 - 9, top - 9, 18, 6, '#2a1c12'); for (let x = 0; x < 5; x++) a.rect(W / 2 - 8 + x * 3.5, top - 8, 2, 4, '#f2c14e');
  },
  temple: (a) => {
    const W = a.w, H = a.h;
    a.shadow(W / 2, H - 2, W / 2 - 1, 2);
    const top = 30;
    a.rect(2, top, W - 4, H - top - 1, '#ece6dc'); a.outlineRect(2, top, W - 4, H - top - 1, '#a9a191');
    for (let x = 5; x < W - 4; x += 6) { a.rect(x, top + 4, 2, H - top - 9, '#fffaf0'); a.vline(x + 2, top + 4, H - 6, '#c9c1b1'); }
    door(a, W / 2 - 3, H - 11, 6, 10);
    a.hline(1, W - 2, top, '#a9a191'); a.hline(1, W - 2, top + 3, '#a9a191');
    for (let j = 0; j < 24; j++) { const hw = Math.round((j / 24) * (W / 2 - 1)); a.hline(W / 2 - hw, W / 2 + hw - 1, 6 + j, j % 4 === 3 ? '#2f5a9a' : '#3f7ac8'); }
    a.vline(W / 2 - 1, 0, 6, '#f2c14e'); a.hline(W / 2 - 3, W / 2 + 1, 2, '#f2c14e');
  },
  bank: (a) => {
    const W = a.w, H = a.h;
    a.shadow(W / 2, H - 2, W / 2 - 1, 2);
    const top = 20;
    a.rect(2, top, W - 4, H - top - 1, '#c9c3b5'); a.outlineRect(2, top, W - 4, H - top - 1, '#7f786a');
    for (let x = 6; x < W - 5; x += 8) a.rect(x, top + 4, 3, H - top - 9, '#f0eadc');
    door(a, W / 2 - 3, H - 10, 6, 9);
    for (let j = 0; j < 12; j++) { const hw = Math.round((j / 12) * (W / 2)); a.hline(W / 2 - hw, W / 2 + hw - 1, 8 + j, '#7f786a'); }
    a.ellipse(W / 2, 15, 3, 3, '#f2c14e', '#b0832a');
  },
  tower: (a) => {
    const W = a.w, H = a.h;
    a.shadow(W / 2, H - 2, W / 2 - 1, 2);
    a.rect(4, 10, W - 8, H - 11, STONE); a.outlineRect(4, 10, W - 8, H - 11, STONE_D);
    for (let y = 14; y < H - 2; y += 4) for (let x = 5 + ((y / 4) % 2) * 3; x < W - 5; x += 6) a.hline(x, x + 3, y, STONE_D);
    for (let x = 2; x < W - 2; x += 4) a.rect(x, 6, 3, 4, STONE_L);
    a.rect(2, 9, W - 4, 2, STONE_D);
    a.rect(W / 2 - 1, 20, 2, 6, OUT); a.rect(W / 2 - 1, 40, 2, 6, OUT);
    door(a, W / 2 - 3, H - 10, 6, 9);
    a.vline(W / 2, 0, 6, WOOD_D); a.rect(W / 2 + 1, 0, 5, 3, '#c23b32');
  },
  wall: (a) => {
    a.rect(0, 2, 16, 14, STONE); a.rect(0, 2, 16, 2, STONE_L);
    for (let y = 6; y < 16; y += 4) for (let x = (y / 4) % 2 ? 0 : 4; x < 16; x += 8) a.vline(x, y - 2, y, STONE_D);
    for (let y = 5; y < 16; y += 4) a.hline(0, 15, y, STONE_D);
    a.hline(0, 15, 15, '#3f4148');
  },
  road: (a) => {
    a.rect(0, 0, 16, 16, '#9b8b74');
    for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < 16; x += 4) { a.rect(x, y, 3, 3, '#b5a68c'); a.px(x + 2, y + 2, '#7a6c58'); }
  },
  dirt_path: (a) => {
    a.rect(0, 0, 16, 16, '#9a6e44');
    for (const [x, y] of [[2, 3], [9, 2], [13, 9], [5, 11], [10, 13], [1, 14]]) { a.px(x, y, '#7a5230'); a.px(x + 1, y, '#b58a5c'); }
  },
  bridge: (a) => {
    for (let y = 0; y < 16; y += 3) { a.rect(0, y, 16, 2, WOOD_L); a.hline(0, 15, y + 2, WOOD_D); }
    a.rect(0, 0, 16, 1, WOOD_D); a.rect(0, 15, 16, 1, WOOD_D);
    a.rect(0, 0, 1, 16, WOOD_D); a.rect(15, 0, 1, 16, WOOD_D);
  },
  fence: (a) => {
    a.rect(1, 6, 2, 9, WOOD); a.rect(13, 6, 2, 9, WOOD);
    a.rect(0, 8, 16, 2, WOOD_L); a.rect(0, 12, 16, 2, WOOD_L);
    a.hline(0, 15, 10, WOOD_D); a.hline(0, 15, 14, WOOD_D);
  },
  lamp: (a) => {
    a.shadow(8, 30, 3, 1);
    a.rect(7, 8, 2, 23, '#2d2d34');
    a.rect(5, 3, 6, 6, '#2d2d34'); a.rect(6, 4, 4, 4, '#ffe08a'); a.px(6, 4, '#fff6c8');
    a.rect(5, 30, 6, 2, '#2d2d34');
  },
  well: (a) => {
    a.shadow(8, 14, 7, 1.5);
    a.ellipse(8, 10, 7, 4.5, STONE, STONE_D);
    a.ellipse(8, 9.5, 4.5, 2.5, '#24589a');
    a.vline(2, 0, 9, WOOD_D); a.vline(13, 0, 9, WOOD_D); a.hline(1, 14, 1, WOOD); a.hline(1, 14, 0, WOOD_L);
  },
  sign: (a) => {
    a.rect(7, 7, 2, 9, WOOD_D);
    a.rect(2, 2, 12, 6, WOOD); a.outlineRect(2, 2, 12, 6, WOOD_D); a.hline(4, 11, 4, WOOD_D); a.hline(4, 9, 6, WOOD_D);
  },
  barrel: (a) => {
    a.shadow(8, 15, 5, 1);
    a.rect(4, 3, 8, 12, WOOD); a.outlineRect(4, 3, 8, 12, WOOD_D);
    a.hline(4, 11, 6, '#4a4a52'); a.hline(4, 11, 11, '#4a4a52'); a.vline(6, 4, 13, WOOD_L);
  },
  crate: (a) => {
    a.shadow(8, 15, 6, 1);
    a.rect(2, 4, 12, 11, '#b08048'); a.outlineRect(2, 4, 12, 11, WOOD_D);
    a.line(3, 5, 12, 13, WOOD_D); a.line(12, 5, 3, 13, WOOD_D); a.hline(3, 12, 5, '#d0a068');
  },
  campfire: (a) => {
    for (const [x, y] of [[3, 12], [6, 13], [10, 13], [13, 12], [8, 13]]) a.rect(x - 1, y, 3, 2, STONE);
    a.line(4, 12, 12, 9, WOOD_D); a.line(4, 9, 12, 12, WOOD);
    a.ellipse(8, 8, 3.5, 4.5, '#ff7a2a'); a.ellipse(8, 9, 2, 3, '#ffd04a'); a.px(8, 3, '#ff7a2a'); a.px(7, 5, '#ffd04a');
  },
  flowers: (a) => {
    const cols = ['#f6e05e', '#f5f5f5', '#e85a8a', '#8a7aff', '#ff9a4a'];
    [[2, 3], [7, 2], [12, 5], [4, 9], [10, 10], [13, 13], [6, 13], [1, 12]].forEach(([x, y], i) => {
      a.px(x, y + 1, LEAF_D); a.px(x, y, cols[i % cols.length]); a.px(x + 1, y, cols[(i + 2) % cols.length]);
    });
  },
  statue: (a) => {
    a.shadow(8, 30, 6, 1.5);
    a.rect(2, 24, 12, 7, STONE_D); a.rect(3, 24, 10, 2, STONE_L);
    a.ellipse(8, 7, 3, 3, STONE_L, STONE_D);
    a.rect(5, 10, 6, 10, STONE); a.vline(5, 10, 19, STONE_D); a.rect(6, 20, 2, 4, STONE); a.rect(9, 20, 2, 4, STONE);
    a.line(11, 11, 14, 4, STONE_L);
  },
  portal: (a) => {
    a.ellipse(8, 8, 7, 7.5, '#5a2a9a', '#2a0a5a');
    a.ellipse(8, 8, 5, 5.5, '#8a4aea');
    a.ellipse(8, 8, 3, 3.5, '#c89aff');
    a.ellipse(8, 8, 1.5, 1.5, '#ffffff');
    a.px(3, 5, '#e0c8ff'); a.px(12, 11, '#e0c8ff');
  },
  dungeon_entrance: (a) => {
    a.rect(1, 6, 30, 26, STONE_D);
    a.rect(2, 7, 28, 24, STONE);
    for (let y = 9; y < 30; y += 4) a.hline(2, 29, y, STONE_D);
    a.ellipse(16, 18, 9, 10, '#0d0b14');
    a.rect(7, 18, 18, 14, '#0d0b14');
    for (let i = 0; i < 4; i++) a.hline(9 + i, 22 - i, 22 + i * 3, '#3a3a44');
    a.rect(1, 3, 30, 4, STONE_L); a.hline(1, 30, 6, STONE_D);
    a.px(5, 12, '#ff7a2a'); a.px(26, 12, '#ff7a2a'); a.px(5, 11, '#ffd04a'); a.px(26, 11, '#ffd04a');
  },
  cave_entrance: (a) => {
    a.shadow(16, 30, 15, 2);
    a.ellipse(16, 18, 15, 13, '#6e6a62', '#45423c');
    a.ellipse(11, 11, 6, 4, '#8a867c');
    a.ellipse(16, 23, 7, 8, '#0d0b14');
    a.rect(9, 24, 14, 7, '#0d0b14');
    a.px(22, 9, '#45423c'); a.px(7, 15, '#45423c');
  },
  player_spawn: (a) => {
    a.ellipse(8, 8, 7, 7, 'rgba(90,169,230,0.35)', '#5aa9e6');
    a.ellipse(8, 8, 4, 4, 'rgba(127,215,255,0.5)', '#7fd7ff');
    a.vline(8, 2, 9, '#f5f5f5'); a.rect(9, 2, 4, 3, '#5aa9e6');
  },

  // ---------------------------------------------------- camp & frontier decorations
  palisade: (a) => {
    a.shadow(8, 30, 8, 1);
    for (const x of [1, 5, 9, 13]) {
      a.rect(x, 6, 3, 25, WOOD); a.vline(x, 6, 30, WOOD_D); a.px(x + 1, 5, WOOD); a.px(x + 1, 4, WOOD_L);
      a.px(x + 2, 12, WOOD_D); a.px(x, 20, WOOD_L);
    }
    a.hline(0, 15, 12, '#5a3a1a'); a.hline(0, 15, 24, '#5a3a1a');
  },
  log_wall: (a) => {
    for (const y of [3, 7, 11]) { a.rect(0, y, 16, 4, WOOD); a.hline(0, 15, y, WOOD_L); a.hline(0, 15, y + 3, WOOD_D); a.px(1, y + 1, '#c9955a'); a.px(14, y + 2, '#c9955a'); }
  },
  hut: (a) => {
    a.shadow(16, 46, 15, 2);
    a.rect(4, 24, 24, 22, '#8a6a3a'); for (let x = 4; x < 28; x += 3) a.vline(x, 24, 45, '#6e5230');
    for (let y = 0; y < 16; y++) a.hline(16 - y - 2, 16 + y + 1, 8 + y, y % 3 ? '#d9b75a' : '#b8963e');
    a.hline(0, 31, 24, '#8a6e2e');
    a.rect(13, 34, 7, 12, '#2a1c12'); a.rect(6, 30, 4, 4, '#ffd27a'); a.rect(22, 30, 4, 4, '#ffd27a');
    a.px(16, 6, '#d9b75a'); a.px(15, 5, WOOD_D);
  },
  tent: (a) => {
    a.shadow(16, 30, 15, 2);
    for (let y = 0; y < 24; y++) { const half = Math.round(y * 0.62); a.hline(16 - half, 16 + half, 6 + y, y < 23 ? '#c9b78a' : '#9c8a5e'); }
    for (let y = 0; y < 24; y++) a.px(16, 6 + y, '#9c8a5e');
    for (let y = 14; y < 30; y++) { const half = Math.round((y - 14) * 0.35); a.hline(16 - half, 16 + half, y, '#2a1c12'); }
    a.vline(16, 2, 6, WOOD_D); a.rect(17, 2, 4, 3, '#c23b32');
  },
  banner: (a) => {
    a.shadow(8, 30, 3, 1);
    a.vline(4, 2, 30, WOOD_D); a.px(4, 1, '#f2c14e');
    a.rect(5, 3, 8, 12, '#c23b32'); a.hline(5, 12, 3, '#e2574c'); a.px(6, 15, '#c23b32'); a.px(9, 16, '#c23b32'); a.px(12, 15, '#c23b32');
    a.rect(7, 7, 4, 4, '#f2c14e');
  },
  torch: (a) => {
    a.shadow(8, 30, 2, 1);
    a.vline(8, 10, 30, WOOD); a.vline(7, 12, 30, WOOD_D);
    a.rect(6, 8, 4, 3, '#4a4a52');
    a.ellipse(8, 5, 2.5, 3.5, '#ff7a2a'); a.ellipse(8, 6, 1.5, 2, '#ffd04a'); a.px(8, 1, '#ff7a2a');
  },
  hay: (a) => {
    a.shadow(8, 14, 7, 1.5);
    a.rect(1, 5, 14, 9, '#d9b75a'); a.hline(1, 14, 5, '#f0d27a'); a.hline(1, 14, 13, '#a8862e');
    for (const x of [3, 7, 11]) a.vline(x, 6, 12, '#b8963e');
    a.vline(5, 5, 13, '#8a5a34'); a.vline(10, 5, 13, '#8a5a34');
  },
  cart: (a) => {
    a.shadow(16, 14, 14, 1.5);
    a.rect(4, 4, 22, 6, WOOD); a.hline(4, 25, 4, WOOD_L); a.hline(4, 25, 9, WOOD_D);
    a.rect(6, 1, 6, 3, '#d9b75a'); a.rect(13, 2, 5, 2, '#5f9f3a'); a.rect(19, 1, 4, 3, '#c23b32');
    a.line(26, 7, 31, 9, WOOD_D);
    a.ellipse(9, 12, 3, 3, '#4a3020', '#2a1c12'); a.ellipse(21, 12, 3, 3, '#4a3020', '#2a1c12'); a.px(9, 12, STONE_L); a.px(21, 12, STONE_L);
  },
  stall: (a) => {
    a.shadow(16, 30, 15, 1.5);
    a.vline(2, 8, 30, WOOD_D); a.vline(29, 8, 30, WOOD_D);
    for (let x = 0; x < 32; x++) for (let y = 3; y < 9; y++) a.px(x, y, Math.floor(x / 4) % 2 ? '#f5f0e0' : '#c23b32');
    a.hline(0, 31, 9, '#8a1e1e');
    a.rect(2, 20, 28, 6, WOOD); a.hline(2, 29, 20, WOOD_L);
    a.rect(5, 17, 4, 3, '#e2574c'); a.rect(11, 17, 3, 3, '#f2c14e'); a.rect(16, 16, 5, 4, '#6cc551'); a.rect(23, 17, 4, 3, '#b56cff');
  },
  bench: (a) => {
    a.shadow(8, 14, 7, 1);
    a.rect(1, 7, 14, 2, WOOD_L); a.rect(1, 4, 14, 2, WOOD); a.hline(1, 14, 9, WOOD_D);
    a.vline(2, 9, 13, WOOD_D); a.vline(13, 9, 13, WOOD_D);
  },
  gravestone: (a) => {
    a.shadow(8, 14, 5, 1);
    a.rect(4, 4, 8, 10, STONE); a.ellipse(8, 4, 4, 2.5, STONE); a.vline(4, 4, 13, STONE_D); a.hline(4, 11, 13, STONE_D);
    a.vline(8, 6, 10, STONE_D); a.hline(6, 10, 7, STONE_D); a.px(5, 14, LEAF); a.px(11, 14, LEAF_L);
  },
  bones: (a) => {
    a.line(2, 10, 9, 7, '#e8e4d4'); a.px(1, 10, '#e8e4d4'); a.px(10, 7, '#e8e4d4');
    a.line(7, 13, 13, 11, '#d8d4c4');
    a.ellipse(12, 6, 2.5, 2, '#e8e4d4'); a.px(11, 6, OUT); a.px(13, 6, OUT);
  },
  stump: (a) => {
    a.shadow(8, 13, 6, 1.5);
    a.rect(4, 7, 8, 6, WOOD); a.vline(4, 7, 12, WOOD_D); a.ellipse(8, 7, 4, 2, '#c9955a', WOOD_D); a.px(8, 7, WOOD_D);
    a.px(3, 12, WOOD_D); a.px(12, 12, WOOD_D);
  },
  mushrooms: (a) => {
    for (const [x, y, c] of [[4, 9, '#c23b32'], [10, 6, '#e2574c'], [12, 12, '#c9955a']] as [number, number, string][]) {
      a.vline(x, y, y + 3, '#f5f0e0'); a.hline(x - 2, x + 2, y, c); a.hline(x - 1, x + 1, y - 1, c); a.px(x - 1, y, '#ffffff');
    }
  },
  totem: (a) => {
    a.shadow(8, 30, 4, 1);
    a.rect(4, 4, 8, 27, '#7a4a28'); a.vline(4, 4, 30, '#4a2a14');
    a.rect(5, 6, 6, 5, '#3f8f35'); a.px(6, 8, '#ffd04a'); a.px(9, 8, '#ffd04a'); a.hline(6, 9, 10, '#f5f0e0');
    a.rect(5, 15, 6, 5, '#c23b32'); a.px(6, 17, OUT); a.px(9, 17, OUT);
    a.rect(2, 22, 12, 2, '#7a4a28'); a.px(1, 21, '#f5f0e0'); a.px(14, 21, '#f5f0e0');
    a.px(5, 2, '#f5f0e0'); a.px(10, 2, '#f5f0e0'); a.px(4, 1, '#f5f0e0'); a.px(11, 1, '#f5f0e0');
  },
  spikes: (a) => {
    for (const x of [2, 7, 12]) { a.line(x, 14, x + 2, 4, WOOD); a.px(x + 2, 3, WOOD_L); }
    a.hline(0, 15, 13, WOOD_D); a.hline(0, 15, 14, '#3a2414');
  },
};
