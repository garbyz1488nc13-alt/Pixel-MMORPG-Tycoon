import type { ReactNode } from 'react';
import { DIFFICULTIES, WORLD_TYPES } from '@/data/worldPresets';
import type { WorldMeta } from '@/models/world';
import { formatGameTime } from '@/simulation/time';

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function WorldCard({ world, children, selected, onClick }: { world: WorldMeta; children?: ReactNode; selected?: boolean; onClick?: () => void }) {
  return (
    <div className={`world-card panel ${selected ? 'selected' : ''} ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="world-thumb">{world.thumbnail ? <img src={world.thumbnail} alt="" /> : <div className="hint">no preview</div>}</div>
      <div className="world-info">
        <div className="world-name">{world.name}</div>
        <div className="hint">
          {WORLD_TYPES.find((t) => t.key === world.worldType)?.label ?? world.worldType} · {world.width}×{world.height} ·{' '}
          {DIFFICULTIES.find((d) => d.key === world.difficulty)?.label ?? world.difficulty}
        </div>
        <div className="hint">{formatGameTime(world.totalMinutes)} · saved {formatDate(world.updatedAt)}</div>
        {children && <div className="world-actions">{children}</div>}
      </div>
    </div>
  );
}
