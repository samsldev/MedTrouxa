import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

interface Item { day: number; title: string; type: string; topicId?: number }
interface Plan { id: number; title: string; description?: string; goal: string; items: Item[] }
interface Enrollment { id: number; plan: Plan; completed: number[]; startedAt: string }

const ICON: Record<string, string> = { questions: '📝', flashcards: '🃏', reading: '📖', review: '⏱️' };
const LINK: Record<string, string> = { questions: '/questoes', flashcards: '/flashcards', review: '/simulados', reading: '/coruja' };

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [mine, setMine] = useState<Enrollment[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const load = () => api<Enrollment[]>('/study-plans/mine').then((m) => { setMine(m); if (open === null && m[0]) setOpen(m[0].id); });
  useEffect(() => { api<Plan[]>('/study-plans').then(setPlans); load(); }, []);

  const enroll = async (id: number) => { const e = await api<Enrollment>(`/study-plans/${id}/enroll`, { body: {} }); setOpen(e.id); load(); };
  const toggle = async (e: Enrollment, idx: number) => {
    const upd = await api<Enrollment>(`/study-plans/enrollments/${e.id}/items/${idx}/toggle`, { body: {} });
    setMine(mine.map((m) => (m.id === e.id ? upd : m)));
  };
  const enrolled = new Set(mine.map((m) => m.plan.id));

  return (
    <>
      <h1>Cronogramas</h1>
      {mine.map((e) => {
        const today = Math.floor((Date.now() - new Date(e.startedAt).getTime()) / 86_400_000) + 1;
        const pct = Math.round((e.completed.length / e.plan.items.length) * 100);
        return (
          <section key={e.id} className="card">
            <div className="plan-head" onClick={() => setOpen(open === e.id ? null : e.id)}>
              <h3>{e.plan.title}</h3>
              <div className="progress wide"><div style={{ width: `${pct}%` }} /></div>
              <small>{pct}% · dia {Math.min(today, e.plan.items.length)} de {e.plan.items.length}</small>
            </div>
            {open === e.id && (
              <ul className="plan-items">
                {e.plan.items.map((it, idx) => (
                  <li key={idx} className={`${e.completed.includes(idx) ? 'done' : ''} ${it.day === today ? 'today' : ''}`}>
                    <input type="checkbox" checked={e.completed.includes(idx)} onChange={() => toggle(e, idx)} />
                    <span className="day">Dia {it.day}</span> {ICON[it.type]} {it.title}
                    <Link to={LINK[it.type]} className="link">abrir →</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <h3>Planos disponíveis</h3>
      <div className="deck-grid">
        {plans.map((p) => (
          <div key={p.id} className="card deck">
            <span className="pill">{p.goal}</span>
            <h3>{p.title}</h3>
            <p className="muted">{p.description}</p>
            <button className="primary" disabled={enrolled.has(p.id)} onClick={() => enroll(p.id)}>
              {enrolled.has(p.id) ? 'Inscrito' : `Começar (${p.items.length} dias)`}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
