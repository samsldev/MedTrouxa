import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ReactNode, useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps,
  TextStyle, View, ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FOIL, fonts, radius, useTheme } from '@/lib/theme';
import { Icon, IconName, Mark } from './Icon';

// ---------------- tipografia ----------------
export function T({ children, style, muted, size = 15, weight = 'regular', center, numberOfLines, selectable, accessibilityLabel }: {
  children: ReactNode; accessibilityLabel?: string; style?: StyleProp<TextStyle>; muted?: boolean; size?: number; weight?: 'regular' | 'medium' | 'semi' | 'bold'; center?: boolean; numberOfLines?: number; selectable?: boolean;
}) {
  const { c } = useTheme();
  const family = { regular: fonts.sans, medium: fonts.sansMedium, semi: fonts.sansSemi, bold: fonts.sansBold }[weight];
  return (
    <Text accessibilityLabel={accessibilityLabel} selectable={selectable} numberOfLines={numberOfLines} style={[{ fontFamily: family, fontSize: size, lineHeight: size * 1.5, color: muted ? c.muted : c.text, textAlign: center ? 'center' : undefined }, style]}>
      {children}
    </Text>
  );
}

/** Título serifado; `em` vira itálico dourado, como no site. */
export function Title({ children, em, size = 32, style, center }: { children?: ReactNode; em?: string; size?: number; style?: StyleProp<TextStyle>; center?: boolean }) {
  const { c } = useTheme();
  return (
    <Text accessibilityRole="header" style={[{ fontFamily: fonts.serif, fontSize: size, lineHeight: size * 1.12, color: c.text, letterSpacing: -0.3, fontVariant: ['lining-nums'], textAlign: center ? 'center' : undefined }, style]}>
      {children}{em ? <Text style={{ fontFamily: fonts.serifItalic, color: c.goldText }}>{em}</Text> : null}
    </Text>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return <Text style={{ fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: c.goldText, marginBottom: 6 }}>✦ {children}</Text>;
}

export function Logo({ size = 30 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Mark size={size} />
      <Text style={{ fontFamily: fonts.serif, fontSize: size * 0.8, color: c.text }}>Med<Text style={{ fontFamily: fonts.serifItalic, color: c.goldText }}>Trouxa</Text></Text>
    </View>
  );
}

// ---------------- layout ----------------
export function Screen({ children, scroll = true, refreshing, onRefresh, padded = true, edges = ['top'], footer }: {
  children: ReactNode; scroll?: boolean; refreshing?: boolean; onRefresh?(): void; padded?: boolean; edges?: ('top' | 'bottom')[]; footer?: ReactNode;
}) {
  const { c } = useTheme();
  const pad = padded ? { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32 } : undefined;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={[pad, { gap: 14 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.gold} colors={[c.gold]} /> : undefined}>
          {children}
        </ScrollView>
      ) : <View style={[{ flex: 1 }, pad]}>{children}</View>}
      {footer}
    </SafeAreaView>
  );
}

export function Header({ kicker, title, em, subtitle, right }: { kicker?: string; title: string; em?: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 4 }}>
      <View style={{ flex: 1 }}>
        {kicker && <Kicker>{kicker}</Kicker>}
        <Title em={em}>{title}</Title>
        {subtitle && <T muted style={{ marginTop: 4 }}>{subtitle}</T>}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?(): void; accessibilityLabel?: string }) {
  const { c, dark } = useTheme();
  const base: ViewStyle = {
    backgroundColor: c.surface, borderRadius: radius, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, padding: 16, gap: 10,
    ...(dark ? {} : Platform.select({ ios: { shadowColor: '#0e1030', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }, android: { elevation: 1 } })),
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [base, style, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
      {children}
    </Pressable>
  );
}

export function Row({ children, gap = 10, style, wrap }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : undefined }, style]}>{children}</View>;
}

// ---------------- botões ----------------
type Variant = 'dark' | 'foil' | 'outline' | 'text' | 'danger';
export function Button({ title, onPress, variant = 'dark', disabled, loading, icon, block = true, small }: {
  title: string; onPress?(): void; variant?: Variant; disabled?: boolean; loading?: boolean; icon?: IconName; block?: boolean; small?: boolean;
}) {
  const { c } = useTheme();
  const fg = { dark: c.btnDarkText, foil: '#1a1406', outline: c.text, text: c.goldText, danger: '#fff' }[variant];
  const off = disabled || loading;
  const inner = (
    <Row gap={8} style={{ justifyContent: 'center' }}>
      {loading ? <ActivityIndicator color={fg} size="small" /> : icon ? <Icon name={icon} size={17} color={fg} /> : null}
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: small ? 14 : 15.5, color: fg }}>{title}</Text>
    </Row>
  );
  const shape: ViewStyle = { minHeight: small ? 40 : 50, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center', alignSelf: block ? 'stretch' : 'flex-start' };
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!loading }} disabled={off}
      onPress={() => { if (Platform.OS !== 'web') void Haptics.selectionAsync(); onPress?.(); }}
      style={({ pressed }) => [{ opacity: off ? 0.5 : pressed ? 0.85 : 1, borderRadius: 12, alignSelf: block ? 'stretch' : 'flex-start' }]}>
      {variant === 'foil' ? (
        <LinearGradient colors={FOIL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={shape}>{inner}</LinearGradient>
      ) : (
        <View style={[shape, {
          backgroundColor: variant === 'dark' ? c.btnDark : variant === 'danger' ? c.ko : 'transparent',
          borderWidth: variant === 'outline' ? 1 : 0, borderColor: c.borderStrong, minHeight: variant === 'text' ? 40 : shape.minHeight,
        }]}>{inner}</View>
      )}
    </Pressable>
  );
}

// ---------------- formulário ----------------
export function Field({ label, error, hint, style, ...props }: TextInputProps & { label: string; error?: string | false; hint?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ gap: 6 }, style]}>
      <T size={13} weight="semi" style={{ color: error ? c.ko : c.muted }}>{label}</T>
      <TextInput placeholderTextColor={c.muted} {...props}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }} onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={{
          fontFamily: fonts.sans, fontSize: 16, color: c.text, backgroundColor: c.surface, borderWidth: 1.2, borderRadius: 12,
          borderColor: error ? c.ko : focus ? c.gold : c.border, paddingHorizontal: 14, paddingVertical: props.multiline ? 12 : 0,
          minHeight: props.multiline ? 110 : 50, textAlignVertical: props.multiline ? 'top' : 'center',
        }} />
      {error ? <T size={12.5} style={{ color: c.ko }}>{error}</T> : hint ? <T size={12.5} muted>{hint}</T> : null}
    </View>
  );
}

export function Check({ value, onChange, children }: { value: boolean; onChange(v: boolean): void; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: value ? c.gold : c.borderStrong, backgroundColor: value ? c.gold : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {value && <Icon name="check" size={15} color="#fff" strokeWidth={2.4} />}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

/** Seletor em folha inferior (substitui o <select> do web). */
export function Picker<V extends string>({ label, value, options, onChange, placeholder = 'Selecione', disabled }: {
  label: string; value: V | ''; options: { value: V | ''; label: string }[]; onChange(v: V | ''): void; placeholder?: string; disabled?: boolean;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${current?.label ?? placeholder}`} disabled={disabled} onPress={() => setOpen(true)}
        style={{ flexGrow: 1, flexBasis: '45%', minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: value ? c.gold : c.border, backgroundColor: value ? c.goldSoft : c.surface, paddingHorizontal: 12, justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}>
        <T size={11} muted weight="semi">{label}</T>
        <Row gap={4}><T size={14} weight="medium" numberOfLines={1} style={{ flex: 1 }}>{current?.label ?? placeholder}</T><Icon name="down" size={14} color={c.muted} /></Row>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(5,6,20,.55)' }} onPress={() => setOpen(false)} accessibilityLabel="Fechar" />
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' }}>
          <View style={{ alignItems: 'center', paddingTop: 8 }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong }} /></View>
          <T weight="bold" size={16} style={{ paddingHorizontal: 20, paddingVertical: 12 }}>{label}</T>
          <ScrollView>
            {options.map((o) => (
              <Pressable key={o.value || '_'} accessibilityRole="button" accessibilityState={{ selected: o.value === value }} onPress={() => { onChange(o.value); setOpen(false); }}
                style={({ pressed }) => ({ paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: pressed ? c.surface2 : undefined })}>
                <T style={{ flex: 1 }} weight={o.value === value ? 'semi' : 'regular'}>{o.label}</T>
                {o.value === value && <Icon name="check" size={18} color={c.gold} />}
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

// ---------------- estados ----------------
export function Notice({ children, tone = 'info', icon }: { children: ReactNode; tone?: 'info' | 'error' | 'ok' | 'lock'; icon?: IconName }) {
  const { c } = useTheme();
  const bg = { info: c.goldSoft, error: c.koBg, ok: c.okBg, lock: c.surface2 }[tone];
  const fg = { info: c.goldText, error: c.ko, ok: c.ok, lock: c.text }[tone];
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : undefined} style={{ flexDirection: 'row', gap: 10, backgroundColor: bg, borderRadius: 12, padding: 12, alignItems: 'flex-start' }}>
      {(icon || tone === 'lock') && <Icon name={icon ?? 'lock'} size={18} color={fg} />}
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <T size={14} style={{ color: fg }}>{children}</T> : children}</View>
    </View>
  );
}

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  const { c } = useTheme();
  return <View style={{ padding: 40, alignItems: 'center', gap: 10 }}><ActivityIndicator color={c.gold} /><T muted size={14}>{label}</T></View>;
}

export function Empty({ title, body, icon = 'spark' }: { title: string; body?: string; icon?: IconName }) {
  const { c } = useTheme();
  return (
    <View style={{ padding: 28, alignItems: 'center', gap: 8 }}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.goldSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={24} color={c.goldText} /></View>
      <T weight="semi" center>{title}</T>
      {body && <T muted center size={14}>{body}</T>}
    </View>
  );
}

export function Pill({ children, tone }: { children: ReactNode; tone?: 'easy' | 'medium' | 'hard' | 'gold' }) {
  const { c } = useTheme();
  const fg = tone === 'easy' ? c.ok : tone === 'hard' ? c.ko : tone === 'gold' || tone === 'medium' ? c.goldText : c.muted;
  const bg = tone === 'easy' ? c.okBg : tone === 'hard' ? c.koBg : tone ? c.goldSoft : c.surface2;
  return <View style={{ backgroundColor: bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 }}><T size={12} weight="semi" style={{ color: fg }}>{children}</T></View>;
}

export function Progress({ pct, height = 8 }: { pct: number; height?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ height, borderRadius: height, backgroundColor: c.surface2, overflow: 'hidden', flex: 1 }}>
      <LinearGradient colors={FOIL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%' }} />
    </View>
  );
}

export function ListItem({ icon, title, subtitle, onPress, danger, right }: { icon: IconName; title: string; subtitle?: string; onPress?(): void; danger?: boolean; right?: ReactNode }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 4, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: danger ? c.koBg : c.goldSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={19} color={danger ? c.ko : c.goldText} />
      </View>
      <View style={{ flex: 1 }}>
        <T weight="semi" style={danger ? { color: c.ko } : undefined}>{title}</T>
        {subtitle && <T size={13} muted>{subtitle}</T>}
      </View>
      {right ?? <Icon name="chevron" size={18} color={c.muted} />}
    </Pressable>
  );
}
