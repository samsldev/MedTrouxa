import { CormorantGaramond_600SemiBold, CormorantGaramond_600SemiBold_Italic, CormorantGaramond_700Bold } from '@expo-google-fonts/cormorant-garamond';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button, Logo, T, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { versionLt } from '@/lib/version';

void SplashScreen.preventAutoHideAsync();

interface AppConfig { minVersion: string; storeUrls: { ios: string | null; android: string | null } }

/** Bloqueia versões antigas quando a API deixa de ser compatível (MOBILE_MIN_VERSION no servidor). */
function UpdateRequired({ cfg }: { cfg: AppConfig }) {
  const { c } = useTheme();
  const url = Platform.OS === 'ios' ? cfg.storeUrls.ios : cfg.storeUrls.android;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 }}>
      <Logo />
      <Title center size={30} em="nova versão">Atualize para a </Title>
      <T muted center>Esta versão do app não é mais compatível. Atualize para continuar estudando.</T>
      {url && <Button variant="foil" title="Atualizar agora" onPress={() => Linking.openURL(url)} />}
    </View>
  );
}

function Root() {
  const { c, dark } = useTheme();
  const { loading, offline, retry } = useAuth();
  const [fontsLoaded] = useFonts({
    CormorantGaramond_600SemiBold, CormorantGaramond_600SemiBold_Italic, CormorantGaramond_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  useEffect(() => { api<AppConfig>('/app/config').then(setCfg).catch(() => undefined); }, []);
  const ready = fontsLoaded && !loading;
  useEffect(() => { if (ready) void SplashScreen.hideAsync(); }, [ready]);
  if (!fontsLoaded) return null;
  // Enquanto restaura a sessão (na abertura fica sob a splash; em "tentar de novo" mostra o indicador)
  if (loading) return <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.gold} /></View>;

  const theme = dark ? DarkTheme : DefaultTheme;
  const current = Constants.expoConfig?.version ?? '0.0.0';
  if (cfg && versionLt(current, cfg.minVersion)) return <UpdateRequired cfg={cfg} />;
  if (offline) return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 }}>
      <Logo />
      <Title center size={30} em="conexão">Sem </Title>
      <T muted center>Não conseguimos falar com o MedTrouxa. Confira sua internet e tente de novo — sua sessão continua salva.</T>
      <Button title="Tentar de novo" onPress={retry} />
    </View>
  );

  return (
    <ThemeProvider value={{ ...theme, colors: { ...theme.colors, background: c.bg, card: c.bg, text: c.text, primary: c.gold, border: c.border } }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
    </ThemeProvider>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
