import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/lib/theme';

/** Mesmo conjunto de ícones do site (traço 1.6, 24×24). */
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  questions: 'M9 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9zM9 4v5H4M8 13h8M8 17h5',
  cards: 'M7 3h11a1 1 0 0 1 1 1v13M4 7h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z',
  timer: 'M12 8v5l3 2M9 2h6M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3',
  owl: 'M5 5l3 2h8l3-2v9a7 7 0 0 1-14 0zM9.5 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM14.5 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM12 15l-1-1h2z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5zM5 19h14',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M19 12H5M11 6l-6 6 6 6',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  menu: 'M4 7h16M4 12h16M4 17h16',
  filter: 'M4 5h16l-6 8v5l-4 2v-7z',
  chevron: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  send: 'M4 12l16-8-6 16-2-7z',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
};
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, color, strokeWidth = 1.6 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const { c } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? c.text} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d={PATHS[name]} />
    </Svg>
  );
}

/** Varinha + estrela de quatro pontas (a marca). */
export function Mark({ size = 32 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width={32} height={32} rx={8} fill={c.markBg} />
      <Path d="M9 23 L20 12" stroke={c.gold} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M22.5 5.5 L23.6 8.4 L26.5 9.5 L23.6 10.6 L22.5 13.5 L21.4 10.6 L18.5 9.5 L21.4 8.4 Z" fill={c.gold} />
      <Circle cx={11} cy={9} r={1} fill={c.gold} opacity={0.7} />
      <Circle cx={24} cy={21} r={1.2} fill={c.gold} opacity={0.5} />
    </Svg>
  );
}
