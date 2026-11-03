import { create } from 'zustand';
import type { EntityId } from '@/core/ids';
import type { NpcType } from '@/data/npcTypes';
import type { RegionType } from '@/data/regionTypes';
import { TerrainId } from '@/data/terrain';
import type { Selection } from '@/systems/editor/EntityEditor';
import type { BrushShape } from '@/systems/editor/shapes';

export type EditorTab = 'map' | 'npc' | 'creatures' | 'economy' | 'items' | 'quests' | 'progression' | 'players' | 'events' | 'analytics' | 'settings';

/** Terrain tools + entity tools. */
export type EditorTool =
  | 'brush' | 'fill' | 'rect' | 'picker'
  | 'select' | 'place-object' | 'erase-object'
  | 'region' | 'npc' | 'spawn-area' | 'waypoint';

export type LeftSection = 'terrain' | 'objects' | 'regions' | 'npc' | 'creatures' | 'spawns';

export interface HoverInfo { x: number; y: number; terrain: number }

interface EditorState {
  tab: EditorTab;
  section: LeftSection;
  tool: EditorTool;
  terrain: TerrainId;
  brushSize: number;
  brushShape: BrushShape;
  rectOutline: boolean;
  objectKind: string;
  regionType: RegionType;
  npcType: NpcType;
  templateId: EntityId | null;
  selection: Selection | null;
  hover: HoverInfo | null;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  setTab: (tab: EditorTab) => void;
  setSection: (s: LeftSection) => void;
  setTool: (tool: EditorTool) => void;
  setTerrain: (t: TerrainId) => void;
  setBrushSize: (n: number) => void;
  setBrushShape: (s: BrushShape) => void;
  setRectOutline: (v: boolean) => void;
  setObjectKind: (k: string) => void;
  setRegionType: (t: RegionType) => void;
  setNpcType: (t: NpcType) => void;
  setTemplateId: (id: EntityId | null) => void;
  select: (s: Selection | null) => void;
  setHover: (h: HoverInfo | null) => void;
  setHistoryFlags: (canUndo: boolean, canRedo: boolean) => void;
  setZoom: (z: number) => void;
  reset: () => void;
}

export const MAX_BRUSH = 15;
export const TERRAIN_TOOLS: EditorTool[] = ['brush', 'fill', 'rect', 'picker'];

const initial = {
  tab: 'map' as EditorTab,
  section: 'terrain' as LeftSection,
  tool: 'brush' as EditorTool,
  terrain: TerrainId.Grass,
  brushSize: 1,
  brushShape: 'square' as BrushShape,
  rectOutline: false,
  objectKind: 'tree_oak',
  regionType: 'village' as RegionType,
  npcType: 'villager' as NpcType,
  templateId: null,
  selection: null,
  hover: null,
  canUndo: false,
  canRedo: false,
  zoom: 1,
};

export const useEditorStore = create<EditorState>((set) => ({
  ...initial,
  setTab: (tab) => set({ tab }),
  setSection: (section) => set({ section }),
  setTool: (tool) => set({ tool }),
  setTerrain: (terrain) => set({ terrain }),
  setBrushSize: (n) => set({ brushSize: Math.max(1, Math.min(MAX_BRUSH, Math.round(n))) }),
  setBrushShape: (brushShape) => set({ brushShape }),
  setRectOutline: (rectOutline) => set({ rectOutline }),
  setObjectKind: (objectKind) => set({ objectKind, tool: 'place-object' }),
  setRegionType: (regionType) => set({ regionType, tool: 'region' }),
  setNpcType: (npcType) => set({ npcType, tool: 'npc' }),
  setTemplateId: (templateId) => set({ templateId }),
  select: (selection) => set({ selection: selection && selection.ids.length ? selection : null }),
  setHover: (hover) => set({ hover }),
  setHistoryFlags: (canUndo, canRedo) => set({ canUndo, canRedo }),
  setZoom: (zoom) => set({ zoom }),
  reset: () => set(initial),
}));
