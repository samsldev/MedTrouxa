import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Empty, Field, Header, Notice, Pill, Row, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';

interface Deck { id: number; name: string; description?: string; ownerId: string | null; cardCount: number; due: number; topic?: { name: string } }

export default function Flashcards() {
  const { data: decks, refreshing, refresh } = useLoad(() => api<Deck[]>('/flashcards/decks'));
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  async function create() {
    if (!name.trim()) return;
    setError('');
    try { await api('/flashcards/decks', { body: { name: name.trim() } }); setName(''); refresh(); }
    catch (e) { setError((e as Error).message); }
  }
  const due = decks?.reduce((a, d) => a + d.due, 0) ?? 0;
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Header kicker="Memória" title="Flash" em="cards" subtitle="Repetição espaçada: cada card volta no momento certo para fixar de vez." />
      {due > 0 && <Notice icon="spark">{`${due} ${due === 1 ? 'card pronto' : 'cards prontos'} para revisar hoje.`}</Notice>}
      <Row gap={8} style={{ alignItems: 'flex-end' }}>
        <Field style={{ flex: 1 }} label="Novo baralho" placeholder="Ex.: Cardiologia — arritmias" value={name} onChangeText={setName} onSubmitEditing={create} returnKeyType="done" />
        <View style={{ width: 96 }}><Button title="Criar" disabled={!name.trim()} onPress={create} /></View>
      </Row>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {decks?.length === 0 && <Empty icon="cards" title="Nenhum baralho ainda" />}
      {decks?.map((d) => (
        <Card key={d.id} onPress={() => router.push({ pathname: '/flashcards/[id]', params: { id: String(d.id), name: d.name } })} accessibilityLabel={`${d.name}, ${d.due} para revisar`}>
          <Row>
            <View style={{ flex: 1, gap: 2 }}>
              <T weight="semi" size={16}>{d.name}</T>
              <T size={13} muted>{d.topic?.name ?? (d.ownerId ? 'Meu baralho' : 'Geral')} · {d.cardCount} cards</T>
            </View>
            {d.due > 0 ? <Pill tone="gold">{d.due} p/ revisar</Pill> : <Pill>em dia</Pill>}
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
