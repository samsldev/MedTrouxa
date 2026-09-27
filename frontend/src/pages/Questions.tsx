import { useEffect, useState } from 'react';
import { api, Question } from '../api/client';
import Filters, { FilterValue } from '../components/Filters';
import QuestionCard from '../components/QuestionCard';

export default function Questions() {
  const [filters, setFilters] = useState<FilterValue>({});
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Question[]; total: number; limit: number } | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams({ page: String(page), limit: '10' });
    Object.entries(filters).forEach(([k, v]) => v && qs.set(k, v));
    api(`/questions?${qs}`).then(setData);
  }, [filters, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  return (
    <>
      <h1>Banco de questões</h1>
      <Filters value={filters} onChange={(v) => { setFilters(v); setPage(1); }} />
      <p className="muted">{data?.total ?? 0} questões encontradas</p>
      {data?.items.map((q, i) => <QuestionCard key={`${q.id}-${page}`} q={q} index={(page - 1) * 10 + i + 1} />)}
      <div className="pager">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>← Anterior</button>
        <span>{page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima →</button>
      </div>
    </>
  );
}
