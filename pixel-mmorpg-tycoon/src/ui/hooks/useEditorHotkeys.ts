import { useEffect } from 'react';
import { TERRAINS } from '@/data/terrain';
import type { GameSession } from '@/session/GameSession';
import { useEditorStore } from '@/stores/editorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { toast } from '@/stores/toastStore';

const isTyping = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

export function useEditorHotkeys(session: GameSession) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 's') {
        e.preventDefault();
        session.save().then((ok) => ok && toast('Saved', 'success'));
        return;
      }
      if (isTyping(e)) return;
      const ed = useEditorStore.getState();
      if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); session.undo(); return; }
      if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); session.redo(); return; }
      if (mod || e.altKey) return;

      const terrain = TERRAINS.find((t) => t.hotkey === e.key);
      if (terrain) { ed.setTerrain(terrain.id); if (ed.tool === 'picker') ed.setTool('brush'); return; }
      switch (k) {
        case 'b': ed.setTool('brush'); break;
        case 'f': ed.setTool('fill'); break;
        case 'r': ed.setTool('rect'); break;
        case 'i': ed.setTool('picker'); break;
        case '[': ed.setBrushSize(ed.brushSize - 1); break;
        case ']': ed.setBrushSize(ed.brushSize + 1); break;
        case 'p': session.engine.toggle(); break;
        case 'g': {
          const s = useSettingsStore.getState();
          s.update({ showGrid: !s.showGrid });
          break;
        }
        case '+': case '=': session.bridge.emit('camera:zoomBy', { factor: 1.25 }); break;
        case '-': case '_': session.bridge.emit('camera:zoomBy', { factor: 0.8 }); break;
        case 'home': e.preventDefault(); session.bridge.emit('camera:fit', undefined); break;
        case 'escape': if (ed.tab !== 'map') ed.setTab('map'); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session]);
}
