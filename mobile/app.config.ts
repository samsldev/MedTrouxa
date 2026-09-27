import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Validações de build: builds de loja (preview/production) só saem com API em HTTPS.
 * O restante da configuração fica em app.json.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const api = process.env.EXPO_PUBLIC_API_URL ?? '';
  if ((profile === 'production' || profile === 'preview') && !/^https:\/\/[^/]+/.test(api)) {
    throw new Error(`EXPO_PUBLIC_API_URL precisa ser HTTPS no perfil "${profile}" (recebido: "${api || 'vazio'}")`);
  }
  return config as ExpoConfig;
};
