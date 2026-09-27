import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { api, isPlanError, Question } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { Button, Card, Notice, Pill, Row, T } from './ui';

interface Result { correct: boolean; correctKey: string; commentary: string }
const DIFF = { easy: 'Fácil', medium: 'Média', hard: 'Difícil' } as const;

/** Alternativa: estado neutro, escolhida, certa ou errada (mesmo esquema de cores do site). */
export function Alternative({ letter, text, state, onPress, disabled, extra }: {
  letter: string; text: string; state: 'idle' | 'selected' | 'right' | 'wrong'; onPress?(): void; disabled?: boolean; extra?: string;
}) {
  const { c } = useTheme();
  const border = { idle: c.border, selected: c.gold, right: c.ok, wrong: c.ko }[state];
  const bg = { idle: c.surface, selected: c.goldSoft, right: c.okBg, wrong: c.koBg }[state];
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: state === 'selected', disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1.4, borderColor: border, backgroundColor: bg, opacity: pressed ? 0.8 : 1 })}>
      <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.4, borderColor: border, alignItems: 'center', justifyContent: 'center', backgroundColor: state === 'idle' ? 'transparent' : border }}>
        <T size={13} weight="bold" style={{ color: state === 'idle' ? c.muted : '#fff' }}>{letter}</T>
      </View>
      <T size={15} style={{ flex: 1 }}>{text}</T>
      {extra ? <T size={12} weight="semi" muted>{extra}</T> : null}
    </Pressable>
  );
}

export function QuestionMeta({ q, index }: { q: Question; index?: number }) {
  return (
    <Row gap={6} wrap>
      {index !== undefined && <T weight="bold" size={14}>#{index}</T>}
      {q.topic?.name && <Pill>{q.topic.name}</Pill>}
      {q.institution && <Pill>{q.institution} {q.year ?? ''}</Pill>}
      <Pill tone={q.difficulty}>{DIFF[q.difficulty] ?? q.difficulty}</Pill>
    </Row>
  );
}

export default function QuestionCard({ q, index }: { q: Question; index?: number }) {
  const { c } = useTheme();
  const [chosen, setChosen] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [dist, setDist] = useState<Record<string, number> | null>(null);
  const [ai, setAi] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [locked, setLocked] = useState<string | null>(null);
  const [aiLocked, setAiLocked] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function answer() {
    if (!chosen) return;
    setBusy(true); setError('');
    try {
      setResult(await api<Result>(`/questions/${q.id}/answer`, { body: { chosenKey: chosen } }));
      api<{ byKey: Record<string, number> }>(`/questions/${q.id}/stats`).then((d) => setDist(d.byKey)).catch(() => undefined);
    } catch (e) { if (isPlanError(e)) setLocked(e.message); else setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function explain() {
    setAiBusy(true);
    try { setAi((await api<{ reply: string }>(`/ai/explain/${q.id}`, { body: {} })).reply); }
    catch (e) { if (isPlanError(e)) setAiLocked(e.message); else setAi((e as Error).message); }
    finally { setAiBusy(false); }
  }

  return (
    <Card>
      <QuestionMeta q={q} index={index} />
      <T size={16} selectable style={{ lineHeight: 25 }}>{q.statement}</T>
      <View style={{ gap: 8 }} accessibilityRole="radiogroup">
        {q.alternatives.map((a) => (
          <Alternative key={a.key} letter={a.key} text={a.text} disabled={!!result} onPress={() => setChosen(a.key)} extra={dist ? `${dist[a.key] ?? 0}%` : undefined}
            state={result ? (a.key === result.correctKey ? 'right' : a.key === chosen ? 'wrong' : 'idle') : a.key === chosen ? 'selected' : 'idle'} />
        ))}
      </View>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {locked ? <Notice tone="lock">{locked}</Notice> : !result ? (
        <Button title="Responder" disabled={!chosen} loading={busy} onPress={answer} />
      ) : (
        <View style={{ gap: 10, backgroundColor: result.correct ? c.okBg : c.koBg, borderRadius: 12, padding: 14 }}>
          <T weight="bold" style={{ color: result.correct ? c.ok : c.ko }}>{result.correct ? 'Acertou!' : `Errou — gabarito: ${result.correctKey}`}</T>
          <T size={15} selectable>{result.commentary}</T>
          {!ai && !aiLocked && <Button variant="outline" icon="owl" title={aiBusy ? 'A Coruja está pensando…' : 'Explicar com a Coruja'} loading={aiBusy} onPress={explain} />}
          {aiLocked && <Notice tone="lock">{aiLocked}</Notice>}
          {ai && <View style={{ backgroundColor: c.surface, borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: c.gold }}><T size={15} selectable>{ai}</T></View>}
        </View>
      )}
    </Card>
  );
}
