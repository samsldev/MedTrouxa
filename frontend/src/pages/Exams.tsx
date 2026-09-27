import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Filters, { FilterValue } from '../components/Filters';

interface Exam { id: string; title: string; questionIds: number[]; startedAt: string; finishedAt: string | null; score: number | null; durationMinutes: number }

export default function Exams() {
  const nav = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [filters, setFilters] = useState<FilterValue>({});
  const [form, setForm] = useState({ title: 'Simulado', count: 10, durationMinutes: 30 });
  const [error, setError] = useState('');
  useEffect(() => { api<Exam[]>('/exams').then(setExams); }, []);

  async function create(e: FormEvent) {
    e.preventDefault(); setError('');
    try {
      const exam = await api<Exam>('/exams', { body: {
        ...form,
        subjectId: filters.subjectId ? Number(filters.subjectId) : undefined,
        topicId: filters.topicId ? Number(filters.topicId) : undefined,
        institution: filters.institution,
      } });
      nav(`/simulados/${exam.id}`);
    } catch (err) { setError((err as Error).message); }
  }

  return (
    <>
      <h1>Simulados</h1>
      <form className="card" onSubmit={create}>
        <h3>Montar simulado</h3>
        <Filters value={filters} onChange={setFilters} showStatus={false} />
        <div className="row">
          <label>Título <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label>Questões <input type="number" min={5} max={120} value={form.count} onChange={(e) => setForm({ ...form, count: +e.target.value })} /></label>
          <label>Tempo (min) <input type="number" min={5} max={300} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: +e.target.value })} /></label>
        </div>
        {error && <div className="error">{error}</div>}
        <button className="primary">Começar ⏱️</button>
      </form>
      <h3>Histórico</h3>
      <table className="table">
        <thead><tr><th>Simulado</th><th>Data</th><th>Questões</th><th>Nota</th></tr></thead>
        <tbody>
          {exams.map((e) => (
            <tr key={e.id}>
              <td><Link to={`/simulados/${e.id}`}>{e.title}</Link></td>
              <td>{new Date(e.startedAt).toLocaleString('pt-BR')}</td>
              <td>{e.questionIds.length}</td>
              <td>{e.finishedAt ? `${e.score}%` : <span className="pill">em andamento</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
