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
      const sel = ed.selection;
      if (mod && k === 'c' && sel?.col === 'objects') {
        session.clipboard = sel.ids.map((id) => session.runtime.entities.get('objects', id)).filter((o): o is NonNullable<typeof o> => !!o).map((o) => structuredClone(o));
        toast(`Copied ${session.clipboard.length} object(s)`);
        return;
      }
      if (mod && k === 'v' && session.clipboard.length) {
        e.preventDefault();
        const h = ed.hover;
        const minX = Math.min(...session.clipboard.map((o) => o.x));
        const minY = Math.min(...session.clipboard.map((o) => o.y));
        const ids = session.entities.pasteObjects(session.clipboard, h ? h.x - minX : 1, h ? h.y - minY : 1);
        if (ids.length) { ed.select({ col: 'objects', ids }); ed.setTool('select'); } else toast('No room to paste here', 'error');
        return;
      }
      if (mod && k === 'd' && sel?.col === 'objects') {
        e.preventDefault();
        const ids = session.entities.duplicateObjects(sel.ids, 1, 1);
        if (ids.length) ed.select({ col: 'objects', ids });
        return;
      }
      if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); session.redo(); return; }
      if (mod || e.altKey) return;

      const terrain = TERRAINS.find((t) => t.hotkey === e.key);
      if (terrain) { ed.setTerrain(terrain.id); ed.setSection('terrain'); if (!['brush', 'fill', 'rect'].includes(ed.tool)) ed.setTool('brush'); return; }
      switch (k) {
        case 'v': ed.setTool('select'); break;
        case 'e': ed.setTool('erase-object'); break;
        case 'delete': case 'backspace':
          if (ed.selection) { session.entities.remove(ed.selection.col, ed.selection.ids); ed.select(null); }
          break;
        case 'b': ed.setTool('brush'); ed.setSection('terrain'); break;
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
        case 'escape':
          if (ed.tab !== 'map') ed.setTab('map');
          else if (ed.tool === 'waypoint') ed.setTool('select');
          else ed.select(null);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session]);
}
