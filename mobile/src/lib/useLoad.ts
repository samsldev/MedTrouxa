import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Carrega dados ao focar a tela (volta de outra aba = dados frescos), com puxar-para-atualizar. */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);
  const loader = useRef(load);
  useEffect(() => { loader.current = load; });

  const run = useCallback(async (manual = false) => {
    const req = ++latest.current;
    if (manual) setRefreshing(true);
    try {
      const next = await loader.current();
      if (latest.current === req) { setData(next); setError(null); }
    } catch (e) {
      if (latest.current === req) setError((e as Error).message);
    } finally {
      if (latest.current === req) setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void run(); }, [run]));
  return { data, setData, error, refreshing, refresh: () => run(true) };
}
