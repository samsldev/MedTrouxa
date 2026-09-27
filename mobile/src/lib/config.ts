import { Platform } from 'react-native';

/**
 * URL da API. Em produção vem do perfil de build do EAS (EXPO_PUBLIC_API_URL).
 * Em desenvolvimento, o emulador Android enxerga o computador em 10.0.2.2.
 */
const devDefault = Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? devDefault).replace(/\/$/, '');
/** Site público (termos, privacidade, redefinição de senha). */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? API_URL.replace(/\/api$/, '')).replace(/\/$/, '');
