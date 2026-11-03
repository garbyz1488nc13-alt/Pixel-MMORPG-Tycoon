import { useCallback, useEffect, useState } from 'react';
import type { WorldMeta } from '@/models/world';
import { WorldRepository } from '@/persistence/WorldRepository';
import { toast } from '@/stores/toastStore';

export function useWorldList() {
  const [worlds, setWorlds] = useState<WorldMeta[] | null>(null);
  const refresh = useCallback(async () => {
    try {
      setWorlds(await WorldRepository.listWorlds());
    } catch (e) {
      toast(`Could not read saved worlds: ${(e as Error).message}`, 'error');
      setWorlds([]);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { worlds, refresh };
}
