import { useCallback, useRef } from 'react';
import { t } from '@/i18n';
import { makeThumbnail } from '@/game/textures/mapImage';
import { TileGrid } from '@/models/TileGrid';
import { WorldRepository } from '@/persistence/WorldRepository';
import { parseWorldJson } from '@/persistence/serializer';
import { readFileText } from '@/session/sessionActions';
import { toast } from '@/stores/toastStore';

/** Returns an `<input type=file>` trigger that imports a world JSON into IndexedDB. */
export function useImportWorld(onImported: () => void) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pick = useCallback(() => {
    if (!inputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        try {
          const save = parseWorldJson(await readFileText(file));
          const grid = TileGrid.fromRle(save.map.width, save.map.height, save.map.tilesRle);
          const stored = await WorldRepository.importWorld(save, makeThumbnail(grid));
          toast(t('Imported "{name}"', { name: stored.name }), 'success');
          onImported();
        } catch (e) {
          toast(t('Import failed: {msg}', { msg: (e as Error).message }), 'error');
        }
      };
      inputRef.current = input;
    }
    inputRef.current.click();
  }, [onImported]);

  return pick;
}
