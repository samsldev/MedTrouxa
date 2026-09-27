import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Filters, { FilterValue } from '@/components/Filters';
import QuestionCard from '@/components/QuestionCard';
import { CONTENT_MAX, Empty, Header, Notice, T } from '@/components/ui';
import { api, Question } from '@/lib/api';
import { useTheme } from '@/lib/theme';

const LIMIT = 10;

function fetchPage(page: number, f: FilterValue) {
  const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  Object.entries(f).forEach(([k, v]) => v && qs.set(k, v));
  return api<{ items: Question[]; total: number }>(`/questions?${qs}`);
}

/** Banco de questões com rolagem infinita (o web usa paginação). */
export default function Questoes() {
  const { c } = useTheme();
  const [filters, setFilters] = useState<FilterValue>({});
  const [items, setItems] = useState<Question[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const req = useRef(0);

  const load = useCallback(async (p: number, f: FilterValue, mode: 'replace' | 'append' | 'refresh') => {
    const id = ++req.current;
    if (mode === 'refresh') setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const r = await fetchPage(p, f);
      if (id !== req.current) return;
      setItems((prev) => (mode === 'append' ? [...prev, ...r.items.filter((q) => !prev.some((x) => x.id === q.id))] : r.items));
      setTotal(r.total); setPage(p);
    } catch (e) { if (id === req.current) setError((e as Error).message); }
    finally { if (id === req.current) { setLoading(false); setRefreshing(false); } }
  }, []);

  // Primeira página ao abrir; depois, cada troca de filtro recarrega (evento, não efeito)
  useEffect(() => {
    const id = ++req.current;
    fetchPage(1, {})
      .then((r) => { if (id === req.current) { setItems(r.items); setTotal(r.total); } })
      .catch((e) => { if (id === req.current) setError((e as Error).message); })
      .finally(() => { if (id === req.current) setLoading(false); });
  }, []);
  const applyFilters = (f: FilterValue) => { setFilters(f); void load(1, f, 'replace'); };
  const more = () => { if (!loading && total !== null && items.length < total) void load(page + 1, filters, 'append'); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <FlatList
        data={items}
        keyExtractor={(q) => String(q.id)}
        renderItem={({ item, index }) => <QuestionCard q={item} index={index + 1} />}
        contentContainerStyle={{ padding: 18, gap: 14, width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center' }}
        onEndReached={more}
        onEndReachedThreshold={0.6}
        refreshing={refreshing}
        onRefresh={() => load(1, filters, 'refresh')}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Header kicker="Prática" title="Banco de " em="questões" />
            <Filters value={filters} onChange={applyFilters} />
            {total !== null && <T muted size={14}>{total.toLocaleString('pt-BR')} questões encontradas</T>}
            {error ? <Notice tone="error">{error}</Notice> : null}
          </View>
        }
        ListEmptyComponent={loading ? null : <Empty icon="questions" title="Nenhuma questão com esses filtros" body="Tente outra área, tema ou banca." />}
        ListFooterComponent={loading ? <ActivityIndicator color={c.gold} style={{ margin: 20 }} /> : null}
        initialNumToRender={3}
        windowSize={11}
      />
    </SafeAreaView>
  );
}
