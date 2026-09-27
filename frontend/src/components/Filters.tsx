import { useEffect, useState } from 'react';
import { api, Subject } from '../api/client';

export interface FilterValue { subjectId?: string; topicId?: string; institution?: string; difficulty?: string; status?: string }

export default function Filters({ value, onChange, showStatus = true }: { value: FilterValue; onChange(v: FilterValue): void; showStatus?: boolean }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [institutions, setInstitutions] = useState<string[]>([]);
  useEffect(() => {
    api<Subject[]>('/subjects').then(setSubjects);
    api<string[]>('/questions/institutions').then(setInstitutions);
  }, []);
  const topics = subjects.find((s) => String(s.id) === value.subjectId)?.topics ?? [];
  const set = (k: keyof FilterValue) => (e: { target: { value: string } }) =>
    onChange({ ...value, [k]: e.target.value || undefined, ...(k === 'subjectId' ? { topicId: undefined } : {}) });

  return (
    <div className="filters">
      <select value={value.subjectId ?? ''} onChange={set('subjectId')}>
        <option value="">Todas as áreas</option>
        {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select value={value.topicId ?? ''} onChange={set('topicId')} disabled={!topics.length}>
        <option value="">Todos os temas</option>
        {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <select value={value.institution ?? ''} onChange={set('institution')}>
        <option value="">Todas as bancas</option>
        {institutions.map((i) => <option key={i}>{i}</option>)}
      </select>
      {showStatus && (
        <>
          <select value={value.difficulty ?? ''} onChange={set('difficulty')}>
            <option value="">Qualquer dificuldade</option>
            <option value="easy">Fácil</option><option value="medium">Média</option><option value="hard">Difícil</option>
          </select>
          <select value={value.status ?? ''} onChange={set('status')}>
            <option value="">Todas</option>
            <option value="unanswered">Não resolvidas</option>
            <option value="wrong">Que errei</option>
          </select>
        </>
      )}
    </div>
  );
}
