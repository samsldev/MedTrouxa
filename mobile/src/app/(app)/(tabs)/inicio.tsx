import { router } from 'expo-router';
import { View } from 'react-native';
import { Icon, IconName } from '@/components/Icon';
import { Card, Header, Loading, Notice, Progress, Row, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fonts, useTheme } from '@/lib/theme';
import { useLoad } from '@/lib/useLoad';

interface Stats {
  answered: number; correct: number; xp: number; streak: number;
  bySubject: { id: number; name: string; answered: number; correct: number }[];
  daily: { day: string; answered: number }[];
  cards: { studied: number; due: number };
  exams: { done: number; avgScore: number };
}
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: accent ? c.accent : c.surface, borderRadius: 14, borderWidth: 1, borderColor: accent ? c.accent : c.border, padding: 14, gap: 2 }}>
      <T size={11} weight="semi" style={{ color: accent ? c.gold : c.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</T>
      <T style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 34, color: accent ? c.onInk : c.text, fontVariant: ['lining-nums'] }}>{value}</T>
    </View>
  );
}

function Shortcut({ icon, title, subtitle, href }: { icon: IconName; title: string; subtitle: string; href: '/coruja' | '/cronogramas' | '/ranking' }) {
  const { c } = useTheme();
  return (
    <Card onPress={() => router.push(href)} style={{ flexBasis: '30%', flexGrow: 1, padding: 12 }} accessibilityLabel={title}>
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: c.goldSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} color={c.goldText} /></View>
      <View><T weight="semi" size={14} numberOfLines={1}>{title}</T><T size={12} muted numberOfLines={1}>{subtitle}</T></View>
    </Card>
  );
}

export default function Inicio() {
  const { c } = useTheme();
  const { user } = useAuth();
  const { data: s, error, refreshing, refresh } = useLoad(() => api<Stats>('/stats/me'));
  const max = Math.max(1, ...(s?.daily.map((d) => d.answered) ?? [1]));
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Header kicker="Seu painel" title="Olá, " em={user?.name.split(' ')[0]} />
      {error && !s ? <Notice tone="error">{error}</Notice> : !s ? <Loading /> : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Tile accent label="Sequência" value={`${s.streak} ${s.streak === 1 ? 'dia' : 'dias'}`} />
            <Tile accent label="XP" value={s.xp.toLocaleString('pt-BR')} />
            <Tile label="Questões" value={s.answered.toLocaleString('pt-BR')} />
            <Tile label="Aproveitamento" value={`${pct(s.correct, s.answered)}%`} />
            <Tile label="Cards p/ revisar" value={String(s.cards.due)} />
            <Tile label="Simulados · média" value={`${s.exams.done} · ${s.exams.avgScore}%`} />
          </View>

          <Card>
            <T weight="bold">Questões nos últimos 14 dias</T>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 4 }} accessibilityLabel={`Total de ${s.daily.reduce((a, d) => a + d.answered, 0)} questões em 14 dias`}>
              {s.daily.map((d) => (
                <View key={d.day} style={{ flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                  <View style={{ width: '100%', height: `${Math.max(3, (d.answered / max) * 88)}%`, backgroundColor: d.answered ? c.gold : c.surface2, borderRadius: 4 }} />
                  <T size={9} muted>{d.day.slice(8)}</T>
                </View>
              ))}
            </View>
          </Card>

          <Row gap={8}>
            <Shortcut icon="owl" title="Coruja IA" subtitle="Tire dúvidas" href="/coruja" />
            <Shortcut icon="calendar" title="Rotina" subtitle="Cronogramas" href="/cronogramas" />
            <Shortcut icon="trophy" title="Ranking" subtitle="Seu XP" href="/ranking" />
          </Row>

          <Card>
            <T weight="bold">Desempenho por grande área</T>
            {s.bySubject.length === 0 && <T muted size={14}>Resolva questões para ver seu desempenho.</T>}
            {s.bySubject.map((b) => (
              <View key={b.id} style={{ gap: 6 }}>
                <Row><T size={14} style={{ flex: 1 }}>{b.name}</T><T size={13} muted>{pct(b.correct, b.answered)}% · {b.answered}</T></Row>
                <Progress pct={pct(b.correct, b.answered)} />
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
