import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { Empty, Notice, T } from '@/components/ui';
import { api, isPlanError, PLAN_LOCKED_MESSAGE } from '@/lib/api';
import { fonts, useTheme } from '@/lib/theme';

interface Msg { role: 'user' | 'assistant'; content: string }
const SUGGESTIONS = [
  'Resuma o manejo da cetoacidose diabética',
  'Diferença entre sensibilidade e especificidade com exemplo',
  'Quais as pegadinhas de prova sobre pré-eclâmpsia?',
];

export default function Coruja() {
  const { c } = useTheme();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState('');
  const list = useRef<FlatList<Msg>>(null);

  useEffect(() => {
    api<{ limits: { aiPerHour: number } }>('/billing/me').then((m) => { if (!m.limits.aiPerHour) setLocked(PLAN_LOCKED_MESSAGE); }).catch(() => undefined);
  }, []);

  async function send(content: string) {
    if (!content.trim() || busy || locked) return;
    const next: Msg[] = [...msgs, { role: 'user', content: content.trim() }];
    setMsgs(next); setText(''); setBusy(true);
    try {
      const { reply } = await api<{ reply: string }>('/ai/chat', { body: { messages: next.slice(-20) } });
      setMsgs([...next, { role: 'assistant', content: reply }]);
    } catch (e) {
      if (isPlanError(e)) { setLocked(e.message); setMsgs(msgs); return; }
      setMsgs([...next, { role: 'assistant', content: (e as Error).message }]);
    } finally { setBusy(false); }
  }

  const data = busy ? [...msgs, { role: 'assistant' as const, content: '…' }] : msgs;
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
        <FlatList
          ref={list}
          data={data}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={locked ? <View style={{ marginBottom: 8 }}><Notice tone="lock">{locked}</Notice></View> : null}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', gap: 10 }}>
              <Empty icon="owl" title="Sua tutora de medicina" body="Pergunte qualquer coisa: resumos, condutas, pegadinhas de prova…" />
              {!locked && SUGGESTIONS.map((s) => (
                <Pressable key={s} onPress={() => send(s)} accessibilityRole="button" style={({ pressed }) => ({ borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: 12, padding: 12, opacity: pressed ? 0.7 : 1 })}>
                  <T size={14}>{s}</T>
                </Pressable>
              ))}
            </View>
          }
          renderItem={({ item }) => (
            <View style={{
              alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', borderRadius: 16, padding: 12,
              backgroundColor: item.role === 'user' ? c.accent : c.surface, borderWidth: item.role === 'user' ? 0 : 1, borderColor: c.border,
              borderBottomRightRadius: item.role === 'user' ? 4 : 16, borderBottomLeftRadius: item.role === 'user' ? 16 : 4,
            }}>
              <T size={15} selectable style={{ color: item.role === 'user' ? c.onInk : c.text }}>{item.content === '…' && busy ? 'pensando…' : item.content}</T>
            </View>
          )}
          ListFooterComponent={<T size={11} muted center style={{ marginTop: 8 }}>Conteúdo educacional. Não substitui avaliação médica.</T>}
        />
        <View style={{ flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface, alignItems: 'flex-end' }}>
          <TextInput value={text} onChangeText={setText} placeholder="Digite sua dúvida…" placeholderTextColor={c.muted} multiline editable={!locked} maxLength={4000}
            style={{ flex: 1, maxHeight: 120, minHeight: 44, fontFamily: fonts.sans, fontSize: 16, color: c.text, backgroundColor: c.bg, borderRadius: 12, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 11 }} />
          <Pressable onPress={() => send(text)} disabled={busy || !text.trim() || !!locked} accessibilityRole="button" accessibilityLabel="Enviar"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.btnDark, alignItems: 'center', justifyContent: 'center', opacity: busy || !text.trim() || locked ? 0.4 : 1 }}>
            <Icon name="send" size={19} color={c.btnDarkText} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
