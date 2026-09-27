import * as WebBrowser from 'expo-web-browser';
import { WEB_URL } from './config';

/** Páginas do site abertas no navegador do sistema dentro do app (termos, privacidade, suporte). */
export const openWeb = (path: string) => WebBrowser.openBrowserAsync(`${WEB_URL}${path}`, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET }).catch(() => undefined);
