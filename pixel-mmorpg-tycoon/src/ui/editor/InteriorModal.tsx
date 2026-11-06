import { useEffect, useRef, useState } from 'react';
import { FURNITURE, getFurniture, interiorSize } from '@/data/furniture';
import { getObjectDef } from '@/data/objects';
import { t } from '@/i18n';
import type { Furniture, FurnitureKind, MapObject } from '@/models/entities';
import type { GameSession } from '@/session/GameSession';
import { audio } from '@/audio/AudioEngine';
import { toast } from '@/stores/toastStore';
import { Modal } from '../components/Modal';
import { SpritePreview } from '../components/SpritePreview';
import { useEntity } from '../hooks/useEntities';
import { useSimTick } from '../sim/useSimTick';

const CELL = 40;

/** Pixel furniture, drawn into a CELL×CELL square at (x, y). */
export function drawFurniture(g: CanvasRenderingContext2D, kind: FurnitureKind, x: number, y: number, time = 0): void {
  const r = (dx: number, dy: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h); };
  switch (kind) {
    case 'spawn': {
      const glow = 0.6 + 0.4 * Math.sin(time / 300);
      r(8, 26, 24, 8, '#3a3f5c');
      r(12, 6, 16, 22, '#5aa9e6');
      r(15, 9, 10, 16, `rgba(220,245,255,${glow})`);
      r(18, 2, 4, 4, '#ffffff');
      break;
    }
    case 'bed': r(4, 6, 32, 30, '#6b3f22'); r(6, 8, 28, 10, '#f2f2f2'); r(6, 18, 28, 16, '#b02e3a'); r(6, 18, 28, 3, '#d9485a'); break;
    case 'table': r(4, 10, 32, 18, '#8a5a34'); r(4, 10, 32, 4, '#a8733f'); r(6, 28, 4, 8, '#5a381d'); r(30, 28, 4, 8, '#5a381d'); r(16, 14, 8, 6, '#e8d9a8'); break;
    case 'chair': r(12, 6, 16, 10, '#7a4c28'); r(12, 16, 16, 8, '#a8733f'); r(12, 24, 3, 10, '#5a381d'); r(25, 24, 3, 10, '#5a381d'); break;
    case 'counter': r(0, 12, 40, 22, '#6b4226'); r(0, 12, 40, 5, '#9c6a3c'); r(6, 4, 6, 8, '#d9b44a'); r(26, 6, 6, 6, '#5aa9e6'); break;
    case 'barrel': r(10, 6, 20, 30, '#8a5a34'); r(10, 10, 20, 3, '#555'); r(10, 28, 20, 3, '#555'); r(12, 6, 16, 3, '#a8733f'); break;
    case 'fireplace': {
      r(2, 2, 36, 36, '#6e6e78'); r(4, 4, 32, 4, '#8a8a96'); r(8, 14, 24, 22, '#1c1c22');
      const f = Math.floor(time / 150) % 2;
      r(12, 24 - f * 2, 16, 12 + f * 2, '#f2a03a'); r(16, 20 - f, 8, 10, '#ffd23f'); break;
    }
    case 'rug': r(2, 6, 36, 28, '#7b2d55'); r(6, 10, 28, 20, '#b04a7a'); r(14, 16, 12, 8, '#f2c14e'); break;
    case 'plant': r(14, 24, 12, 12, '#a0522d'); r(10, 8, 8, 16, '#3f8f3a'); r(20, 4, 8, 20, '#6cc551'); r(16, 12, 8, 8, '#4caf50'); break;
    case 'shelf': r(4, 2, 32, 36, '#6b4226'); for (const yy of [6, 18, 30]) { r(6, yy, 28, 3, '#9c6a3c'); r(8, yy - 6, 5, 6, '#5aa9e6'); r(16, yy - 5, 4, 5, '#e2574c'); r(24, yy - 6, 6, 6, '#f2c14e'); } break;
  }
}

/** Walk into a building: place furniture (beds, spawn point…) and see who is inside. */
export function InteriorModal({ session, objectId, onClose }: { session: GameSession; objectId: string; onClose: () => void }) {
  useSimTick(500);
  const o = useEntity(session, 'objects', objectId) as MapObject | undefined;
  const [tool, setTool] = useState<FurnitureKind | 'erase'>('bed');
  const canvas = useRef<HTMLCanvasElement>(null);
  const size = interiorSize(o?.kind ?? 'house_small');
  const furniture = o?.interior?.furniture ?? [];
  const guests = o ? session.guestsOf(o) : [];

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = canvas.current;
      if (c) {
        const g = c.getContext('2d')!;
        g.imageSmoothingEnabled = false;
        for (let y = 0; y < size.h; y++) for (let x = 0; x < size.w; x++) {
          const wall = y === 0 || x === 0 || x === size.w - 1;
          g.fillStyle = wall ? (y === 0 ? '#5b4636' : '#4a3a2c') : (x + y) % 2 ? '#8a5f3a' : '#94683f';
          g.fillRect(x * CELL, y * CELL, CELL, CELL);
          if (!wall) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x * CELL, y * CELL + CELL - 2, CELL, 2); }
          if (y === 0 && x % 3 === 1) { g.fillStyle = '#9fd3ff'; g.fillRect(x * CELL + 10, 8, 20, 16); g.fillStyle = '#5b4636'; g.fillRect(x * CELL + 19, 8, 2, 16); }
        }
        // Door at the bottom centre.
        const dx = Math.floor(size.w / 2);
        g.fillStyle = '#2a1c12';
        g.fillRect(dx * CELL + 4, (size.h - 1) * CELL + 20, CELL - 8, 20);
        for (const f of furniture) drawFurniture(g, f.kind, f.x * CELL, f.y * CELL, performance.now());
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [furniture, size.w, size.h]);

  if (!o) return null;
  const def = getObjectDef(o.kind);

  const save = (next: Furniture[], label: string) => {
    session.entities.lastError = null;
    session.entities.update('objects', o.id, { interior: { furniture: next } }, label);
    const err = session.entities.lastError;
    if (err) toast(err, 'error');
    else audio.play('place');
  };

  const click = (e: React.MouseEvent<HTMLCanvasElement>, erase = false) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * size.w);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * size.h);
    if (x <= 0 || x >= size.w - 1 || y <= 0 || y >= size.h) return;
    const here = furniture.find((f) => f.x === x && f.y === y);
    if (erase || tool === 'erase') { if (here) save(furniture.filter((f) => f !== here), t('Remove furniture')); return; }
    if (y === size.h - 1 && x === Math.floor(size.w / 2)) { toast(t('Keep the door free.'), 'error'); return; }
    if (tool === 'spawn' && furniture.some((f) => f.kind === 'spawn' && f !== here)) { toast(t('One spawn point per building.'), 'error'); return; }
    const rest = furniture.filter((f) => f !== here);
    save([...rest, { kind: tool, x, y }], t('Place {name}', { name: t(getFurniture(tool).name) }));
  };

  // Guests sit at beds, then chairs/tables, then anywhere.
  const seats = [...furniture.filter((f) => f.kind === 'bed'), ...furniture.filter((f) => f.kind === 'chair' || f.kind === 'table')];
  const hasSpawn = furniture.some((f) => f.kind === 'spawn');
  const hasBed = furniture.some((f) => f.kind === 'bed');

  return (
    <Modal title={`${o.name ?? t(def?.name ?? '')} · ${t('Inside')}`} onClose={onClose} width={Math.min(980, size.w * CELL + 300)}
      actions={<button className="btn" onClick={onClose}>{t('Leave the building')}</button>}>
      <div className="interior">
        <div className="interior-room" style={{ width: size.w * CELL, height: size.h * CELL }}>
          <canvas ref={canvas} width={size.w * CELL} height={size.h * CELL} onClick={(e) => click(e)} onContextMenu={(e) => click(e, true)} />
          {guests.slice(0, 24).map((p, i) => {
            const s = seats[i % Math.max(1, seats.length)];
            const x = s ? s.x : 1 + (i % (size.w - 2));
            const y = s ? s.y : 1 + Math.floor(i / (size.w - 2));
            return <div key={p.id} className="interior-guest" style={{ left: x * CELL + (i >= seats.length ? 0 : 4), top: y * CELL - 8 }} title={`${p.name} · ${t('Lv')} ${p.level}`}><SpritePreview frame={`pl:${p.classKey}:0`} box={32} /></div>;
          })}
        </div>
        <div className="interior-side">
          <div className="el-title">{t('Furniture')}</div>
          <div className="furniture-grid">
            {FURNITURE.map((f) => (
              <button key={f.key} className={`sprite-btn ${tool === f.key ? 'active' : ''}`} onClick={() => setTool(f.key)} title={f.hint ? t(f.hint) : t(f.name)}>
                <FurnitureIcon kind={f.key} />
                <span>{t(f.name)}{session.studio.standard ? ` · $${f.cost}` : ''}</span>
              </button>
            ))}
            <button className={`sprite-btn ${tool === 'erase' ? 'active' : ''}`} onClick={() => setTool('erase')}><span>✕ {t('Erase')}</span></button>
          </div>
          <div className="hint">{t('Click to place, right-click to remove.')}</div>
          <div className={`feedback ${hasSpawn ? 'good' : ''}`}>
            <b>{hasSpawn ? t('Players spawn here') : t('No spawn point')}</b>
            <div className="hint">{t('With a spawn point, players log in inside and walk out of the door — perfect for a tavern in town.')}</div>
          </div>
          {(o.kind === 'hotel' || o.kind === 'tavern') && hasBed && (
            <div className="feedback good">
              <b>{t('Rooms rented: {a} / {b}', { a: furniture.filter((f) => f.kind === 'bed' && f.ownerId && session.players.get(f.ownerId)).length, b: furniture.filter((f) => f.kind === 'bed').length })}</b>
              <div className="hint">{furniture.filter((f) => f.kind === 'bed' && f.ownerId).map((f) => session.players.get(f.ownerId!)?.name).filter(Boolean).slice(0, 8).join(', ') || t('Every bed is a room players can rent.')}</div>
            </div>
          )}
          <div className={`feedback ${hasBed ? 'good' : ''}`}>
            <b>{t('Guests inside: {n}', { n: guests.length })}</b>
            <div className="hint">{hasBed ? t('Tired players come in to rest by the beds.') : t('Add beds so tired players come in to rest.')}</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function FurnitureIcon({ kind }: { kind: FurnitureKind }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, CELL, CELL);
    drawFurniture(g, kind, 0, 0, 0);
  }, [kind]);
  return <canvas ref={ref} width={CELL} height={CELL} style={{ width: 28, height: 28, imageRendering: 'pixelated' }} />;
}
