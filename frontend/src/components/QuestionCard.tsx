import { useState } from 'react';
import { api, Question } from '../api/client';

interface Result { correct: boolean; correctKey: string; commentary: string }

export default function QuestionCard({ q, index }: { q: Question; index?: number }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [dist, setDist] = useState<Record<string, number> | null>(null);
  const [ai, setAi] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  async function answer() {
    if (!chosen) return;
    setResult(await api<Result>(`/questions/${q.id}/answer`, { body: { chosenKey: chosen } }));
    api<{ byKey: Record<string, number> }>(`/questions/${q.id}/stats`).then((d) => setDist(d.byKey));
  }

  async function explain() {
    setAiBusy(true);
    try { setAi((await api<{ reply: string }>(`/ai/explain/${q.id}`, { body: {} })).reply); }
    catch (e) { setAi(`⚠️ ${(e as Error).message}`); }
    finally { setAiBusy(false); }
  }

  return (
    <article className="card question">
      <header className="q-meta">
        {index !== undefined && <b>#{index}</b>}
        <span className="pill">{q.topic?.name}</span>
        {q.institution && <span className="pill">{q.institution} {q.year}</span>}
        <span className={`pill diff-${q.difficulty}`}>{{ easy: 'Fácil', medium: 'Média', hard: 'Difícil' }[q.difficulty]}</span>
      </header>
      <p className="statement">{q.statement}</p>
      <div className="alts">
        {q.alternatives.map((a) => {
          const cls = result
            ? a.key === result.correctKey ? 'right' : a.key === chosen ? 'wrong' : ''
            : a.key === chosen ? 'selected' : '';
          return (
            <button key={a.key} className={`alt ${cls}`} disabled={!!result} onClick={() => setChosen(a.key)}>
              <b>{a.key})</b> {a.text}
              {dist && <small className="dist">{dist[a.key] ?? 0}%</small>}
            </button>
          );
        })}
      </div>
      {!result ? (
        <button className="primary" disabled={!chosen} onClick={answer}>Responder</button>
      ) : (
        <div className={`feedback ${result.correct ? 'ok' : 'ko'}`}>
          <strong>{result.correct ? '✅ Acertou!' : `❌ Errou — gabarito: ${result.correctKey}`}</strong>
          <p>{result.commentary}</p>
          <button className="ghost" onClick={explain} disabled={aiBusy}>{aiBusy ? 'A Coruja está pensando...' : '🦉 Explicar com a Coruja'}</button>
          {ai && <div className="ai-box">{ai}</div>}
        </div>
      )}
    </article>
  );
}
