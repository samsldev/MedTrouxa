import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

/**
 * Permissão explícita para enviar texto a um provedor de IA de terceiros (App Store 5.1.2(i)).
 * Pedida no primeiro uso da Coruja; pode ser revogada em "Minha conta".
 */
const KEY = 'mt.ai-consent.v1';
const TITLE = 'Usar a Coruja IA?';
const BODY = 'A Coruja é gerada por inteligência artificial da Anthropic (Claude). Para responder, o texto da sua pergunta — ou o enunciado da questão, ou o resumo que você colar — é enviado à Anthropic, sem seu nome, e-mail ou outros identificadores.\n\nNão escreva dados pessoais ou de pacientes. Você pode revogar esta permissão em Minha conta.';

export const aiConsent = {
  get: async () => (await AsyncStorage.getItem(KEY).catch(() => null)) === 'granted',
  revoke: () => AsyncStorage.removeItem(KEY).catch(() => undefined),
  /** Resolve true se já permitido ou se o usuário permitir agora. */
  async ensure(): Promise<boolean> {
    if (await aiConsent.get()) return true;
    if (Platform.OS === 'web') { // só na pré-visualização no navegador (Alert do RN não existe na web)
      const ok = window.confirm(`${TITLE}\n\n${BODY}`);
      if (ok) await AsyncStorage.setItem(KEY, 'granted');
      return ok;
    }
    return new Promise((resolve) => Alert.alert(
      TITLE,
      BODY,
      [
        { text: 'Agora não', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Permitir', onPress: () => { void AsyncStorage.setItem(KEY, 'granted'); resolve(true); } },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ));
  },
};
