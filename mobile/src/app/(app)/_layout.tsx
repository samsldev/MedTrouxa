import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { fonts, useTheme } from '@/lib/theme';

/** Área logada: sem sessão volta para o login. Telas de detalhe usam o cabeçalho nativo (voltar com gesto). */
export default function AppLayout() {
  const { user } = useAuth();
  const { c } = useTheme();
  if (!user) return <Redirect href="/login" />;
  return (
    <Stack screenOptions={{
      headerShadowVisible: false, headerStyle: { backgroundColor: c.bg }, headerTintColor: c.goldText,
      headerTitleStyle: { fontFamily: fonts.serif, fontSize: 21, color: c.text }, headerBackButtonDisplayMode: 'minimal',
      contentStyle: { backgroundColor: c.bg },
    }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="flashcards/[id]" options={{ title: 'Baralho' }} />
      <Stack.Screen name="simulados/[id]" options={{ title: 'Simulado', gestureEnabled: false }} />
      <Stack.Screen name="coruja" options={{ title: 'Coruja IA' }} />
      <Stack.Screen name="cronogramas" options={{ title: 'Cronogramas' }} />
      <Stack.Screen name="ranking" options={{ title: 'Ranking' }} />
      <Stack.Screen name="conta" options={{ title: 'Minha conta' }} />
      <Stack.Screen name="seguranca" options={{ title: 'Segurança' }} />
    </Stack>
  );
}
