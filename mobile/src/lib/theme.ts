import { useColorScheme } from 'react-native';

/** Mesmos tokens do site (meia-noite + pergaminho + ouro antigo), em claro e escuro. */
const light = {
  bg: '#faf7f0', surface: '#ffffff', surface2: '#f4efe4', text: '#15162c', muted: '#6c6a7c', border: '#e8e1d2', borderStrong: '#d8cfbb',
  ink: '#0e1030', ink2: '#1b1e48', onInk: '#f6f1e6', gold: '#b8904f', goldText: '#8f6c33', goldSoft: '#f5eddd', arcane: '#5b4fc4',
  ok: '#1f7a4d', okBg: '#eaf5ee', ko: '#b4372f', koBg: '#fbedeb', btnDark: '#0e1030', btnDarkText: '#f6f1e6', markBg: '#0e1030',
  /** Superfície de destaque (cartões meia-noite): no escuro fica um tom acima do fundo para não sumir. */
  accent: '#0e1030',
};
const dark: typeof light = {
  bg: '#090a17', surface: '#111329', surface2: '#171a35', text: '#ece7dc', muted: '#9b99b0', border: '#23264a', borderStrong: '#31355e',
  ink: '#0b0c1c', ink2: '#1b1e48', onInk: '#ece7dc', gold: '#d4b06c', goldText: '#dcbb7c', goldSoft: '#2a2415', arcane: '#a99eff',
  ok: '#5fd39a', okBg: '#0f2a1e', ko: '#f08a80', koBg: '#2d1515', btnDark: '#ece7dc', btnDarkText: '#0e1030', markBg: '#1b1e48',
  accent: '#1f2352',
};
export type Colors = typeof light;

export const FOIL = ['#f1dca4', '#d2ad63', '#a57e3c', '#e6c982', '#b8904f'] as const;

export const fonts = {
  serif: 'CormorantGaramond_600SemiBold',
  serifItalic: 'CormorantGaramond_600SemiBold_Italic',
  serifBold: 'CormorantGaramond_700Bold',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
};

export const radius = 14;
export const space = (n: number) => n * 4;

export function useTheme() {
  const scheme = useColorScheme();
  return { c: scheme === 'dark' ? dark : light, dark: scheme === 'dark' };
}
