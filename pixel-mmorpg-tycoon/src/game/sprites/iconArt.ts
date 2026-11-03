import type { ArtCanvas } from './ArtCanvas';

/** 16×16 item icons. */
const O = '#1a1020';
const STEEL = '#c8d0d8', STEEL_D = '#7f8893', WOOD = '#8a5a34', WOOD_D = '#5e3b20', GOLD = '#f2c14e', GOLD_D = '#b0832a';

function blade(a: ArtCanvas, len: number, w: number, color = STEEL, dark = STEEL_D) {
  for (let i = 0; i < len; i++) {
    const x = 3 + i, y = 12 - i;
    a.px(x, y, color);
    if (w > 1) a.px(x + 1, y, dark);
  }
  a.px(3 + len, 12 - len, '#ffffff');
}

function bottle(a: ArtCanvas, liquid: string, light: string) {
  a.rect(6, 2, 4, 2, '#d8d0c0'); a.rect(7, 1, 2, 1, WOOD);
  a.ellipse(8, 10, 5, 4.5, liquid, O);
  a.rect(6, 4, 4, 3, liquid); a.vline(5, 4, 6, O); a.vline(10, 4, 6, O);
  a.px(6, 8, light); a.px(6, 9, light); a.px(7, 7, '#ffffff');
}

export const ICON_ART: Record<string, (a: ArtCanvas) => void> = {
  sword: (a) => { blade(a, 9, 2); a.line(2, 10, 6, 14, GOLD_D); a.px(2, 13, WOOD_D); a.px(1, 14, WOOD_D); a.px(3, 12, WOOD); },
  longsword: (a) => { blade(a, 11, 2, '#e0e8f0'); a.line(1, 10, 6, 15, GOLD); a.px(1, 14, WOOD_D); a.px(0, 15, GOLD); a.px(2, 13, WOOD); },
  dagger: (a) => { blade(a, 6, 2); a.line(4, 10, 7, 13, GOLD_D); a.px(3, 13, WOOD_D); a.px(2, 14, WOOD_D); },
  staff: (a) => { a.line(3, 14, 11, 4, WOOD); a.line(4, 14, 12, 4, WOOD_D); a.ellipse(12, 3, 2.5, 2.5, '#7fd7ff', '#3a6aa8'); a.px(11, 2, '#ffffff'); },
  bow: (a) => { for (let i = 0; i < 12; i++) { const y = 2 + i; const x = 4 + Math.round(Math.sin((i / 11) * Math.PI) * 6); a.px(x, y, WOOD); a.px(x + 1, y, WOOD_D); } a.vline(4, 2, 13, '#e8e4d4'); },
  mace: (a) => { a.line(3, 14, 9, 8, WOOD); a.ellipse(10.5, 5.5, 3.5, 3.5, STEEL, STEEL_D); a.px(10, 1, STEEL); a.px(14, 5, STEEL); a.px(10, 9, STEEL_D); a.px(9, 4, '#ffffff'); },
  helmet: (a) => { a.ellipse(8, 8, 6, 6, STEEL, STEEL_D); a.rect(2, 9, 12, 5, STEEL); a.outlineRect(2, 9, 12, 5, STEEL_D); a.rect(5, 9, 6, 2, O); a.vline(8, 9, 13, STEEL_D); a.px(5, 4, '#ffffff'); },
  cap: (a) => { a.ellipse(8, 9, 6, 5, '#9a6a3a', '#5e3b20'); a.rect(1, 10, 14, 2, '#7a5230'); a.px(5, 6, '#c08a5a'); },
  tunic: (a) => { a.rect(4, 3, 8, 11, '#9a6a3a'); a.rect(1, 3, 3, 5, '#9a6a3a'); a.rect(12, 3, 3, 5, '#9a6a3a'); a.outlineRect(4, 3, 8, 11, '#5e3b20'); a.rect(6, 3, 4, 2, '#5e3b20'); a.hline(4, 11, 9, '#5e3b20'); },
  plate: (a) => { a.rect(3, 3, 10, 11, STEEL); a.rect(1, 3, 3, 4, STEEL_D); a.rect(12, 3, 3, 4, STEEL_D); a.outlineRect(3, 3, 10, 11, STEEL_D); a.vline(8, 4, 12, STEEL_D); a.hline(4, 11, 8, STEEL_D); a.px(5, 5, '#ffffff'); a.px(8, 3, GOLD); },
  boots: (a) => { a.rect(3, 4, 4, 8, '#6e4a2c'); a.rect(3, 11, 6, 3, '#6e4a2c'); a.rect(9, 3, 4, 8, '#8a5a34'); a.rect(9, 10, 6, 3, '#8a5a34'); a.hline(3, 8, 14, O); a.hline(9, 14, 13, O); },
  potion_red: (a) => bottle(a, '#d23a3a', '#ff8a7a'),
  potion_blue: (a) => bottle(a, '#3a6ad2', '#8ab0ff'),
  elixir: (a) => { bottle(a, '#b56cff', '#e0c0ff'); a.px(12, 3, GOLD); a.px(13, 2, GOLD); a.px(3, 5, GOLD); },
  log: (a) => { a.rect(1, 6, 13, 6, WOOD); a.hline(1, 13, 6, '#a77a48'); a.hline(1, 13, 11, WOOD_D); a.ellipse(13, 9, 2.5, 3, '#c9a06a', WOOD_D); a.px(13, 9, WOOD_D); },
  stone: (a) => { a.ellipse(8, 9, 6, 5, '#8d8f96', '#5f6168'); a.ellipse(6, 7, 2.5, 1.5, '#b4b6bc'); },
  ore: (a) => { a.ellipse(8, 9, 6, 5, '#6e6a62', '#45423c'); for (const [x, y] of [[6, 7], [9, 9], [10, 7], [6, 11]]) a.px(x, y, '#d88a4a'); a.px(8, 8, '#f2c14e'); },
  wheat: (a) => { for (const x of [5, 8, 11]) { a.vline(x, 6, 14, '#c9a64a'); for (let y = 2; y < 7; y++) { a.px(x - 1, y, GOLD); a.px(x + 1, y + 1, GOLD_D); } } a.hline(4, 12, 11, '#8a6a2a'); },
  berries: (a) => { for (const [x, y] of [[6, 8], [9, 7], [8, 10], [11, 10], [5, 11]]) a.ellipse(x, y, 1.6, 1.6, '#c8344a', '#7a1a2a'); a.line(8, 3, 9, 6, '#3f8f35'); a.px(10, 3, '#66b84a'); },
  herb: (a) => { a.vline(8, 6, 14, '#2a6a26'); for (const [dx, y] of [[-3, 5], [3, 7], [-3, 9], [3, 11]]) a.ellipse(8 + dx, y, 2.5, 1.4, '#66b84a', '#2a6a26'); },
  ingot: (a) => { for (let y = 7; y < 12; y++) a.hline(2 + (11 - y), 13 - (11 - y) + 1, y, '#a8b0b8'); a.hline(4, 12, 7, '#d8dde2'); a.hline(1, 14, 12, STEEL_D); },
  leather: (a) => { a.rect(3, 3, 10, 10, '#a06a3a'); a.outlineRect(3, 3, 10, 10, '#5e3b20'); a.px(3, 3, ''); a.line(4, 4, 11, 11, '#8a5a2a'); a.px(6, 9, '#c08a5a'); },
  cloth: (a) => { a.rect(2, 4, 12, 9, '#c8b8a0'); for (let x = 2; x < 14; x += 2) a.vline(x, 4, 12, '#a89880'); a.hline(2, 13, 12, '#7a6a58'); },
  gel: (a) => { a.ellipse(8, 10, 5.5, 4, '#5ac84a', '#2a6a26'); a.ellipse(6, 8.5, 1.8, 1.2, '#b8f0a0'); a.px(11, 12, '#2a6a26'); },
  pelt: (a) => { a.ellipse(8, 8, 6, 5.5, '#8d8f96', '#5f6168'); a.rect(2, 4, 2, 3, '#8d8f96'); a.rect(12, 4, 2, 3, '#8d8f96'); a.rect(2, 10, 2, 3, '#8d8f96'); a.rect(12, 10, 2, 3, '#8d8f96'); for (const y of [6, 8, 10]) a.hline(6, 10, y, '#b4b6bc'); },
  bone: (a) => { a.line(4, 12, 12, 4, '#e8e4d4'); a.line(5, 12, 13, 4, '#c8c4b4'); for (const [x, y] of [[3, 12], [4, 13], [12, 3], [13, 4]]) a.ellipse(x, y, 1.4, 1.4, '#f5f0e0', '#a8a494'); },
  ear: (a) => { a.ellipse(8, 9, 4, 5, '#6fae3a', '#2f4a1a'); a.line(8, 4, 12, 1, '#6fae3a'); a.ellipse(8, 9, 2, 3, '#4a7a2a'); },
  silk: (a) => { a.ellipse(8, 8, 5, 5, '#f0f0f8', '#a8a8c0'); a.line(3, 5, 13, 11, '#c8c8d8'); a.line(3, 11, 13, 5, '#c8c8d8'); a.line(8, 13, 9, 15, '#d8d8e8'); },
  scale: (a) => { for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) a.ellipse(4 + x * 4 + (y % 2) * 2, 4 + y * 4, 2.2, 2.2, '#d23a3a', '#7a1a14'); a.px(5, 3, '#ff8a6a'); },
  bread: (a) => { a.ellipse(8, 9, 6.5, 4, '#c9883a', '#7a4a1a'); for (const x of [5, 8, 11]) a.line(x, 7, x + 1, 9, '#f0c080'); },
  apple: (a) => { a.ellipse(8, 9, 5, 5, '#d23a3a', '#7a1a1a'); a.px(6, 7, '#ff9a8a'); a.vline(8, 2, 5, WOOD_D); a.ellipse(10, 3, 2, 1, '#66b84a'); },
  meat: (a) => { a.ellipse(9, 7, 5, 4, '#b8442a', '#6a2214'); a.ellipse(8, 6, 2, 1.5, '#e07a5a'); a.line(5, 10, 2, 13, '#f5f0e0'); a.px(1, 13, '#f5f0e0'); a.px(2, 14, '#f5f0e0'); },
  fish: (a) => { a.ellipse(7, 8, 5, 3, '#8ab0d0', '#3a5a7a'); a.line(12, 8, 14, 5, '#3a5a7a'); a.line(12, 8, 14, 11, '#3a5a7a'); a.px(4, 7, O); a.hline(5, 9, 9, '#c8a060'); },
  ring: (a) => { a.ellipse(8, 9, 5, 5, GOLD, GOLD_D); a.ellipse(8, 9, 3, 3, ''); a.ellipse(8, 4, 2, 2, '#5aa9e6', '#2a5a8a'); },
  amulet: (a) => { a.line(3, 2, 8, 8, GOLD_D); a.line(13, 2, 8, 8, GOLD_D); a.ellipse(8, 11, 3.5, 3.5, '#d23a3a', GOLD); a.px(7, 10, '#ff9a8a'); },
  letter: (a) => { a.rect(2, 4, 12, 9, '#efe0bc'); a.outlineRect(2, 4, 12, 9, '#9a7a52'); a.line(2, 4, 8, 9, '#9a7a52'); a.line(13, 4, 8, 9, '#9a7a52'); a.ellipse(8, 9, 1.6, 1.6, '#c23b32'); },
  relic: (a) => { a.rect(5, 4, 6, 9, '#4a3a6a'); a.outlineRect(5, 4, 6, 9, '#b56cff'); a.ellipse(8, 8, 1.8, 1.8, '#e0c8ff'); a.px(3, 3, '#e0c8ff'); a.px(13, 12, '#e0c8ff'); a.hline(4, 11, 13, GOLD); },
  torch: (a) => { a.line(5, 14, 9, 6, WOOD); a.ellipse(10, 4, 2.5, 3, '#ff7a2a'); a.ellipse(10, 5, 1.2, 1.5, '#ffd04a'); },
  map: (a) => { a.rect(2, 3, 12, 10, '#e8d4a8'); a.outlineRect(2, 3, 12, 10, '#9a7a52'); a.line(4, 10, 7, 6, '#9a7a52'); a.line(7, 6, 11, 8, '#9a7a52'); a.px(11, 7, '#c23b32'); a.px(10, 8, '#c23b32'); },
  coin: (a) => { a.ellipse(8, 8, 5.5, 5.5, GOLD, GOLD_D); a.ellipse(8, 8, 3, 3, '#ffe08a'); a.vline(8, 6, 10, GOLD_D); },
};
