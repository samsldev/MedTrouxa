import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Button, Card, Empty, Field, Loading, Notice, Row, Screen, T } from '@/components/ui';
import { aiConsent } from '@/lib/aiConsent';
import { api, isPlanError } from '@/lib/api';
import { fonts, useTheme } from '@/lib/theme';

interface CardT { id: number; front: string; back: string }
interface Deck { id: number; name: string; ownerId: string | null; cards: CardT[] }
const GRADES = [[0, 'Errei', 'ko'], [3, 'Difícil', 'mid'], [4, 'Bom', 'ok'], [5, 'Fácil', 'easy']] as const;

export default function DeckReview() {
  const { c } = useTheme();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [queue, setQueue] = useState<CardT[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [form, setForm] = useState({ front: '', back: '' });
  const [aiText, setAiText] = useState('');
  const [aiMsg, setAiMsg] = useState('');
  const [aiLocked, setAiLocked] = useState('');
  const [busy, setBusy] = useState(false);
  const [flip] = useState(() => new Animated.Value(0));

  const load = useCallback(() => {
    api<Deck>(`/flashcards/decks/${id}`).then(setDeck).catch(() => undefined);
    api<CardT[]>(`/flashcards/decks/${id}/due`).then(setQueue).catch(() => undefined);
  }, [id]);
  useEffect(load, [load]);

  const turn = (to: 0 | 1) => { setFlipped(to === 1); Animated.spring(flip, { toValue: to, useNativeDriver: true, friction: 8, tension: 60 }).start(); };

  async function grade(g: number) {
    const card = queue[0];
    flip.setValue(0); setFlipped(false);
    setReviewed((n) => n + 1);
    setQueue((q) => (g < 3 ? [...q.slice(1), card] : q.slice(1)));
    await api(`/flashcards/cards/${card.id}/review`, { body: { grade: g } }).catch(() => undefined);
  }

  async function addCard() {
    setBusy(true);
    try { await api(`/flashcards/decks/${id}/cards`, { body: { front: form.front.trim(), back: form.back.trim() } }); setForm({ front: '', back: '' }); load(); }
    finally { setBusy(false); }
  }

  async function generate() {
    if (!(await aiConsent.ensure())) return;
    setAiMsg('A Coruja está criando os cards…'); setAiLocked('');
    try {
      const { cards } = await api<{ cards: { front: string; back: string }[] }>('/ai/flashcards', { body: { text: aiText } });
      for (const card of cards) await api(`/flashcards/decks/${id}/cards`, { body: card });
      setAiMsg(`${cards.length} cards criados pela Coruja.`); setAiText(''); load();
    } catch (e) { if (isPlanError(e)) { setAiLocked(e.message); setAiMsg(''); } else setAiMsg((e as Error).message); }
  }

  const card = queue[0];
  const { front, back } = useMemo(() => ({
    front: flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }),
    back: flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] }),
  }), [flip]);
  const face = { position: 'absolute' as const, inset: 0, backfaceVisibility: 'hidden' as const, borderRadius: 18, padding: 22, alignItems: 'center' as const, justifyContent: 'center' as const };
  const colors = { ko: c.ko, mid: c.goldText, ok: c.ok, easy: c.arcane };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: deck?.name ?? name ?? 'Baralho' }} />
      {!deck ? <Loading /> : (
        <>
          <T muted size={14}>{deck.cards.length} cards · {reviewed} revisados nesta sessão · {queue.length} na fila</T>
          {card ? (
            <>
              <Pressable onPress={() => turn(flipped ? 0 : 1)} accessibilityRole="button" accessibilityLabel={flipped ? `Resposta: ${card.back}` : `Pergunta: ${card.front}. Toque para ver a resposta`} style={{ height: 300 }}>
                <Animated.View style={[face, { backgroundColor: c.accent, transform: [{ perspective: 1000 }, { rotateY: front }] }]}>
                  <T size={11} weight="semi" style={{ color: c.gold, letterSpacing: 1.5, position: 'absolute', top: 16 }}>PERGUNTA</T>
                  <T center style={{ fontFamily: fonts.serif, fontSize: 25, lineHeight: 31, color: c.onInk, fontVariant: ['lining-nums'] }}>{card.front}</T>
                  <T size={12} style={{ color: c.onInk, opacity: 0.6, position: 'absolute', bottom: 16 }}>toque para virar</T>
                </Animated.View>
                <Animated.View style={[face, { backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.gold, transform: [{ perspective: 1000 }, { rotateY: back }] }]}>
                  <T size={11} weight="semi" style={{ color: c.goldText, letterSpacing: 1.5, position: 'absolute', top: 16 }}>RESPOSTA</T>
                  <T center size={18} style={{ lineHeight: 27 }}>{card.back}</T>
                </Animated.View>
              </Pressable>
              {flipped ? (
                <Row gap={8}>
                  {GRADES.map(([g, label, tone]) => (
                    <Pressable key={g} onPress={() => grade(g)} accessibilityRole="button" accessibilityLabel={label}
                      style={({ pressed }) => ({ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors[tone], alignItems: 'center', opacity: pressed ? 0.7 : 1 })}>
                      <T weight="bold" size={14} style={{ color: colors[tone] }}>{label}</T>
                    </Pressable>
                  ))}
                </Row>
              ) : <Button variant="outline" title="Mostrar resposta" onPress={() => turn(1)} />}
            </>
          ) : <Card><Empty icon="check" title="Tudo revisado por hoje" body="Nenhum card pendente neste baralho. Volte mais tarde!" /></Card>}

          {deck.ownerId !== null && (
            <>
              <Card>
                <T weight="bold">Novo card</T>
                <Field label="Frente (pergunta)" multiline value={form.front} onChangeText={(v) => setForm({ ...form, front: v })} />
                <Field label="Verso (resposta)" multiline value={form.back} onChangeText={(v) => setForm({ ...form, back: v })} />
                <Button title="Adicionar" loading={busy} disabled={!form.front.trim() || !form.back.trim()} onPress={addCard} />
              </Card>
              <Card>
                <T weight="bold">Gerar cards com a Coruja</T>
                {aiLocked ? <Notice tone="lock">{aiLocked}</Notice> : (
                  <>
                    <Field label="Cole um resumo ou trecho de aula" multiline value={aiText} onChangeText={setAiText} />
                    <Button variant="outline" icon="owl" title="Gerar flashcards" disabled={!aiText.trim()} onPress={generate} />
                  </>
                )}
                {aiMsg ? <T muted size={14}>{aiMsg}</T> : null}
              </Card>
            </>
          )}
        </>
      )}
      <View style={{ height: 8 }} />
    </Screen>
  );
}
