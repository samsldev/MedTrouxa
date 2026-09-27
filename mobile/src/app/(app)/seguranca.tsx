import * as Clipboard from 'expo-clipboard';
import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, useState } from 'react';
import { Image, Linking, Share, View } from 'react-native';
import { Icon } from '@/components/Icon';
import OtpInput from '@/components/OtpInput';
import { Button, Card, Check, Field, Loading, Notice, Row, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';

interface Security { emailVerified: boolean; twoFactorMethod: 'totp' | 'email' | null; twoFactorEnabledAt: string | null; recoveryCodesLeft: number }
type Flow =
  | { kind: 'idle' }
  | { kind: 'totp'; qr: string; secret: string; otpauth?: string }
  | { kind: 'email'; challenge: string }
  | { kind: 'codes'; codes: string[] }
  | { kind: 'confirm'; action: 'disable' | 'regenerate'; challenge?: string };

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone(): void }) {
  const [saved, setSaved] = useState(false);
  const text = `MedTrouxa — códigos de recuperação\nGerados em ${new Date().toLocaleString('pt-BR')}\nCada código pode ser usado uma única vez.\n\n${codes.join('\n')}\n`;
  return (
    <View style={{ gap: 12 }}>
      <Notice icon="shield">Guarde estes códigos em local seguro (gerenciador de senhas, por exemplo). Eles são a única forma de entrar se você perder o segundo fator e não serão mostrados de novo.</Notice>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {codes.map((c) => <View key={c} style={{ flexBasis: '47%', flexGrow: 1 }}><T selectable center weight="semi" style={{ fontVariant: ['tabular-nums'], letterSpacing: 1 }}>{c}</T></View>)}
      </View>
      <Row gap={8}>
        <View style={{ flex: 1 }}><Button variant="outline" small title="Copiar" onPress={() => Clipboard.setStringAsync(codes.join('\n'))} /></View>
        <View style={{ flex: 1 }}><Button variant="outline" small title="Compartilhar" onPress={() => Share.share({ message: text })} /></View>
      </Row>
      <Check value={saved} onChange={setSaved}><T size={14}>Guardei meus códigos de recuperação em local seguro.</T></Check>
      <Button title="Concluir" disabled={!saved} onPress={onDone} />
    </View>
  );
}

export default function Seguranca() {
  const { c } = useTheme();
  // Segredo do 2FA e códigos de recuperação: sem print, gravação ou miniatura no multitarefa (MASVS-PLATFORM)
  ScreenCapture.usePreventScreenCapture('seguranca');
  useEffect(() => {
    void ScreenCapture.enableAppSwitcherProtectionAsync(0.9).catch(() => undefined);
    return () => { void ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => undefined); };
  }, []);
  const [sec, setSec] = useState<Security | null>(null);
  const [flow, setFlow] = useState<Flow>({ kind: 'idle' });
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api<Security>('/account/security').then(setSec).catch((e) => setError((e as Error).message));
  useEffect(() => { void load(); }, []);
  const reset = (f: Flow = { kind: 'idle' }) => { setFlow(f); setCode(''); setPassword(''); setError(''); setUseRecovery(false); };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError((e as Error).message); setCode(''); } finally { setBusy(false); }
  };

  const startTotp = () => run(async () => reset({ kind: 'totp', ...(await api<{ qr: string; secret: string; otpauth?: string }>('/account/2fa/totp/setup', { method: 'POST' })) }));
  const startEmail = () => run(async () => reset({ kind: 'email', ...(await api<{ challenge: string }>('/account/2fa/email/setup', { method: 'POST' })) }));
  const enable = (value = code) => run(async () => {
    const r = flow.kind === 'totp'
      ? await api<{ recoveryCodes: string[] }>('/account/2fa/totp/enable', { body: { code: value } })
      : await api<{ recoveryCodes: string[] }>('/account/2fa/email/enable', { body: { challenge: (flow as { challenge: string }).challenge, code: value } });
    reset({ kind: 'codes', codes: r.recoveryCodes }); void load();
  });
  const startConfirm = (action: 'disable' | 'regenerate') => run(async () => {
    const challenge = sec?.twoFactorMethod === 'email' ? (await api<{ challenge: string }>('/account/2fa/confirm-code', { method: 'POST' })).challenge : undefined;
    reset({ kind: 'confirm', action, challenge });
  });
  const confirm = () => run(async () => {
    if (flow.kind !== 'confirm') return;
    const body = { password, code, method: useRecovery ? 'recovery' : sec!.twoFactorMethod, challenge: flow.challenge };
    if (flow.action === 'disable') { await api('/account/2fa/disable', { body }); reset(); }
    else reset({ kind: 'codes', codes: (await api<{ recoveryCodes: string[] }>('/account/2fa/recovery-codes', { body })).recoveryCodes });
    void load();
  });

  if (!sec) return <Screen edges={['bottom']}>{error ? <Notice tone="error">{error}</Notice> : <Loading />}</Screen>;
  return (
    <Screen edges={['bottom']}>
      <Card>
        <Row gap={12}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: sec.twoFactorMethod ? c.okBg : c.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={sec.twoFactorMethod ? 'shield' : 'lock'} color={sec.twoFactorMethod ? c.ok : c.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <T weight="bold">Verificação em duas etapas</T>
            <T muted size={13}>{sec.twoFactorMethod
              ? `Ativada via ${sec.twoFactorMethod === 'totp' ? 'app autenticador' : 'e-mail'} · ${sec.recoveryCodesLeft} códigos de recuperação restantes`
              : 'Proteja sua conta pedindo um código além da senha ao entrar.'}</T>
          </View>
        </Row>

        {flow.kind === 'idle' && !sec.twoFactorMethod && (
          <View style={{ gap: 8 }}>
            <Button icon="shield" title="App autenticador" loading={busy} onPress={startTotp} />
            <T size={12} muted center>Recomendado: Google Authenticator, Microsoft Authenticator, Authy, 1Password…</T>
            <Button variant="outline" icon="spark" title="Código por e-mail" disabled={busy} onPress={startEmail} />
          </View>
        )}

        {flow.kind === 'totp' && (
          <View style={{ gap: 12 }}>
            <T size={14}>1. Adicione o MedTrouxa no seu app autenticador (Google Authenticator, Microsoft Authenticator, Authy, 1Password…).</T>
            {flow.otpauth && <Button variant="foil" title="Abrir no app autenticador" onPress={() => Linking.openURL(flow.otpauth!).catch(() => setError('Nenhum app autenticador encontrado. Use a chave manual abaixo.'))} />}
            <View style={{ alignItems: 'center', gap: 6 }}>
              <T size={13} muted>Ou escaneie de outro aparelho</T>
              <Image source={{ uri: flow.qr }} style={{ width: 180, height: 180, borderRadius: 8 }} accessibilityLabel="QR Code do app autenticador" />
            </View>
            <View style={{ backgroundColor: c.surface2, borderRadius: 10, padding: 12, gap: 4 }}>
              <T size={12} muted>Chave manual</T>
              <T selectable weight="semi" style={{ letterSpacing: 1.5 }}>{flow.secret}</T>
              <Button small variant="text" block={false} title="Copiar chave" onPress={() => Clipboard.setStringAsync(flow.secret.replace(/ /g, ''))} />
            </View>
            <T size={14}>2. Digite o código de 6 dígitos que aparece no app.</T>
            <OtpInput value={code} onChange={setCode} onComplete={enable} disabled={busy} autoFocus={false} />
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Button title="Ativar" loading={busy} disabled={code.length !== 6} onPress={() => enable()} />
            <Button variant="text" title="Cancelar" onPress={() => reset()} />
          </View>
        )}

        {flow.kind === 'email' && (
          <View style={{ gap: 12 }}>
            <T muted size={14}>Enviamos um código para o seu e-mail. Digite-o para ativar.</T>
            <OtpInput value={code} onChange={setCode} onComplete={enable} disabled={busy} />
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Button title="Ativar" loading={busy} disabled={code.length !== 6} onPress={() => enable()} />
            <Button variant="text" title="Cancelar" onPress={() => reset()} />
          </View>
        )}

        {flow.kind === 'codes' && <RecoveryCodes codes={flow.codes} onDone={() => reset()} />}

        {flow.kind === 'idle' && sec.twoFactorMethod && (
          <View style={{ gap: 8 }}>
            <Button variant="outline" title="Gerar novos códigos de recuperação" disabled={busy} onPress={() => startConfirm('regenerate')} />
            <Button variant="danger" title="Desativar" disabled={busy} onPress={() => startConfirm('disable')} />
          </View>
        )}

        {flow.kind === 'confirm' && (
          <View style={{ gap: 12 }}>
            <T muted size={14}>Confirme que é você: {flow.action === 'disable' ? 'desativar a verificação em duas etapas' : 'os códigos atuais deixarão de funcionar'}.</T>
            <Field label="Senha" secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} />
            {useRecovery
              ? <Field label="Código de recuperação" value={code} onChangeText={setCode} autoCapitalize="none" placeholder="xxxx-xxxx" />
              : <><T size={13} muted>{sec.twoFactorMethod === 'totp' ? 'Código do app autenticador' : 'Código enviado para o seu e-mail'}</T><OtpInput value={code} onChange={setCode} disabled={busy} autoFocus={false} /></>}
            <Button variant="text" block={false} title={useRecovery ? 'Usar o código normal' : 'Usar um código de recuperação'} onPress={() => { setUseRecovery(!useRecovery); setCode(''); }} />
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Button variant={flow.action === 'disable' ? 'danger' : 'dark'} title={flow.action === 'disable' ? 'Desativar' : 'Gerar novos códigos'} loading={busy} disabled={!password || !code} onPress={confirm} />
            <Button variant="text" title="Cancelar" onPress={() => reset()} />
          </View>
        )}
        {flow.kind === 'idle' && error ? <Notice tone="error">{error}</Notice> : null}
      </Card>
    </Screen>
  );
}
