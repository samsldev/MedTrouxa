# Conformidade com as lojas e segurança — app MedTrouxa

Matriz de cada exigência relevante da **App Store (Apple)**, do **Google Play** e do padrão de segurança mobile
**OWASP MASVS**, com onde está implementado e como foi verificado. Rode `npm run verify` antes de todo build
(typecheck + lint + `check:store`, que barra preço, compra, link externo, permissão sensível e rastreamento).

## App Store Review Guidelines

| Diretriz | Exigência | Como o app cumpre | Onde |
|---|---|---|---|
| 3.1.1 / 3.1.3(b) | Conteúdo digital só pode ser vendido por compra no app; apps "multiplataforma" podem dar acesso ao que foi comprado fora, **sem** preços, botões ou links que levem à compra | Não há preço, plano à venda, checkout, link ou menção a meio de pagamento. Recurso fora do plano mostra só "Este recurso não está incluído no seu plano atual." O app não abre o site (navegador interno removido) e os termos exibidos no app são a variante sem condições comerciais | `src/lib/api.ts` (`PLAN_LOCKED_MESSAGE`), `src/app/legal/[doc].tsx`, `backend/src/mobile/legal.ts`, `scripts/check-store-rules.mjs` |
| 5.1.1(v) | Apps com cadastro precisam permitir **excluir a conta no app** | Mais → Minha conta → Excluir minha conta (senha + confirmação), exclusão imediata no servidor | `src/app/(app)/conta.tsx` |
| 5.1.1(i) / 5.1.2 | Política de privacidade acessível no app e no App Store Connect; coletar só o necessário | Termos e privacidade nativos, acessíveis antes (cadastro) e depois do login; faculdade/período opcionais | `src/app/legal/[doc].tsx` |
| 5.1.2(i) | Informar e obter **permissão explícita** antes de enviar dados pessoais a IA de terceiros | Pergunta no primeiro uso da Coruja (chat, explicar questão, gerar cards), dizendo o que é enviado e a quem (Anthropic); revogável em Minha conta | `src/lib/aiConsent.ts` |
| 1.2 | Conteúdo gerado por usuários exibido a outros: filtro, denúncia, ação da equipe, contato | Nomes do ranking: filtro de termos ofensivos no cadastro/edição, botão de denúncia em cada nome, fila no console (redefinir nome, suspender), contato nos termos | `backend/src/security/profanity.ts`, `src/app/(app)/ranking.tsx`, console → Denúncias |
| 1.4.1 | Conteúdo médico: não se apresentar como diagnóstico | Avisos "conteúdo educacional, não substitui avaliação médica" e "gerado por IA, confira na literatura" | `coruja.tsx`, `QuestionCard.tsx`, termos |
| 2.1 | App completo, sem travar; revisores precisam conseguir entrar | Tela própria para "sem conexão" com sessão preservada; conta de demonstração (ver abaixo) | `src/app/_layout.tsx` |
| 2.5.2 / 3.3.2 | Código baixado não pode mudar o propósito do app | EAS Update só publica correções de JS/estilo do próprio app; `runtimeVersion` = versão do app | `app.json` |
| 4.0 / iPad | App universal deve funcionar em iPad e em qualquer orientação | Suporte a todas as orientações no iPad (evita erro de validação de multitarefa); conteúdo em coluna central de até 720 pt | `app.json`, `src/components/ui.tsx` (`CONTENT_MAX`) |
| 4.8 | "Iniciar sessão com a Apple" se houver login social | Não há login social (só e-mail/senha) → não se aplica | — |
| 5.1.1 (textos de permissão) | Não pedir/declarar permissão sem uso | Removido o `NSFaceIDUsageDescription` genérico que o SecureStore injetava; o app não pede nenhuma permissão | `app.json` (`faceIDPermission: false`) |
| Manifesto de privacidade (ITMS‑91053) | Declarar APIs de "motivo obrigatório" e dados coletados | UserDefaults (CA92.1), FileTimestamp (C617.1), SystemBootTime (35F9.1); dados: e‑mail, nome, ID do usuário, conteúdo do usuário — vinculados, sem rastreamento | `app.json` → `ios.privacyManifests` |
| Exportação de criptografia | Declarar uso de criptografia | Só HTTPS padrão → `ITSAppUsesNonExemptEncryption = false` | `app.json` |
| ATT | Pedir permissão de rastreamento se rastrear | Não rastreia, sem SDK de anúncios/analytics → não se aplica (`NSPrivacyTracking = false`) | `app.json` |

## Google Play

| Política | Exigência | Como o app cumpre |
|---|---|---|
| Pagamentos | Conteúdo digital vendido no app usa o faturamento do Google Play | O app não vende nada nem direciona para compra (mesma regra da Apple) |
| Exclusão de conta | Exclusão **no app** e uma **URL pública** para pedir exclusão sem o app | No app: Mais → Minha conta. URL: `https://medtrouxa.com.br/excluir-conta` (explica o caminho, o que é apagado/mantido e o contato) |
| Conteúdo gerado por IA | Usuário precisa poder **denunciar/sinalizar** conteúdo ofensivo gerado pela IA dentro do app | Botão "Denunciar" em cada resposta da Coruja e em cada explicação; vai para a fila de moderação |
| Conteúdo gerado por usuários | Moderação e denúncia | Idem Apple 1.2 |
| Permissões de fotos e vídeos | `READ_MEDIA_*` só com necessidade central e formulário | Bloqueadas (a lib de proteção de captura as declarava); permissões efetivas: só `INTERNET` e `VIBRATE` |
| API alvo | Mirar a versão exigida do Android | `targetSdk 36` / `compileSdk 36` (Expo SDK 57 / RN 0.86) |
| Telas grandes (Android 16) | O sistema ignora trava de orientação em tablets | Layout funciona em paisagem/tela larga (coluna central) |
| Segurança dos dados | Formulário precisa bater com o app | Respostas abaixo |

### Formulário "Segurança dos dados" (Play Console)
- Coleta dados? **Sim**. Compartilha com terceiros? **Não** (provedores que processam em nosso nome — e‑mail, IA — não contam como "compartilhamento" pela definição do Google; se preferir ser conservador, marque "Outro conteúdo gerado pelo usuário → compartilhado com provedor de IA, opcional").
- Dados: **Nome**, **E‑mail**, **IDs do usuário**, **Outro conteúdo gerado pelo usuário** (respostas, flashcards, perguntas à IA) — finalidade: funcionalidade do app e gerenciamento da conta; obrigatórios exceto conteúdo da IA (opcional).
- Criptografados em trânsito: **Sim**. Usuário pode pedir exclusão: **Sim** (no app e em `/excluir-conta`).

### App Privacy (App Store Connect)
- Dados coletados: **Informações de contato → Nome, E‑mail**; **Identificadores → ID do usuário**; **Conteúdo do usuário → Outro conteúdo do usuário**.
- Todos **vinculados à identidade**, uso: **Funcionalidade do app**. **Nenhum** usado para rastreamento.

## OWASP MASVS (segurança)

| Controle | Implementação |
|---|---|
| STORAGE | Refresh token no Keychain/Keystore (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, fora do backup: regras do SecureStore aplicadas no Android); access token só em memória; logout e troca de senha limpam o aparelho |
| CRYPTO | Nada de criptografia própria; TLS do sistema |
| AUTH | Tokens de 15 min + refresh rotativo com detecção de reuso (derruba todas as sessões); 2FA (TOTP/e‑mail/recuperação); modo app só aceito sem `Origin` em produção |
| NETWORK | Build de loja **falha** se a API não for HTTPS (`app.config.ts`); ATS sem cargas arbitrárias; Android release sem tráfego em texto puro (só o build de debug permite) |
| PLATFORM | Tela de Segurança bloqueia print/gravação e borra a miniatura do multitarefa (segredo do 2FA e códigos de recuperação); deep links só abrem telas do app, protegidas pela sessão; nenhuma WebView |
| CODE | Dependências fixadas pelo SDK do Expo; verificação de versão mínima (`/api/app/config`) força atualização de versões antigas |
| RESILIENCE | Hermes (bytecode) no release; sem segredos no app (só a URL pública da API) |
| PRIVACY | Sem analytics, anúncios ou identificadores de publicidade; consentimento para IA; minimização (ranking com primeiro nome + inicial) |

## Antes de enviar para revisão

1. `npm run verify` sem erros.
2. **Conta de demonstração** para os revisores (Apple: *App Review Information → Sign‑in required*; Google: *Acesso ao app*): crie um aluno, conceda um plano de cortesia pelo console admin, **sem 2FA**, com alguns simulados/flashcards já feitos.
3. Servidor de produção no ar, com IPv6 funcionando (a Apple testa em rede só IPv6) e `ANTHROPIC_API_KEY` configurada (a Coruja precisa responder durante a revisão).
4. URLs: privacidade `https://medtrouxa.com.br/privacidade`, exclusão `https://medtrouxa.com.br/excluir-conta`, suporte (e‑mail/página de contato).
5. Classificação etária: categoria **Educação**. Na Apple, no questionário marque *Informações médicas/de tratamento: pouco frequentes/leves* (costuma resultar em 12+). No Google (IARC): sem violência/sexo; *usuários interagem: sim (nomes no ranking, moderados)*.
6. Revise a fila **Denúncias** no console diariamente (a Apple espera ação em até 24h para conteúdo denunciado).

### Texto sugerido para "Notas para o revisor" (App Store Connect)
> MedTrouxa is a study app for medical students (question bank, flashcards, mock exams, study plans and an AI tutor).
> Accounts and plans are managed on our website; the app does not sell anything, show prices or link to purchases (guideline 3.1.3(b), multiplatform services). Features not included in the user's plan show a neutral message.
> Demo account: <e-mail> / <senha> (plan already active, 2FA off).
> Account deletion: Mais → Minha conta → Excluir minha conta.
> AI (Coruja): content is generated by Anthropic Claude; the app asks for explicit permission on first use and every answer has a "Denunciar" (report) action. Leaderboard names can also be reported; reports are reviewed by our team.
