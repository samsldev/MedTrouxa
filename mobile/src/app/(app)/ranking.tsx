import { View } from 'react-native';
import { Card, Loading, Row, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { fonts, useTheme } from '@/lib/theme';
import { useLoad } from '@/lib/useLoad';

interface RowT { position: number; name: string; university: string | null; xp: number; me: boolean }
const MEDAL = ['#d4b06c', '#a8adb8', '#b07a4f'];

export default function Ranking() {
  const { c } = useTheme();
  const { data: rows, refreshing, refresh } = useLoad(() => api<RowT[]>('/stats/ranking'));
  return (
    <Screen edges={['bottom']} refreshing={refreshing} onRefresh={refresh}>
      <T muted size={13}>Acerto = 10 XP · questão respondida = 2 XP · card revisado = 2 XP · tarefa do cronograma = 5 XP</T>
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
            </Row>
          ))}
        </Card>
      )}
    </Screen>
  );
}
