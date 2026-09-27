import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import { Card, Header, ListItem, Pill, Row, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useLoad } from '@/lib/useLoad';

const TIER: Record<string, string> = { free: 'Gratuito', aprendiz: 'Aprendiz', alquimista: 'Alquimista', arcano: 'Arcano' };

export default function Mais() {
  const { c } = useTheme();
  const { user, logout } = useAuth();
  // Só informativo: o app não vende nem indica onde comprar (regras da App Store / Google Play)
  const { data: me } = useLoad(() => api<{ limits: { tier: string }; subscription: { expiresAt: string } | null }>('/billing/me'));
  const tier = me?.limits.tier;

  return (
    <Screen>
      <Header kicker="Menu" title="Mais" />
      <Card style={{ backgroundColor: c.accent, borderColor: c.accent }}>
        <T size={18} weight="bold" style={{ color: c.onInk }}>{user?.name}</T>
        <T size={14} style={{ color: c.onInk, opacity: 0.75 }}>{user?.email}</T>
        {tier && (
          <Row gap={8}>
            <Pill tone="gold">Plano {TIER[tier] ?? tier}</Pill>
            {me?.subscription?.expiresAt && <T size={12} style={{ color: c.onInk, opacity: 0.7 }}>até {new Date(me.subscription.expiresAt).toLocaleDateString('pt-BR')}</T>}
          </Row>
        )}
      </Card>
      <Card style={{ paddingVertical: 2, gap: 0 }}>
        <ListItem icon="owl" title="Coruja IA" subtitle="Sua tutora de medicina" onPress={() => router.push('/coruja')} />
        <ListItem icon="calendar" title="Cronogramas" subtitle="Planos de estudo dia a dia" onPress={() => router.push('/cronogramas')} />
        <ListItem icon="trophy" title="Ranking" subtitle="XP da comunidade" onPress={() => router.push('/ranking')} />
      </Card>
      <Card style={{ paddingVertical: 2, gap: 0 }}>
        <ListItem icon="user" title="Minha conta" subtitle="Dados, senha e privacidade" onPress={() => router.push('/conta')} />
        <ListItem icon="shield" title="Segurança" subtitle="Verificação em duas etapas" onPress={() => router.push('/seguranca')} />
      </Card>
      <Card style={{ paddingVertical: 2, gap: 0 }}>
        <ListItem icon="doc" title="Termos de uso" onPress={() => router.push('/legal/termos')} />
        <ListItem icon="lock" title="Política de privacidade" onPress={() => router.push('/legal/privacidade')} />
        <ListItem icon="logout" title="Sair" danger right={<View />} onPress={() => Alert.alert('Sair da conta?', undefined, [
          { text: 'Cancelar', style: 'cancel' }, { text: 'Sair', style: 'destructive', onPress: () => void logout() },
        ])} />
      </Card>
      <T size={12} muted center>MedTrouxa {Constants.expoConfig?.version}</T>
    </Screen>
  );
}
