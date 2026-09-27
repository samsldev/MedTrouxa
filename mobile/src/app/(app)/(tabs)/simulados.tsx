import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Filters, { FilterValue } from '@/components/Filters';
import { Button, Card, Empty, Field, Header, Notice, Pill, Row, Screen, T } from '@/components/ui';
import { api, isPlanError } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';

interface Exam { id: string; title: string; questionIds: number[]; startedAt: string; finishedAt: string | null; score: number | null; durationMinutes: number }
const clamp = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Number(v) || min));

export default function Simulados() {
  const { data: exams, refreshing, refresh } = useLoad(() => api<Exam[]>('/exams'));
  const [filters, setFilters] = useState<FilterValue>({});
  const [form, setForm] = useState({ title: 'Simulado', count: '10', durationMinutes: '30' });
  const [error, setError] = useState('');
  const [locked, setLocked] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    setError(''); setBusy(true);
    try {
      const exam = await api<Exam>('/exams', { body: {
        title: form.title.trim() || 'Simulado', count: clamp(form.count, 5, 120), durationMinutes: clamp(form.durationMinutes, 5, 300),
        subjectId: filters.subjectId ? Number(filters.subjectId) : undefined, topicId: filters.topicId ? Number(filters.topicId) : undefined,
        institution: filters.institution,
      } });
      router.push({ pathname: '/simulados/[id]', params: { id: exam.id } });
      refresh();
    } catch (e) { if (isPlanError(e)) setLocked(e.message); else setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Header kicker="Treino" title="Simu" em="lados" />
      {locked ? <Notice tone="lock">{locked}</Notice> : (
        <Card>
          <T weight="bold">Montar simulado</T>
          <Filters value={filters} onChange={setFilters} showStatus={false} />
          <Field label="Título" value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} maxLength={80} />
          <Row gap={10}>
            <Field style={{ flex: 1 }} label="Questões (5–120)" value={form.count} keyboardType="number-pad" onChangeText={(v) => setForm({ ...form, count: v.replace(/\D/g, '') })} />
            <Field style={{ flex: 1 }} label="Tempo em min (5–300)" value={form.durationMinutes} keyboardType="number-pad" onChangeText={(v) => setForm({ ...form, durationMinutes: v.replace(/\D/g, '') })} />
          </Row>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button variant="foil" icon="timer" title="Começar simulado" loading={busy} onPress={create} />
        </Card>
      )}
      <T weight="bold" size={17}>Histórico</T>
      {exams?.length === 0 && <Empty icon="timer" title="Nenhum simulado ainda" body="Monte o primeiro acima." />}
      {exams?.map((e) => (
        <Card key={e.id} onPress={() => router.push({ pathname: '/simulados/[id]', params: { id: e.id } })} accessibilityLabel={e.title}>
          <Row>
            <View style={{ flex: 1 }}>
              <T weight="semi">{e.title}</T>
              <T size={13} muted>{new Date(e.startedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {e.questionIds.length} questões</T>
            </View>
            {e.finishedAt ? <Pill tone={(e.score ?? 0) >= 60 ? 'easy' : 'hard'}>{e.score}%</Pill> : <Pill tone="gold">em andamento</Pill>}
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
