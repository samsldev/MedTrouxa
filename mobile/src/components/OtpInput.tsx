import { useEffect, useRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { fonts, useTheme } from '@/lib/theme';
import { T } from './ui';

/**
 * Código de 6 dígitos: um campo invisível recebe a digitação (e o preenchimento automático do iOS/Android),
 * as 6 casas só desenham os dígitos.
 */
export default function OtpInput({ value, onChange, onComplete, disabled, autoFocus = true }: {
  value: string; onChange(v: string): void; onComplete?(v: string): void; disabled?: boolean; autoFocus?: boolean;
}) {
  const { c } = useTheme();
  const ref = useRef<TextInput>(null);
  useEffect(() => { if (autoFocus) setTimeout(() => ref.current?.focus(), 250); }, [autoFocus]);
  const set = (raw: string) => {
    const clean = raw.replace(/\D/g, '').slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
  };
  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel="Código de 6 dígitos" accessibilityHint="Toque para digitar">
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
        {Array.from({ length: 6 }, (_, i) => {
          const active = !disabled && i === Math.min(value.length, 5);
          return (
            <View key={i} style={{ width: 46, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: active ? c.gold : c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', marginRight: i === 2 ? 10 : 0 }}>
              <T size={24} style={{ fontFamily: fonts.sansSemi }}>{value[i] ?? ''}</T>
            </View>
          );
        })}
      </View>
      <TextInput ref={ref} value={value} onChangeText={set} editable={!disabled} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp"
        maxLength={6} caretHidden style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} accessibilityLabel="Código" />
    </Pressable>
  );
}
