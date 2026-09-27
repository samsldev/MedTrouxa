import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth';

interface Stats {
  answered: number; correct: number; xp: number; streak: number;
  bySubject: { id: number; name: string; answered: number; correct: number }[];
  daily: { day: string; answered: number }[];
  cards: { studied: number; due: number };
  exams: { done: number; avgScore: number };
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default function Dashboard() {
  const { user } = useAuth();
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => { api<Stats>('/stats/me').then(setS); }, []);
  if (!s) return <div className="center">Carregando...</div>;
  const max = Math.max(1, ...s.daily.map((d) => d.answered));

  return (
    <>
      <h1>Olá, {user?.name.split(' ')[0]} 👋</h1>
      <div className="tiles">
        <div className="tile"><small>Questões resolvidas</small><b>{s.answered}</b></div>
        <div className="tile"><small>Aproveitamento</small><b>{pct(s.correct, s.answered)}%</b></div>
        <div className="tile"><small>Sequência</small><b>🔥 {s.streak} dia(s)</b></div>
        <div className="tile"><small>XP</small><b>{s.xp}</b></div>
        <div className="tile"><small>Flashcards p/ revisar</small><b>{s.cards.due}</b></div>
        <div className="tile"><small>Simulados · média</small><b>{s.exams.done} · {s.exams.avgScore}%</b></div>
      </div>

      <div className="grid2">
        <section className="card">
          <h3>Questões nos últimos 14 dias</h3>
          <div className="bars">
            {s.daily.map((d) => (
              <div key={d.day} className="bar" title={`${d.day}: ${d.answered}`}>
                <div style={{ height: `${(d.answered / max) * 100}%` }} />
                <small>{d.day.slice(8)}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <h3>Desempenho por grande área</h3>
          {s.bySubject.length === 0 && <p className="muted">Resolva questões para ver seu desempenho. <Link to="/questoes">Começar →</Link></p>}
          {s.bySubject.map((b) => (
            <div key={b.id} className="progress-row">
              <span>{b.name}</span>
              <div className="progress"><div style={{ width: `${pct(b.correct, b.answered)}%` }} /></div>
              <small>{pct(b.correct, b.answered)}% ({b.answered})</small>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
