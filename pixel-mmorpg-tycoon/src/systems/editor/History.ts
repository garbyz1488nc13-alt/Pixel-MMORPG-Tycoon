import type { TileGrid } from '@/models/TileGrid';
import type { WorldRuntime } from '@/simulation/WorldRuntime';

/** A reversible editor operation. New editor features add new command kinds. */
export interface EditorCommand {
  label: string;
  undo(world: WorldRuntime): void;
  redo(world: WorldRuntime): void;
}

/** Tile paint: stores only changed tiles (index, before, after). */
export class TileEditCommand implements EditorCommand {
  constructor(
    readonly label: string,
    private indices: Uint32Array,
    private before: Uint8Array,
    private after: Uint8Array,
  ) {}
  get size(): number {
    return this.indices.length;
  }
  undo(world: WorldRuntime): void {
    world.setTiles(this.indices, this.before);
  }
  redo(world: WorldRuntime): void {
    world.setTiles(this.indices, this.after);
  }
}

/** Whole-map replacement (resize, regenerate). */
export class ReplaceMapCommand implements EditorCommand {
  constructor(readonly label: string, private before: TileGrid, private after: TileGrid) {}
  undo(world: WorldRuntime): void {
    world.replaceGrid(this.before.clone());
  }
  redo(world: WorldRuntime): void {
    world.replaceGrid(this.after.clone());
  }
}

export class History {
  private undoStack: EditorCommand[] = [];
  private redoStack: EditorCommand[] = [];
  constructor(private limit = 200, private onChange?: () => void) {}

  push(cmd: EditorCommand): void {
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
    this.onChange?.();
  }

  undo(world: WorldRuntime): string | null {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;
    cmd.undo(world);
    this.redoStack.push(cmd);
    this.onChange?.();
    return cmd.label;
  }

  redo(world: WorldRuntime): string | null {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;
    cmd.redo(world);
    this.undoStack.push(cmd);
    this.onChange?.();
    return cmd.label;
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.onChange?.();
  }
}
