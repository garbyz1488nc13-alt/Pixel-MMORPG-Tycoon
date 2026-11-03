import { useCallback, useEffect, useState } from 'react';
import { t } from '@/i18n';
import type { WorldMeta } from '@/models/world';
import { WorldRepository } from '@/persistence/WorldRepository';
import { toast } from '@/stores/toastStore';

export function useWorldList() {
  const [worlds, setWorlds] = useState<WorldMeta[] | null>(null);
  const refresh = useCallback(async () => {
    try {
      setWorlds(await WorldRepository.listWorlds());
    } catch (e) {
      toast(t('Could not read saved worlds: {msg}', { msg: (e as Error).message }), 'error');
      setWorlds([]);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { worlds, refresh };
}
