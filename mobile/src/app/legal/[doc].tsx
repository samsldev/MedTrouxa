import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Kicker, Loading, Notice, Screen, T, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { fonts, useTheme } from '@/lib/theme';
import { useLoad } from '@/lib/useLoad';

interface Doc { title: string; kicker: string; version: string; sections: [string, string][] }

/**
 * Termos e privacidade renderizados no próprio app (variante "app" da API).
 * Não abre o site: as páginas web têm navegação até a área de planos, o que as lojas não permitem dentro do app.
 */
export default function Legal() {
  const { c } = useTheme();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const { data, error } = useLoad(() => api<Doc>(`/legal/${doc === 'privacidade' ? 'privacidade' : 'termos'}?platform=app`));
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{
        headerShown: true, title: data?.title ?? '', headerShadowVisible: false, headerStyle: { backgroundColor: c.bg }, headerTintColor: c.goldText,
        headerTitleStyle: { fontFamily: fonts.serif, fontSize: 21, color: c.text }, headerBackButtonDisplayMode: 'minimal',
      }} />
      {error && !data ? <Notice tone="error">{error}</Notice> : !data ? <Loading /> : (
        <>
          <View><Kicker>{data.kicker}</Kicker><Title size={32}>{data.title}</Title><T muted size={13}>Versão {data.version}</T></View>
          {data.sections.map(([h, t]) => (
            <View key={h} style={{ gap: 6 }}>
              <T weight="bold" size={16}>{h}</T>
              <T size={15} selectable style={{ lineHeight: 23 }}>{t}</T>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}
