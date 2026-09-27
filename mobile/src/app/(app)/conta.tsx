import { useState } from 'react';
import { Alert, Share } from 'react-native';
import { Button, Card, Field, Notice, Row, Screen, T } from '@/components/ui';
import { api, User } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function Conta() {
  const { user, setUser, logout, forget } = useAuth();
  const [profile, setProfile] = useState({ name: user?.name ?? '', university: user?.university ?? '', semester: user?.semester ? String(user.semester) : '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [del, setDel] = useState('');
  const [msg, setMsg] = useState<Record<string, { text: string; tone: 'ok' | 'error' }>>({});
  const [busy, setBusy] = useState('');
  const say = (k: string, text: string, tone: 'ok' | 'error' = 'ok') => setMsg((m) => ({ ...m, [k]: { text, tone } }));
  const run = async (k: string, fn: () => Promise<void>) => { setBusy(k); try { await fn(); } catch (e) { say(k, (e as Error).message, 'error'); } finally { setBusy(''); } };

  const saveProfile = () => run('profile', async () => {
    setUser(await api<User>('/account/profile', { method: 'PATCH', body: {
      name: profile.name.trim(), university: profile.university.trim() || undefined, semester: profile.semester ? Number(profile.semester) : undefined,
    } }));
    say('profile', 'Dados atualizados.');
  });

  const changePassword = () => run('pw', async () => {
    await api('/account/password', { body: pw });
    setPw({ currentPassword: '', newPassword: '' });
    Alert.alert('Senha alterada', 'Por segurança, entre novamente.', [{ text: 'OK', onPress: () => void forget() }]);
  });

  const exportData = () => run('export', async () => {
    const data = await api('/account/export');
    await Share.share({ title: 'medtrouxa-meus-dados.json', message: JSON.stringify(data, null, 2) });
  });

  const deleteAccount = () => Alert.alert('Excluir sua conta?', 'Apaga seu perfil e seu histórico de estudos permanentemente. Esta ação não pode ser desfeita.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: () => void run('delete', async () => { await api('/account', { method: 'DELETE', body: { password: del } }); await forget(); }) },
  ]);

  const note = (k: string) => (msg[k] ? <Notice tone={msg[k].tone === 'ok' ? 'ok' : 'error'}>{msg[k].text}</Notice> : null);

  return (
    <Screen edges={['bottom']}>
      <T muted>{user?.email}</T>
      <Card>
        <T weight="bold">Dados pessoais</T>
        <Field label="Nome" value={profile.name} onChangeText={(v) => setProfile({ ...profile, name: v })} maxLength={120} autoComplete="name" />
        <Row gap={10}>
          <Field style={{ flex: 1 }} label="Faculdade" value={profile.university} onChangeText={(v) => setProfile({ ...profile, university: v })} maxLength={160} />
          <Field style={{ width: 96 }} label="Período" value={profile.semester} keyboardType="number-pad" onChangeText={(v) => setProfile({ ...profile, semester: v.replace(/\D/g, '').slice(0, 2) })} />
        </Row>
        {note('profile')}
        <Button title="Salvar" loading={busy === 'profile'} disabled={profile.name.trim().length < 2} onPress={saveProfile} />
      </Card>

      <Card>
        <T weight="bold">Trocar senha</T>
        <Field label="Senha atual" secureTextEntry autoComplete="current-password" textContentType="password" value={pw.currentPassword} onChangeText={(v) => setPw({ ...pw, currentPassword: v })} />
        <Field label="Nova senha" secureTextEntry autoComplete="new-password" textContentType="newPassword" hint="Mínimo de 8 caracteres, com letras e números." value={pw.newPassword} onChangeText={(v) => setPw({ ...pw, newPassword: v })} />
        {note('pw')}
        <Button title="Alterar senha" loading={busy === 'pw'} disabled={!pw.currentPassword || pw.newPassword.length < 8} onPress={changePassword} />
      </Card>

      <Card>
        <T weight="bold">Privacidade e dados (LGPD)</T>
        <T muted size={14}>Receba uma cópia de todos os seus dados ou encerre as sessões em todos os dispositivos.</T>
        {note('export')}
        <Button variant="outline" icon="arrow" title="Exportar meus dados" loading={busy === 'export'} onPress={exportData} />
        <Button variant="outline" icon="logout" title="Sair de todos os dispositivos" onPress={() => void logout({ everywhere: true })} />
      </Card>

      <Card>
        <T weight="bold">Excluir conta</T>
        <T muted size={14}>Apaga seu perfil e seu histórico de estudos. Registros de pagamento são mantidos, sem seus dados pessoais, por obrigação fiscal.</T>
        <Field label="Confirme com sua senha" secureTextEntry autoComplete="current-password" value={del} onChangeText={setDel} />
        {note('delete')}
        <Button variant="danger" title="Excluir minha conta" loading={busy === 'delete'} disabled={!del} onPress={deleteAccount} />
      </Card>
    </Screen>
  );
}
