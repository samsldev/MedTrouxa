import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api, Subject } from '@/lib/api';
import { Picker } from './ui';

export interface FilterValue { subjectId?: string; topicId?: string; institution?: string; difficulty?: string; status?: string }

export default function Filters({ value, onChange, showStatus = true }: { value: FilterValue; onChange(v: FilterValue): void; showStatus?: boolean }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [institutions, setInstitutions] = useState<string[]>([]);
  useEffect(() => {
    api<Subject[]>('/subjects').then(setSubjects).catch(() => undefined);
    api<string[]>('/questions/institutions').then(setInstitutions).catch(() => undefined);
  }, []);
  const topics = subjects.find((s) => String(s.id) === value.subjectId)?.topics ?? [];
  const set = (k: keyof FilterValue) => (v: string) => onChange({ ...value, [k]: v || undefined, ...(k === 'subjectId' ? { topicId: undefined } : {}) });

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Picker label="Área" value={value.subjectId ?? ''} onChange={set('subjectId')}
        options={[{ value: '', label: 'Todas as áreas' }, ...subjects.map((s) => ({ value: String(s.id), label: s.name }))]} />
      <Picker label="Tema" value={value.topicId ?? ''} onChange={set('topicId')} disabled={!topics.length}
        options={[{ value: '', label: 'Todos os temas' }, ...topics.map((t) => ({ value: String(t.id), label: t.name }))]} />
      <Picker label="Banca" value={value.institution ?? ''} onChange={set('institution')}
        options={[{ value: '', label: 'Todas as bancas' }, ...institutions.map((i) => ({ value: i, label: i }))]} />
      {showStatus && (
        <>
          <Picker label="Dificuldade" value={value.difficulty ?? ''} onChange={set('difficulty')}
            options={[{ value: '', label: 'Qualquer' }, { value: 'easy', label: 'Fácil' }, { value: 'medium', label: 'Média' }, { value: 'hard', label: 'Difícil' }]} />
          <Picker label="Situação" value={value.status ?? ''} onChange={set('status')}
            options={[{ value: '', label: 'Todas' }, { value: 'unanswered', label: 'Não resolvidas' }, { value: 'wrong', label: 'Que errei' }]} />
        </>
      )}
    </View>
  );
}
