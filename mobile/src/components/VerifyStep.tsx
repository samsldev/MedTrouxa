import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { AuthStep, useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Icon } from './Icon';
import OtpInput from './OtpInput';
import { Button, Field, Notice, T, Title } from './ui';

type Step = Exclude<AuthStep, { status: 'ok' }>;

/** Etapa após a senha: código do e-mail (cadastro/2FA por e-mail), app autenticador ou código de recuperação. */
export default function VerifyStep({ step, onStep, onCancel }: { step: Step; onStep(s: AuthStep): void; onCancel(): void }) {
  const { c } = useTheme();
  const { verifyEmail, mfa } = useAuth();
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(step.status === 'mfa' && step.method === 'totp' ? 0 : 60);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const isEmailCode = step.status === 'verify_email' || (step.status === 'mfa' && step.method === 'email');

  async function submit(value = code) {
    setError(''); setBusy(true);
    try {
      onStep(step.status === 'verify_email'
        ? await verifyEmail(step.challenge, value)
        : await mfa(step.challenge, useRecovery ? 'recovery' : step.method, useRecovery ? recovery.trim() : value));
    } catch (e) {
      setError((e as Error).message); setCode('');
      if (/expirada|Comece novamente/i.test((e as Error).message)) setTimeout(onCancel, 2200);
    } finally { setBusy(false); }
  }

  async function resend() {
    setError('');
    try { await api('/auth/resend-code', { body: { challenge: step.challenge } }); setCooldown(60); }
    catch (e) { setError((e as Error).message); }
  }

  const title = step.status === 'verify_email' ? 'Confirme seu e-mail' : 'Verificação em duas etapas';
  const lead = step.status === 'verify_email' ? `Enviamos um código de 6 dígitos para ${step.email}.`
    : useRecovery ? 'Digite um dos seus códigos de recuperação.'
      : step.method === 'totp' ? 'Abra seu app autenticador e digite o código do MedTrouxa.' : `Enviamos um código de 6 dígitos para ${step.email}.`;

  return (
    <View style={{ gap: 18 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.goldSoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
        <Icon name={isEmailCode ? 'spark' : 'shield'} size={26} color={c.goldText} />
      </View>
      <Title center size={30}>{title}</Title>
      <T muted center>{lead}</T>
      {useRecovery
        ? <Field label="Código de recuperação" value={recovery} onChangeText={setRecovery} placeholder="xxxx-xxxx" autoCapitalize="none" autoCorrect={false} maxLength={12} autoFocus />
        : <OtpInput value={code} onChange={setCode} onComplete={(v) => submit(v)} disabled={busy} />}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button title={busy ? 'Verificando…' : 'Continuar'} loading={busy} disabled={useRecovery ? recovery.trim().length < 8 : code.length !== 6} onPress={() => submit()} />
      {isEmailCode && !useRecovery && <Button variant="text" title={cooldown > 0 ? `Reenviar código em ${cooldown}s` : 'Reenviar código'} disabled={cooldown > 0} onPress={resend} />}
      {step.status === 'mfa' && (
        <Button variant="text" title={useRecovery ? (step.method === 'totp' ? 'Usar o app autenticador' : 'Usar código do e-mail') : 'Usar um código de recuperação'}
          onPress={() => { setUseRecovery(!useRecovery); setError(''); }} />
      )}
      <Button variant="text" title="← Voltar" onPress={onCancel} />
      {isEmailCode && <T muted center size={13}>Não achou? Confira a caixa de spam ou promoções.</T>}
    </View>
  );
}
