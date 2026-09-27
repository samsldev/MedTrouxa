import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, Kicker, Notice, Screen, T, Title } from '@/components/ui';
import { api } from '@/lib/api';

/** Pede o link de redefinição. A nova senha é criada na página segura do site (link do e-mail). */
export default function Forgot() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setError('');
    try { setSent((await api<{ message: string }>('/auth/forgot', { body: { email: email.trim() } })).message); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Screen edges={['top', 'bottom']}>
      <Button variant="text" block={false} icon="back" title="Voltar" onPress={() => router.back()} />
      <View style={{ gap: 16 }}>
        <View><Kicker>Recuperar acesso</Kicker><Title size={34} em="senha?">Esqueceu a </Title></View>
        <T muted>Enviaremos um link para o seu e-mail. Abra-o no celular para criar a nova senha e depois volte ao app.</T>
        {sent ? <Notice tone="ok" icon="check">{sent}</Notice> : (
          <>
            <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" onSubmitEditing={submit} />
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Button title="Enviar link" loading={busy} disabled={!email.includes('@')} onPress={submit} />
          </>
        )}
      </View>
    </Screen>
  );
}
