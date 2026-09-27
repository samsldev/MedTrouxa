import { Platform } from 'react-native';

/**
 * URL da API. Em builds de loja vem do perfil do EAS (EXPO_PUBLIC_API_URL) e é obrigatoriamente HTTPS
 * (validado no build em app.config.ts). Em desenvolvimento, o emulador Android enxerga o computador em 10.0.2.2.
 */
const devDefault = Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? devDefault).replace(/\/$/, '');
