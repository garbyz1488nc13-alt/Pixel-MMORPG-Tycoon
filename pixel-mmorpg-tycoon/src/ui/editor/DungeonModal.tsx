import { useEffect, useRef } from 'react';
import { t } from '@/i18n';
import type { GameSession } from '@/session/GameSession';
import { ROOMS, type DungeonLayout } from '@/simulation/social/DungeonService';
import { Modal } from '../components/Modal';
import { SpritePreview } from '../components/SpritePreview';
import { useEntity } from '../hooks/useEntities';
import { useSimTick } from '../sim/useSimTick';

const CELL = 20;

/** Where the party is: walking along the room path, 0..1. */
function partyPos(l: DungeonLayout, f: number): { x: number; y: number } {
  const seg = f * (l.path.length - 1);
  const i = Math.min(l.path.length - 2, Math.floor(seg)), k = seg - i;
  const a = l.path[i], b = l.path[i + 1];
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

function draw(g: CanvasRenderingContext2D, l: DungeonLayout, cleared: number, time: number) {
  const wall = l.cave ? ['#3b3128', '#4a3d31'] : ['#2b2b38', '#3a3a4a'];
  const floor = l.cave ? ['#6b5a45', '#735f49'] : ['#55556a', '#5c5c72'];
  for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) {
    const f = l.floor[y * l.w + x];
    const X = x * CELL, Y = y * CELL;
    if (f) {
      g.fillStyle = floor[(x + y) % 2]; g.fillRect(X, Y, CELL, CELL);
      if (!l.cave) { g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(X, Y + CELL - 1, CELL, 1); g.fillRect(X + CELL - 1, Y, 1, CELL); }
    } else {
      // Walls: bricks next to the floor, dark rock further away.
      const edge = [[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => l.floor[(y + dy) * l.w + x + dx]);
      g.fillStyle = edge ? wall[1] : '#16131c'; g.fillRect(X, Y, CELL, CELL);
      if (edge && !l.cave) { g.fillStyle = wall[0]; g.fillRect(X, Y + 6, CELL, 2); g.fillRect(X, Y + 14, CELL, 2); g.fillRect(X + ((y % 2) ? 6 : 14), Y, 2, 6); g.fillRect(X + ((y % 2) ? 14 : 6), Y + 8, 2, 6); }
      if (edge && l.cave) { g.fillStyle = wall[0]; g.fillRect(X + 3, Y + 4, 6, 5); g.fillRect(X + 11, Y + 11, 5, 5); }
    }
  }
  // Torches on room corners.
  const flick = 0.6 + 0.4 * Math.sin(time / 120);
  l.rooms.forEach((r, i) => {
    for (const [tx, ty] of [[r.x - 1, r.y - 1], [r.x + r.w, r.y - 1]]) {
      g.fillStyle = '#6b4226'; g.fillRect(tx * CELL + 8, ty * CELL + 8, 4, 10);
      g.fillStyle = `rgba(255,190,60,${flick})`; g.fillRect(tx * CELL + 6, ty * CELL + 2, 8, 8);
    }
    // Monsters: alive until the party clears the room.
    const boss = i === l.rooms.length - 1;
    const alive = i >= cleared;
    const n = boss ? 1 : 2 + (i % 2);
    for (let k = 0; k < n; k++) {
      const mx = (r.x + 1 + ((k * 2) % Math.max(1, r.w - 2))) * CELL, my = (r.y + 1 + (k % 2)) * CELL;
      const s = boss ? 2 : 1;
      if (alive) {
        g.fillStyle = boss ? '#8b1e3f' : '#b03a2e'; g.fillRect(mx + 2, my + 4, 14 * s, 12 * s);
        g.fillStyle = '#ffd23f'; g.fillRect(mx + 5, my + 7, 2 * s, 2 * s); g.fillRect(mx + 11 * s, my + 7, 2 * s, 2 * s);
        if (boss) { g.fillStyle = '#f2c14e'; g.fillRect(mx + 6, my - 2, 18, 4); g.fillRect(mx + 6, my - 6, 3, 4); g.fillRect(mx + 13, my - 6, 3, 4); g.fillRect(mx + 21, my - 6, 3, 4); }
      } else { g.fillStyle = '#d8d0c0'; g.fillRect(mx + 4, my + 12, 10, 3); g.fillRect(mx + 7, my + 9, 4, 3); }
    }
    if (boss) { g.fillStyle = '#f2c14e'; g.fillRect((r.x + r.w - 2) * CELL + 4, (r.y + r.h - 2) * CELL + 6, 12, 10); g.fillStyle = '#8a5a34'; g.fillRect((r.x + r.w - 2) * CELL + 4, (r.y + r.h - 2) * CELL + 6, 12, 3); }
  });
  // Entrance stairs.
  const st = l.path[0];
  g.fillStyle = '#9fd3ff'; for (let i = 0; i < 3; i++) g.fillRect((st.x - 1) * CELL + i * 4, (st.y + 1) * CELL + i * 4, CELL * 2 - i * 8, 3);
}

/** A dungeon's own location: walls, rooms, monsters, the boss — and the party inside, live. */
export function DungeonModal({ session, objectId, onClose }: { session: GameSession; objectId: string; onClose: () => void }) {
  useSimTick(300);
  const o = useEntity(session, 'objects', objectId);
  const canvas = useRef<HTMLCanvasElement>(null);
  const svc = session.dungeons;
  const layout = o ? svc.layout(o) : null;
  const run = svc.runs.find((r) => r.entranceId === objectId);
  const f = run ? svc.progress(run) : 0;
  const inside = run?.phase === 'inside';
  const roomsCleared = inside ? Math.floor(f * ROOMS) : 0;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const g = canvas.current?.getContext('2d');
      if (g && layout) draw(g, layout, roomsCleared, performance.now());
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [layout, roomsCleared]);

  if (!o || !layout) return null;
  const st = session.runtime.sim.dungeonStats?.[o.id] ?? { runs: 0, clears: 0, wipes: 0 };
  const pos = partyPos(layout, inside ? f : 0);
  const members = (run?.members ?? []).map((id) => session.players.get(id)).filter((p) => !!p);
  return (
    <Modal title={`${t(svc.nameOf(o))} · ${t('Lv')} ${svc.levelOf(o)}`} onClose={onClose} width={layout.w * CELL + 40}
      actions={<button className="btn" onClick={onClose}>{t('Leave the dungeon')}</button>}>
      <div style={{ position: 'relative', width: layout.w * CELL, height: layout.h * CELL, margin: '0 auto' }}>
        <canvas ref={canvas} width={layout.w * CELL} height={layout.h * CELL} style={{ imageRendering: 'pixelated' }} />
        {inside && members.map((p, i) => (
          <div key={p!.id} style={{ position: 'absolute', left: (pos.x + (i % 3) * 0.7 - 0.7) * CELL - 6, top: (pos.y + Math.floor(i / 3) * 0.8 - 0.8) * CELL - 10, transition: 'left .3s linear, top .3s linear' }} title={`${p!.name} · ${t('Lv')} ${p!.level}`}>
            <SpritePreview frame={`pl:${p!.classKey}:0`} box={24} />
          </div>
        ))}
      </div>
      <div className="kv"><span>{t('Party inside')}</span><span>{inside ? `${members.map((p) => p!.name).join(', ')} · ${t('room {a} / {b}', { a: Math.min(ROOMS, roomsCleared + 1), b: ROOMS })}` : run ? t('A party is gathering at the entrance…') : t('Nobody inside right now.')}</span></div>
      <div className="kv"><span>{t('Runs / cleared / wiped')}</span><span>{st.runs} / {st.clears} / {st.wipes}</span></div>
      <div className="hint">{t('Each dungeon is its own location: players vanish from the world map while they fight through the rooms to the boss.')}</div>
    </Modal>
  );
}
