import Tabs from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '@/components/Icon';
import { fonts, useTheme } from '@/lib/theme';

const TABS: [string, string, IconName][] = [
  ['inicio', 'Início', 'home'], ['questoes', 'Questões', 'questions'], ['simulados', 'Simulados', 'timer'], ['flashcards', 'Flashcards', 'cards'], ['mais', 'Mais', 'menu'],
];

export default function TabsLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: c.goldText, tabBarInactiveTintColor: c.muted,
      tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, height: 64 + insets.bottom, paddingTop: 4, paddingBottom: Math.max(insets.bottom, 6) },
      tabBarLabelStyle: { fontFamily: fonts.sansSemi, fontSize: 11, lineHeight: 14 },
    }}>
      {TABS.map(([name, title, icon]) => (
        <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color }) => <Icon name={icon} size={22} color={color as string} /> }} />
      ))}
    </Tabs>
  );
}
