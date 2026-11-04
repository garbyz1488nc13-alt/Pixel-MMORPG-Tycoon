import type { TileGrid } from '@/models/TileGrid';
import { t } from '@/i18n';
import type { SaveSlotKey, WorldSave } from '@/models/world';
import { WorldRepository } from '@/persistence/WorldRepository';
import { createWorldSave, type NewWorldOptions } from '@/systems/generation/createWorld';
import { makeThumbnail } from '@/game/textures/mapImage';
import { TileGrid as Grid } from '@/models/TileGrid';
import { formatGameTime } from '@/simulation/time';
import { WORLD_TYPES } from '@/data/worldPresets';
import { log, useLogStore } from '@/stores/logStore';
import { useSessionStore } from '@/stores/sessionStore';
import { GameSession } from './GameSession';
import { generateStarterContent } from '@/systems/generation/Populate';
import { EventService } from '@/simulation/events/EventService';

function focusFirstRegion(session: GameSession): void {
  const reg = session.runtime.entities.list('regions')[0];
  if (!reg) return;
  session.runtime.camera = { x: reg.x + reg.w / 2, y: reg.y + reg.h / 2, zoom: 1 };
}

/** Open a world save in the editor (closing any open world first). */
export function openWorld(save: WorldSave, slot: SaveSlotKey): GameSession {
  closeWorld();
  useLogStore.getState().clear();
  const session = new GameSession(save, slot);
  useSessionStore.getState().go('editor');
  log.system(t('Opened "{name}" — {w}×{h} tiles, {time}.', { name: save.name, w: save.map.width, h: save.map.height, time: formatGameTime(save.clock.totalMinutes) }), 'success', save.clock.totalMinutes);
  return session;
}

export function closeWorld(): void {
  const { session, patch } = useSessionStore.getState();
  if (session) {
    session.dispose();
    patch({ session: null, running: false });
  }
}

export async function createAndOpenWorld(opts: NewWorldOptions, preview?: TileGrid): Promise<void> {
  const save = createWorldSave(opts, preview);
  const grid = preview ?? Grid.fromRle(save.map.width, save.map.height, save.map.tilesRle);
  await WorldRepository.save(save, 'slot1', makeThumbnail(grid));
  const session = openWorld(save, 'slot1');
  log.event(t('World "{name}" was created ({type}, seed {seed}).', { name: save.name, type: t(WORLD_TYPES.find((w) => w.key === opts.worldType)?.label ?? opts.worldType), seed: opts.seed }), 'success', save.clock.totalMinutes);
  if (opts.initialNpcCount > 0) {
    session.studio.free = true;
    const summary = generateStarterContent(session.runtime, Math.min(200, opts.initialNpcCount), opts.seed);
    session.studio.free = false;
    log.event(t('Starter content: {summary}', { summary }), 'success', save.clock.totalMinutes);
    focusFirstRegion(session);
    for (const ev of EventService.starterEvents(session.runtime)) session.runtime.entities.add('events', ev);
    session.patches.resetSnapshot();
  }
  if (opts.initialPlayerCount > 0) {
    const n = session.players.seedInitial(opts.initialPlayerCount);
    log.event(t('{n} players are waiting for the servers to start.', { n }), 'info', save.clock.totalMinutes);
  }
  await session.save('slot1', true);
}

export async function loadAndOpenWorld(worldId: string, slot?: SaveSlotKey): Promise<boolean> {
  const res = await WorldRepository.load(worldId, slot);
  if (!res) return false;
  openWorld(res.save, res.slot === 'auto' ? 'slot1' : res.slot);
  return true;
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFileName(name: string): string {
  return name.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'world';
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
