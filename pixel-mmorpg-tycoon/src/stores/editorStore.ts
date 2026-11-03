import { create } from 'zustand';
import { TerrainId } from '@/data/terrain';
import type { BrushShape } from '@/systems/editor/shapes';
import type { TerrainTool } from '@/systems/editor/TerrainPainter';

export type EditorTab = 'map' | 'npc' | 'creatures' | 'economy' | 'items' | 'quests' | 'progression' | 'players' | 'events' | 'analytics' | 'settings';

export interface HoverInfo { x: number; y: number; terrain: number }

interface EditorState {
  tab: EditorTab;
  tool: TerrainTool;
  terrain: TerrainId;
  brushSize: number;
  brushShape: BrushShape;
  rectOutline: boolean;
  hover: HoverInfo | null;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  setTab: (tab: EditorTab) => void;
  setTool: (tool: TerrainTool) => void;
  setTerrain: (t: TerrainId) => void;
  setBrushSize: (n: number) => void;
  setBrushShape: (s: BrushShape) => void;
  setRectOutline: (v: boolean) => void;
  setHover: (h: HoverInfo | null) => void;
  setHistoryFlags: (canUndo: boolean, canRedo: boolean) => void;
  setZoom: (z: number) => void;
  reset: () => void;
}

export const MAX_BRUSH = 15;

const initial = {
  tab: 'map' as EditorTab,
  tool: 'brush' as TerrainTool,
  terrain: TerrainId.Grass,
  brushSize: 1,
  brushShape: 'square' as BrushShape,
  rectOutline: false,
  hover: null,
  canUndo: false,
  canRedo: false,
  zoom: 1,
};

export const useEditorStore = create<EditorState>((set) => ({
  ...initial,
  setTab: (tab) => set({ tab }),
  setTool: (tool) => set({ tool }),
  setTerrain: (terrain) => set({ terrain }),
  setBrushSize: (n) => set({ brushSize: Math.max(1, Math.min(MAX_BRUSH, Math.round(n))) }),
  setBrushShape: (brushShape) => set({ brushShape }),
  setRectOutline: (rectOutline) => set({ rectOutline }),
  setHover: (hover) => set({ hover }),
  setHistoryFlags: (canUndo, canRedo) => set({ canUndo, canRedo }),
  setZoom: (zoom) => set({ zoom }),
  reset: () => set(initial),
}));
