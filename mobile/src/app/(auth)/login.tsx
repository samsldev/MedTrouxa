import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import VerifyStep from '@/components/VerifyStep';
import { Button, Check, Field, Kicker, Logo, Notice, Row, Screen, T, Title } from '@/components/ui';
import { AuthStep, useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export default function Login() {
  const { c } = useTheme();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', university: '', semester: '' });
  const [accept, setAccept] = useState(false);
  const [step, setStep] = useState<Exclude<AuthStep, { status: 'ok' }> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });
  const onStep = (s: AuthStep) => setStep(s.status === 'ok' ? null : s);

  async function submit() {
    setError('');
    if (mode === 'register' && !accept) { setError('Aceite os termos de uso e a política de privacidade.'); return; }
    setBusy(true);
    try {
      if (mode === 'login') onStep(await login(form.email.trim(), form.password));
      else onStep(await register({
        name: form.name.trim(), email: form.email.trim(), password: form.password,
        university: form.university.trim() || undefined, semester: form.semester ? Number(form.semester) : undefined, acceptTerms: accept,
      }));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']}>
        <View style={{ alignItems: 'center', paddingVertical: 18 }}><Logo size={36} /></View>
        {step ? <VerifyStep key={step.challenge} step={step} onStep={onStep} onCancel={() => setStep(null)} /> : (
          <View style={{ gap: 16 }}>
            <View>
              <Kicker>{mode === 'login' ? 'Bem-vindo de volta' : 'Leva menos de um minuto'}</Kicker>
              <Title size={34} em={mode === 'login' ? 'estudos' : 'conta'}>{mode === 'login' ? 'Continue seus ' : 'Crie sua '}</Title>
            </View>
            {mode === 'register' && <Field label="Nome" value={form.name} onChangeText={set('name')} autoComplete="name" textContentType="name" />}
            <Field label="E-mail" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" autoCorrect={false} />
            <Field label="Senha" value={form.password} onChangeText={set('password')} secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              textContentType={mode === 'login' ? 'password' : 'newPassword'} hint={mode === 'register' ? 'Mínimo de 8 caracteres, com letras e números.' : undefined}
              onSubmitEditing={mode === 'login' ? submit : undefined} returnKeyType={mode === 'login' ? 'go' : 'next'} />
            {mode === 'login' && <Link href="/esqueci-senha" style={{ alignSelf: 'flex-end' }}><T size={14} weight="semi" style={{ color: c.goldText }}>Esqueci minha senha</T></Link>}
            {mode === 'register' && (
              <>
                <Row gap={10}>
                  <Field style={{ flex: 1 }} label="Faculdade (opcional)" value={form.university} onChangeText={set('university')} />
                  <Field style={{ width: 96 }} label="Período" value={form.semester} onChangeText={(v) => set('semester')(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" />
                </Row>
                <Check value={accept} onChange={setAccept}>
                  <T size={14}>Li e aceito os <T size={14} weight="semi" style={{ color: c.goldText }} >Termos de uso</T> e a <T size={14} weight="semi" style={{ color: c.goldText }}>Política de privacidade</T>.</T>
                </Check>
                <Row gap={16} style={{ marginLeft: 32 }}>
                  <Button small block={false} variant="text" title="Ler os termos" onPress={() => router.push('/legal/termos')} />
                  <Button small block={false} variant="text" title="Ler a política" onPress={() => router.push('/legal/privacidade')} />
                </Row>
              </>
            )}
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Button title={mode === 'login' ? 'Entrar' : 'Criar conta'} loading={busy} onPress={submit} />
            <Button variant="text" title={mode === 'login' ? 'Ainda não tem conta? Cadastre-se' : 'Já tem conta? Entrar'} onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} />
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
