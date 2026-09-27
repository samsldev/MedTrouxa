#!/usr/bin/env node
/**
 * Guarda das regras das lojas: falha se o código do app tiver preço, oferta de compra ou link para o site.
 * App Store 3.1.1 / 3.1.3(b) e Google Play Payments: apps "multiplataforma" não podem vender nem direcionar à compra externa.
 * Também barra permissões/SDKs sensíveis que exigem justificativa nas lojas.
 * Rode antes de cada build: `npm run check:store` (o `npm run verify` já inclui).
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const problems = [];

const RULES = [
  [/R\$\s?\d/, 'preço em reais'],
  [/\b\d{1,2}x de\b|\bparcel(a|ado|amento)/i, 'parcelamento'],
  [/mercado ?pago|\bpix\b|checkout|stripe|pagseguro/i, 'meio de pagamento'],
  [/\b(assine|assinar agora|comprar|compre|fazer upgrade|upgrade|ver planos|seja premium)\b/i, 'chamada para compra'],
  [/https?:\/\/(?!localhost|10\.0\.2\.2)[^\s'"`]+/i, 'link externo (o app não deve levar ao site)'],
  [/['"`]\/planos|['"`]\/checkout|['"`]\/pagamento/, 'rota de compra do site'],
  [/expo-web-browser|react-native-webview|Linking\.openURL\((?!url\)|flow\.otpauth)/, 'navegação para fora do app'],
];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) {
      fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comentários
        for (const [re, what] of RULES) if (re.test(line)) problems.push(`${path.relative(root, p)}:${i + 1}  ${what}: ${line.trim().slice(0, 120)}`);
      });
    }
  }
}
walk(path.join(root, 'src'));

// Configuração nativa: permissões sensíveis e rastreamento
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const blocked = new Set(app.android?.blockedPermissions ?? []);
for (const perm of ['READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO', 'READ_EXTERNAL_STORAGE', 'RECORD_AUDIO', 'CAMERA', 'ACCESS_FINE_LOCATION', 'SYSTEM_ALERT_WINDOW'])
  if (!blocked.has(`android.permission.${perm}`)) problems.push(`app.json  permissão sensível não bloqueada: ${perm}`);
if (app.ios?.privacyManifests?.NSPrivacyTracking !== false) problems.push('app.json  NSPrivacyTracking deve ser false');
if (!app.ios?.privacyManifests?.NSPrivacyAccessedAPITypes?.length) problems.push('app.json  NSPrivacyAccessedAPITypes vazio (aviso ITMS-91053)');
if (app.ios?.config?.usesNonExemptEncryption !== false) problems.push('app.json  declare usesNonExemptEncryption: false');
const store = (app.plugins ?? []).find((p) => Array.isArray(p) && p[0] === 'expo-secure-store');
if (!store || store[1]?.faceIDPermission !== false) problems.push('app.json  expo-secure-store deve ter faceIDPermission: false (o app não usa Face ID)');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const dep of ['expo-tracking-transparency', 'expo-ads-admob', 'react-native-google-mobile-ads', 'expo-web-browser', 'react-native-webview', 'expo-in-app-purchases', 'react-native-iap'])
  if (pkg.dependencies?.[dep]) problems.push(`package.json  dependência proibida neste app: ${dep}`);

if (problems.length) {
  console.error(`✗ ${problems.length} problema(s) com as regras das lojas:\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log('✓ regras das lojas: sem preços, compras, links externos, permissões sensíveis ou rastreamento');
