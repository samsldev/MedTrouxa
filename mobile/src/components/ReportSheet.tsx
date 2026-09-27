import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { Icon } from './Icon';
import { Notice, T } from './ui';

const REASONS = [['ofensivo', 'Ofensivo ou impróprio'], ['incorreto', 'Informação médica incorreta'], ['perigoso', 'Perigoso ou prejudicial'], ['outro', 'Outro motivo']] as const;
type Target = { kind: 'ai_reply'; content: string } | { kind: 'ranking_name'; ref: string; label: string };

/** Denúncia de conteúdo (resposta da IA ou nome no ranking) — exigência das lojas para conteúdo gerado. */
export function useReport(): [(t: Target) => void, React.ReactNode] {
  const { c } = useTheme();
  const [target, setTarget] = useState<Target | null>(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => { setTarget(null); setStatus(null); };

  async function send(reason: string) {
    if (!target) return;
    setBusy(true);
    try {
      const r = await api<{ message: string }>('/reports', { body: target.kind === 'ai_reply' ? { kind: target.kind, content: target.content, reason } : { kind: target.kind, ref: target.ref, reason } });
      setStatus({ tone: 'ok', text: r.message });
      setTimeout(close, 1600);
    } catch (e) { setStatus({ tone: 'error', text: (e as Error).message }); } finally { setBusy(false); }
  }

  const sheet = (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(5,6,20,.55)' }} onPress={close} accessibilityLabel="Fechar" />
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 }}>
        <T weight="bold" size={17}>{target?.kind === 'ranking_name' ? `Denunciar o nome "${target.label}"` : 'Denunciar esta resposta da IA'}</T>
        <T muted size={14}>Nossa equipe analisa todas as denúncias. Escolha o motivo:</T>
        {status ? <Notice tone={status.tone}>{status.text}</Notice> : REASONS
          .filter(([k]) => target?.kind === 'ai_reply' || k === 'ofensivo' || k === 'outro')
          .map(([k, label]) => (
            <Pressable key={k} disabled={busy} onPress={() => send(k)} accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, opacity: pressed || busy ? 0.6 : 1 })}>
              <Icon name="shield" size={18} color={c.ko} /><T style={{ flex: 1 }}>{label}</T><Icon name="chevron" size={16} color={c.muted} />
            </Pressable>
          ))}
        {!status && <Pressable onPress={close} accessibilityRole="button" style={{ padding: 12, alignItems: 'center' }}><T weight="semi" muted>Cancelar</T></Pressable>}
        <View />
      </SafeAreaView>
    </Modal>
  );
  return [setTarget, sheet];
}
