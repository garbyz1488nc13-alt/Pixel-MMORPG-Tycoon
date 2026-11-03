import { EventBus } from '@/core/EventBus';
import type { EntityId } from '@/core/ids';
import { TileGrid } from '@/models/TileGrid';
import type { CameraState, WorldClockState, WorldConfig, WorldSave } from '@/models/world';
import { WORLD_SCHEMA_VERSION } from '@/models/world';
import { EntityStore } from './EntityStore';
import { ObjectIndex } from '@/systems/world/ObjectIndex';
import { NavGrid } from './nav/NavGrid';

export type RuntimeEvents = {
  /** Specific tiles changed (indices into the grid). */
  'tiles:changed': { indices: ArrayLike<number> };
  /** Whole map replaced (load, resize, regenerate). Renderers must rebuild. */
  'map:replaced': { grid: TileGrid };
  'meta:changed': { name: string };
  'dirty:changed': { dirty: boolean };
};

/**
 * The single live world instance. Owns all world state that is too large or
 * too hot for React state (the tile grid, the clock). Phaser renders from it,
 * editor systems mutate it, the simulation advances it, persistence snapshots it.
 */
export class WorldRuntime {
  readonly events = new EventBus<RuntimeEvents>();
  id: EntityId;
  name: string;
  createdAt: number;
  config: WorldConfig;
  grid: TileGrid;
  clock: WorldClockState;
  camera?: CameraState;
  readonly entities: EntityStore;
  readonly objectIndex: ObjectIndex;
  readonly nav: NavGrid;
  private _dirty = false;

  constructor(save: WorldSave) {
    this.id = save.id;
    this.name = save.name;
    this.createdAt = save.createdAt;
    this.config = { ...save.config };
    this.grid = TileGrid.fromRle(save.map.width, save.map.height, save.map.tilesRle);
    this.clock = { ...save.clock };
    this.camera = save.camera ? { ...save.camera } : undefined;
    this.entities = new EntityStore(save.entities);
    this.objectIndex = new ObjectIndex(this);
    this.nav = new NavGrid(this);
    this.entities.events.on('changed', ({ col }) => {
      if (col === 'objects') {
        this.objectIndex.invalidate();
        this.nav.invalidate();
      }
      this.markDirty();
    });
    this.events.on('tiles:changed', () => this.nav.invalidate());
    this.events.on('map:replaced', () => {
      this.objectIndex.invalidate();
      this.nav.invalidate();
    });
  }

  get dirty(): boolean {
    return this._dirty;
  }

  markDirty(): void {
    if (!this._dirty) {
      this._dirty = true;
      this.events.emit('dirty:changed', { dirty: true });
    }
  }

  markClean(): void {
    if (this._dirty) {
      this._dirty = false;
      this.events.emit('dirty:changed', { dirty: false });
    }
  }

  setTiles(indices: ArrayLike<number>, values: ArrayLike<number>): void {
    const tiles = this.grid.tiles;
    for (let i = 0; i < indices.length; i++) tiles[indices[i]] = values[i];
    if (indices.length > 0) {
      this.events.emit('tiles:changed', { indices });
      this.markDirty();
    }
  }

  replaceGrid(grid: TileGrid): void {
    this.grid = grid;
    this.events.emit('map:replaced', { grid });
    this.markDirty();
  }

  rename(name: string): void {
    this.name = name.trim() || this.name;
    this.events.emit('meta:changed', { name: this.name });
    this.markDirty();
  }

  toSave(): WorldSave {
    return {
      schemaVersion: WORLD_SCHEMA_VERSION,
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: Date.now(),
      config: { ...this.config },
      map: { width: this.grid.width, height: this.grid.height, tilesRle: this.grid.toRle() },
      clock: { ...this.clock },
      camera: this.camera ? { ...this.camera } : undefined,
      entities: this.entities.toJSON(),
    };
  }

  dispose(): void {
    this.events.clear();
    this.entities.events.clear();
  }
}
