import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Segredos (refresh token) no Keychain (iOS) / Keystore (Android), só neste aparelho e sem backup na nuvem.
 * No navegador (apenas pré-visualização de desenvolvimento) cai para o armazenamento local.
 */
const opts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
const web = Platform.OS === 'web';

export const secure = {
  get: (k: string) => (web ? AsyncStorage.getItem(k) : SecureStore.getItemAsync(k, opts)),
  set: (k: string, v: string) => (web ? AsyncStorage.setItem(k, v) : SecureStore.setItemAsync(k, v, opts)),
  del: (k: string) => (web ? AsyncStorage.removeItem(k) : SecureStore.deleteItemAsync(k, opts)),
};
