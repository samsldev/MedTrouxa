import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, View } from 'react-native';
import { Alternative, QuestionMeta } from '@/components/QuestionCard';
import { Button, Card, Loading, Notice, Screen, T, Title } from '@/components/ui';
import { api, Question } from '@/lib/api';
import { fonts, useTheme } from '@/lib/theme';

interface Exam {
  id: string; title: string; startedAt: string; finishedAt: string | null; durationMinutes: number; score: number | null;
  questions: Question[]; answers: { questionId: number; chosenKey: string | null; correct: boolean }[] | null;
}

export default function ExamPage() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const key = `exam:${id}`;
  const [exam, setExam] = useState<Exam | null>(null);
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const submitting = useRef(false);

  useEffect(() => {
    api<Exam>(`/exams/${id}`).then(setExam).catch((e) => setError((e as Error).message));
    AsyncStorage.getItem(key).then((v) => v && setChosen(JSON.parse(v))).catch(() => undefined);
  }, [id, key]);
  // Respostas salvas no aparelho: fechar o app ou perder a rede não apaga o que foi marcado
  useEffect(() => { if (exam && !exam.finishedAt) void AsyncStorage.setItem(key, JSON.stringify(chosen)); }, [chosen, exam, key]);
  // Relógio: a cada segundo atualiza o tempo e, ao zerar, envia sozinho (inclusive ao voltar do segundo plano)
  const tick = useRef<() => void>(() => undefined);
  useEffect(() => {
    const t = setInterval(() => tick.current(), 1000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && tick.current());
    return () => { clearInterval(t); sub.remove(); };
  }, []);

  const deadline = exam ? new Date(exam.startedAt).getTime() + exam.durationMinutes * 60_000 : 0;
  const left = Math.max(0, deadline - now);

  const submit = useCallback(async () => {
    if (!exam || submitting.current) return;
    submitting.current = true;
    try {
      const answers = exam.questions.map((q) => ({ questionId: q.id, chosenKey: chosen[q.id] ?? null }));
      setExam(await api<Exam>(`/exams/${id}/submit`, { body: { answers } }));
      await AsyncStorage.removeItem(key);
    } catch (e) { setError((e as Error).message); submitting.current = false; }
  }, [exam, chosen, id, key]);

  useEffect(() => {
    tick.current = () => {
      const t = Date.now();
      setNow(t);
      if (exam && !exam.finishedAt && t >= deadline) void submit();
    };
  });

  if (!exam) return <Screen edges={[]}>{error ? <Notice tone="error">{error}</Notice> : <Loading />}</Screen>;
  const done = !!exam.finishedAt;
  const result = new Map(exam.answers?.map((a) => [a.questionId, a]) ?? []);
  const mm = String(Math.floor(left / 60000)).padStart(2, '0');
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
  const answered = Object.keys(chosen).length;

  const confirmFinish = () => Alert.alert('Finalizar simulado?', `${answered} de ${exam.questions.length} questões respondidas.`, [
    { text: 'Continuar', style: 'cancel' }, { text: 'Finalizar', style: 'destructive', onPress: () => void submit() },
  ]);

  return (
    <Screen edges={['bottom']}
      footer={!done ? (
        <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface }}>
          <Button variant="foil" title={`Finalizar (${answered}/${exam.questions.length})`} onPress={confirmFinish} />
        </View>
      ) : undefined}>
      <Stack.Screen options={{
        title: exam.title,
        headerRight: () => done ? null : (
          <T accessibilityLabel={`Tempo restante ${mm} minutos e ${ss} segundos`} style={{ fontFamily: fonts.sansBold, fontSize: 16, color: left < 60_000 ? c.ko : c.goldText, fontVariant: ['tabular-nums'], paddingRight: 4 }}>⏱ {mm}:{ss}</T>
        ),
      }} />
      {done && (
        <Card style={{ alignItems: 'center', backgroundColor: c.accent, borderColor: c.accent }}>
          <T size={12} weight="semi" style={{ color: c.gold, letterSpacing: 1.5 }}>SUA NOTA</T>
          <Title size={54} style={{ color: c.onInk }}>{exam.score}%</Title>
          <T size={14} style={{ color: c.onInk, opacity: 0.8 }}>{exam.answers?.filter((a) => a.correct).length ?? 0} acertos em {exam.questions.length} questões</T>
        </Card>
      )}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {exam.questions.map((q, i) => {
        const r = result.get(q.id);
        return (
          <Card key={q.id}>
            <QuestionMeta q={q} index={i + 1} />
            <T size={16} selectable style={{ lineHeight: 25 }}>{q.statement}</T>
            <View style={{ gap: 8 }}>
              {q.alternatives.map((a) => (
                <Alternative key={a.key} letter={a.key} text={a.text} disabled={done} onPress={() => setChosen({ ...chosen, [q.id]: a.key })}
                  state={done ? (a.key === q.correctKey ? 'right' : a.key === r?.chosenKey ? 'wrong' : 'idle') : chosen[q.id] === a.key ? 'selected' : 'idle'} />
              ))}
            </View>
            {done && q.commentary ? <View style={{ backgroundColor: r?.correct ? c.okBg : c.koBg, borderRadius: 10, padding: 12 }}><T size={14} selectable>{q.commentary}</T></View> : null}
          </Card>
        );
      })}
    </Screen>
  );
}
