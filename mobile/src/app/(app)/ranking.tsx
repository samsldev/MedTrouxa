import { Pressable, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useReport } from '@/components/ReportSheet';
import { Card, Loading, Row, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { fonts, useTheme } from '@/lib/theme';
import { useLoad } from '@/lib/useLoad';

interface RowT { position: number; name: string; university: string | null; xp: number; me: boolean; ref?: string }
const MEDAL = ['#d4b06c', '#a8adb8', '#b07a4f'];

export default function Ranking() {
  const { c } = useTheme();
  const { data: rows, refreshing, refresh } = useLoad(() => api<RowT[]>('/stats/ranking'));
  const [report, reportSheet] = useReport();
  return (
    <Screen edges={['bottom']} refreshing={refreshing} onRefresh={refresh}>
      {reportSheet}
      <T muted size={13}>Acerto = 10 XP · questão respondida = 2 XP · card revisado = 2 XP · tarefa do cronograma = 5 XP</T>
      <T muted size={12}>Viu um nome ofensivo? Toque no escudo ao lado dele para denunciar.</T>
      {!rows ? <Loading /> : (
        <Card style={{ padding: 6, gap: 0 }}>
          {rows.map((r, i) => (
            <Row key={r.position} style={{ padding: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.border, backgroundColor: r.me ? c.goldSoft : undefined, borderRadius: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: MEDAL[r.position - 1] ?? c.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <T size={13} weight="bold" style={{ color: r.position <= 3 ? '#1a1406' : c.muted }}>{r.position}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T weight={r.me ? 'bold' : 'semi'}>{r.name}{r.me ? ' (você)' : ''}</T>
                <T size={12} muted>{r.university ?? '—'}</T>
              </View>
              <T style={{ fontFamily: fonts.serif, fontSize: 20, fontVariant: ['lining-nums'] }}>{r.xp.toLocaleString('pt-BR')}</T>
              {r.ref ? (
                <Pressable onPress={() => report({ kind: 'ranking_name', ref: r.ref!, label: r.name })} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Denunciar o nome ${r.name}`}>
                  <Icon name="shield" size={16} color={c.muted} />
                </Pressable>
              ) : <View style={{ width: 16 }} />}
            </Row>
          ))}
        </Card>
      )}
    </Screen>
  );
}
