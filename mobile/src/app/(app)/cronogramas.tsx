import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, IconName } from '@/components/Icon';
import { Button, Card, Loading, Notice, Pill, Progress, Row, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { useLoad } from '@/lib/useLoad';

interface Item { day: number; title: string; type: string; topicId?: number }
interface Plan { id: number; title: string; description?: string; goal: string; items: Item[] }
interface Enrollment { id: number; plan: Plan; completed: number[]; startedAt: string }

const ICON: Record<string, IconName> = { questions: 'questions', flashcards: 'cards', reading: 'owl', review: 'timer' };
const LINK = { questions: '/questoes', flashcards: '/flashcards', review: '/simulados', reading: '/coruja' } as const;

export default function Cronogramas() {
  const { c } = useTheme();
  const { data: plans } = useLoad(() => api<Plan[]>('/study-plans'));
  const { data: mine, setData: setMine, refreshing, refresh } = useLoad(() => api<Enrollment[]>('/study-plans/mine'));
  const [open, setOpen] = useState<number | null>(null);
  const [locked, setLocked] = useState('');
  const [now] = useState(() => Date.now());

  const enroll = async (id: number) => {
    try { const e = await api<Enrollment>(`/study-plans/${id}/enroll`, { body: {} }); setOpen(e.id); refresh(); }
    catch (err) { setLocked((err as Error).message); }
  };
  const toggle = async (e: Enrollment, idx: number) => {
    const upd = await api<Enrollment>(`/study-plans/enrollments/${e.id}/items/${idx}/toggle`, { body: {} });
    setMine((mine ?? []).map((m) => (m.id === e.id ? upd : m)));
  };
  const enrolled = new Set(mine?.map((m) => m.plan.id));
  const current = open ?? mine?.[0]?.id ?? null;

  return (
    <Screen edges={['bottom']} refreshing={refreshing} onRefresh={refresh}>
      {locked ? <Notice tone="lock">{locked}</Notice> : null}
      {!mine ? <Loading /> : mine.map((e) => {
        const today = Math.floor((now - new Date(e.startedAt).getTime()) / 86_400_000) + 1;
        const pct = Math.round((e.completed.length / Math.max(1, e.plan.items.length)) * 100);
        const expanded = current === e.id;
        return (
          <Card key={e.id}>
            <Pressable onPress={() => setOpen(expanded ? -1 : e.id)} accessibilityRole="button" accessibilityState={{ expanded }} style={{ gap: 8 }}>
              <Row><T weight="bold" size={16} style={{ flex: 1 }}>{e.plan.title}</T><Icon name={expanded ? 'down' : 'chevron'} size={18} color={c.muted} /></Row>
              <Row><Progress pct={pct} /><T size={13} muted>{pct}%</T></Row>
              <T size={13} muted>Dia {Math.min(today, e.plan.items.length)} de {e.plan.items.length}</T>
            </Pressable>
            {expanded && e.plan.items.map((it, idx) => {
              const done = e.completed.includes(idx);
              return (
                <Row key={idx} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: it.day === today ? c.goldSoft : undefined, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 8 }}>
                  <Pressable onPress={() => toggle(e, idx)} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={it.title} hitSlop={8}
                    style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: done ? c.ok : c.borderStrong, backgroundColor: done ? c.ok : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {done && <Icon name="check" size={15} color="#fff" strokeWidth={2.4} />}
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <T size={12} weight="semi" style={{ color: c.goldText }}>Dia {it.day}</T>
                    <T size={14} style={done ? { textDecorationLine: 'line-through', color: c.muted } : undefined}>{it.title}</T>
                  </View>
                  <Pressable onPress={() => router.push(LINK[it.type as keyof typeof LINK] ?? '/inicio')} hitSlop={8} accessibilityLabel="Abrir">
                    <Icon name={ICON[it.type] ?? 'arrow'} size={19} color={c.goldText} />
                  </Pressable>
                </Row>
              );
            })}
          </Card>
        );
      })}
      <T weight="bold" size={17}>Planos disponíveis</T>
      {plans?.map((p) => (
        <Card key={p.id}>
          <Pill tone="gold">{p.goal}</Pill>
          <T weight="bold" size={16}>{p.title}</T>
          {p.description ? <T muted size={14}>{p.description}</T> : null}
          <Button variant={enrolled.has(p.id) ? 'outline' : 'dark'} disabled={enrolled.has(p.id)} title={enrolled.has(p.id) ? 'Inscrito' : `Começar (${p.items.length} dias)`} onPress={() => enroll(p.id)} />
        </Card>
      ))}
    </Screen>
  );
}
