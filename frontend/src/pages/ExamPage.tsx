import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, Question } from '../api/client';

interface Exam {
  id: string; title: string; startedAt: string; finishedAt: string | null; durationMinutes: number; score: number | null;
  questions: Question[]; answers: { questionId: number; chosenKey: string | null; correct: boolean }[] | null;
}

export default function ExamPage() {
  const { id } = useParams();
  const [exam, setExam] = useState<Exam | null>(null);
  const [chosen, setChosen] = useState<Record<number, string>>(() => JSON.parse(localStorage.getItem(`exam:${id}`) ?? '{}'));
  const [now, setNow] = useState(Date.now());
  const submitting = useRef(false);

  useEffect(() => { api<Exam>(`/exams/${id}`).then(setExam); }, [id]);
  useEffect(() => { localStorage.setItem(`exam:${id}`, JSON.stringify(chosen)); }, [chosen, id]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const deadline = exam ? new Date(exam.startedAt).getTime() + exam.durationMinutes * 60_000 : 0;
  const left = Math.max(0, deadline - now);

  async function submit() {
    if (!exam || submitting.current) return;
    submitting.current = true;
    const answers = exam.questions.map((q) => ({ questionId: q.id, chosenKey: chosen[q.id] ?? null }));
    setExam(await api<Exam>(`/exams/${id}/submit`, { body: { answers } }));
    localStorage.removeItem(`exam:${id}`);
  }

  useEffect(() => { if (exam && !exam.finishedAt && left === 0) submit(); }, [left, exam]);

  if (!exam) return <div className="center">Carregando...</div>;
  const done = !!exam.finishedAt;
  const result = new Map(exam.answers?.map((a) => [a.questionId, a]) ?? []);
  const mm = String(Math.floor(left / 60000)).padStart(2, '0');
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');

  return (
    <>
      <Link to="/simulados" className="link">← Simulados</Link>
      <div className="exam-head">
        <h1>{exam.title}</h1>
        {done ? <div className="score">Nota: {exam.score}%</div> : <div className={`timer ${left < 60000 ? 'late' : ''}`}>⏱️ {mm}:{ss}</div>}
      </div>
      {exam.questions.map((q, i) => {
        const r = result.get(q.id);
        return (
          <article key={q.id} className="card question">
            <header className="q-meta"><b>#{i + 1}</b><span className="pill">{q.topic?.name}</span>{q.institution && <span className="pill">{q.institution} {q.year}</span>}</header>
            <p className="statement">{q.statement}</p>
            <div className="alts">
              {q.alternatives.map((a) => {
                const cls = done
                  ? a.key === q.correctKey ? 'right' : a.key === r?.chosenKey ? 'wrong' : ''
                  : chosen[q.id] === a.key ? 'selected' : '';
                return (
                  <button key={a.key} className={`alt ${cls}`} disabled={done} onClick={() => setChosen({ ...chosen, [q.id]: a.key })}>
                    <b>{a.key})</b> {a.text}
                  </button>
                );
              })}
            </div>
            {done && <div className={`feedback ${r?.correct ? 'ok' : 'ko'}`}><p>{q.commentary}</p></div>}
          </article>
        );
      })}
      {!done && (
        <button className="primary big-btn" onClick={() => confirm('Finalizar simulado?') && submit()}>
          Finalizar ({Object.keys(chosen).length}/{exam.questions.length} respondidas)
        </button>
      )}
    </>
  );
}
