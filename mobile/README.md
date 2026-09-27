# MedTrouxa — app Android e iOS

App nativo do MedTrouxa para **Android e iOS**, feito com **React Native + Expo (SDK 57) + TypeScript**, a partir de um único código.
Tem tudo o que existe no site, **menos pagamento**.

## Por que Expo/React Native (e não Swift + Kotlin, nem Flutter)

| | Expo / React Native (escolhido) | Swift (iOS) + Kotlin (Android) | Flutter |
|---|---|---|---|
| Código | 1 base para as duas lojas | 2 apps inteiros, 2 equipes | 1 base |
| Linguagem | TypeScript — a mesma do site e da API | Swift + Kotlin (novas para o time) | Dart (nova) |
| Reaproveita do projeto | tipos, regras, formatação, fluxos de autenticação | nada | nada |
| Interface | componentes **nativos** de verdade (UIKit/Android Views) | nativa | desenha a própria tela (não usa os componentes do sistema) |
| Atualizações | correções de JS em minutos por **EAS Update** (OTA), sem passar pela revisão | toda correção passa pela loja | toda correção passa pela loja |
| Build/assinatura | **EAS Build** na nuvem, inclusive iOS sem Mac | Xcode (Mac) + Android Studio | Xcode (Mac) + Android Studio |
| Longo prazo | mantido pela Meta + Expo, usado por Microsoft, Shopify, Discord, Coinbase; atualização de SDK a cada ~4 meses com guia de migração | estável, mas custo 2× para sempre | Google |

Um app de estudo como o MedTrouxa é listas, formulários, texto e gráficos simples — exatamente onde o React Native nativo brilha.
Não usamos nenhum recurso que exija código nativo próprio; se um dia for preciso (widget, Live Activity, etc.), dá para escrever
só aquele módulo em Swift/Kotlin com **Expo Modules**, sem reescrever o app.

## O que tem no app

- Login, cadastro com código de 6 dígitos por e-mail, verificação em duas etapas (app autenticador, e-mail ou código de recuperação), esqueci a senha
- Início (painel), banco de questões com filtros e rolagem infinita, explicação da Coruja IA
- Simulados com cronômetro, respostas salvas no aparelho e envio automático no fim do tempo
- Flashcards com repetição espaçada (cartão que vira), criação manual e com IA
- Coruja IA (chat), Cronogramas, Ranking
- Minha conta: dados, troca de senha, exportar dados (LGPD), sair de todos os dispositivos, **excluir conta** (obrigatório na App Store)
- Segurança: ativar/desativar 2FA; no celular o botão **"Abrir no app autenticador"** cadastra o MedTrouxa direto (sem precisar escanear)
- Tema claro e escuro automáticos, fontes e cores do site, acessibilidade (rótulos, papéis e estados para leitores de tela)

## Sem pagamento (regras das lojas)

O app **não vende nada, não mostra preços e não indica onde comprar** — é o modelo "multiplataforma" das diretrizes
(App Store 3.1.3(b) e política de pagamentos do Google Play): quem assinou no site usa o que comprou.
Quando um recurso não está no plano, o app mostra só *"Este recurso não está incluído no seu plano atual."*
Não coloque links ou textos do tipo "assine no site" no app: isso causa rejeição.

## Segurança da sessão

- Access token (15 min) só em memória; **refresh token rotativo no Keychain (iOS) / Keystore (Android)**, apenas neste aparelho e fora do backup em nuvem.
- O app se identifica com `x-client: mobile` e recebe o refresh token no corpo em vez de cookie. Em produção a API só aceita esse modo
  sem cabeçalho `Origin` (apps nativos não enviam; navegadores sempre enviam), então um site não consegue usá-lo para contornar o cookie httpOnly.
- Reuso de refresh token (sinal de roubo) derruba todas as sessões da conta, como no site.
- Sessão do app: 90 dias deslizantes (renovada a cada uso).

## Desenvolvimento

```bash
cd mobile
npm install
npm run typecheck && npm run lint
npx expo start          # abre no simulador/emulador; aponte a API com EXPO_PUBLIC_API_URL
```

- API local: o emulador Android usa `http://10.0.2.2:3000/api`; o simulador iOS usa `http://localhost:3000/api` (padrões em `src/lib/config.ts`).
- Para ver no navegador (só pré-visualização): `EXPO_PUBLIC_API_URL=http://localhost:3000/api npx expo export --platform web` e sirva a pasta `dist`.
- Rotas em `src/app` (Expo Router); componentes em `src/components`; API, sessão e tema em `src/lib`.
- Nunca edite `ios/`/`android/` à mão: são gerados (config em `app.json`).
- Instale bibliotecas sempre com `npx expo install <pacote>` (versões compatíveis com o SDK).

## Build e publicação (EAS)

```bash
npm i -g eas-cli && eas login
eas init                               # preenche o projectId em app.json
eas build --profile preview --platform android   # APK para testar
eas build --profile production --platform all    # AAB (Play) + IPA (App Store)
eas submit --profile production --platform all
eas update --channel production -m "correção X"  # atualização OTA (só JS/estilos)
```

Perfis em `eas.json`: `development` (API local), `preview` (homologação) e `production` (`https://medtrouxa.com.br/api`).
Ajuste os domínios de `preview`/`production` se forem outros.

**Quando mudar só JS/estilo → `eas update`. Quando adicionar biblioteca nativa, mudar `app.json` ou subir o SDK → novo build e nova versão na loja**
(o `runtimeVersion` segue a versão do app, então uma atualização OTA nunca chega a um binário incompatível).

### Versão mínima obrigatória

`GET /api/app/config` devolve `minVersion`. Se o app instalado for mais antigo, ele mostra uma tela pedindo atualização.
Configure no servidor: `MOBILE_MIN_VERSION`, `MOBILE_APP_STORE_URL`, `MOBILE_PLAY_STORE_URL`.

### Checklist das lojas

- **Conta de teste para os revisores** (Apple e Google exigem): crie um aluno com plano ativo (cortesia pelo console admin) e informe e-mail/senha na submissão. Deixe essa conta **sem 2FA**.
- **Apple — App Privacy**: dados coletados = e-mail, nome, conteúdo do usuário (respostas, cards), vinculados à conta, **sem rastreamento**. O manifesto de privacidade já está em `app.json`.
- **Google — Segurança dos dados**: mesmos dados; criptografados em trânsito; o usuário pode pedir exclusão (há exclusão no app). Informe também a URL de exclusão (`/privacidade`).
- URL da política de privacidade: `https://medtrouxa.com.br/privacidade`. URL de suporte: página ou e-mail de contato.
- Classificação etária: educação, sem conteúdo sensível. Criptografia: só HTTPS padrão (`usesNonExemptEncryption: false` já configurado).
- Ícones e splash em `assets/` (gerados da marca; o ícone iOS não tem transparência, como a Apple exige).
