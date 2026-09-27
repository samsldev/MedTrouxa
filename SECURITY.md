# Segurança do MedTrouxa

Resumo dos controles implementados, organizados pelo **OWASP Top 10 (2021)**, e das práticas de proteção de dados (**LGPD**).
Para reportar uma vulnerabilidade, escreva para o contato de suporte da plataforma; não abra issue pública.

## OWASP Top 10

| Risco | Controles |
| --- | --- |
| **A01 Controle de acesso** | Guard JWT global (tudo é privado por padrão; rotas públicas são explícitas). Rotas de admin com `@AdminOnly`. Toda consulta de recurso filtra pelo dono (simulados, baralhos, cronogramas, assinaturas) — IDs de terceiros retornam 404/403. Recursos por plano validados **no backend** (limite diário, simulados, cronogramas, IA). Gabarito nunca é enviado antes da resposta. |
| **A02 Falhas criptográficas** | Senhas com bcrypt (custo 12). JWT HS256 com algoritmo fixo e segredo ≥ 32 caracteres (obrigatório em produção). Refresh tokens opacos de 256 bits, guardados só como hash SHA-256. HTTPS obrigatório (Caddy/Let's Encrypt) + HSTS. Backups com AES-256 (PBKDF2). |
| **A03 Injeção** | TypeORM com parâmetros em todas as consultas (inclusive SQL manual). Curingas do `LIKE` escapados. Validação estrita de entrada (`class-validator`, `whitelist` + `forbidNonWhitelisted`), limites de tamanho em todos os campos. React escapa a saída; respostas da IA são renderizadas como texto. URLs de mídia aceitam só `https`. |
| **A04 Design inseguro** | Rate limit global (Redis) e específico por rota: cadastro, login, refresh, recuperação de senha, respostas, checkout, IA. Limites no nginx para `/api/auth`. Anti-manipulação do ranking (XP só na primeira resposta, em revisões pendentes e na primeira conclusão de tarefa). Limites de baralhos/cards por usuário. |
| **A05 Configuração** | A API **não sobe em produção** com segredo fraco, senha padrão, `DB_SYNC`, pagamento simulado ou sem SMTP (`src/config/env.ts`). Helmet (CSP, nosniff, frame-ancestors, CORP, HSTS), `x-powered-by` removido, CORS restrito ao domínio. nginx com CSP, `X-Frame-Options: DENY`, `Permissions-Policy`, `server_tokens off`. Health check sem topologia em produção. Containers sem root, `read_only` e `no-new-privileges`. |
| **A06 Componentes vulneráveis** | NestJS 11 e dependências atualizadas: `npm audit` sem vulnerabilidades. CI falha em vulnerabilidades high/critical; Dependabot semanal para npm, Docker e Actions. |
| **A07 Autenticação** | Confirmação de e-mail obrigatória e 2FA opcional (app autenticador ou e-mail, com códigos de recuperação) — ver seção abaixo. Access token de 15 min **só em memória** no navegador; refresh token em cookie `httpOnly`, `Secure`, `SameSite=Strict`, restrito a `/api/auth`, **rotacionado a cada uso** e com **detecção de reuso** (revoga todas as sessões). Checagem de origem (anti-CSRF) nas rotas com cookie. Bloqueio após 5 falhas de login por 15 min. Mensagens genéricas e tempo constante (hash fictício) contra enumeração de contas. Política de senha (8–72, letras e números, lista de senhas comuns, sem o e-mail). Recuperação por link de uso único (30 min, guardado como hash). Troca de senha e redefinição encerram todas as sessões. |
| **A08 Integridade** | Webhook do Mercado Pago com assinatura HMAC-SHA256 verificada em tempo constante e janela anti-replay; o status do pagamento é sempre **reconsultado na API** (o corpo do webhook não é confiável) e o valor pago é conferido. Ativação idempotente. `npm ci` com lockfiles; build em múltiplos estágios. |
| **A09 Logs e monitoramento** | Log de acesso com `X-Request-Id`, sem corpo nem cabeçalhos sensíveis. Eventos de segurança estruturados (login, falhas, bloqueio, reuso de token, redefinição, exclusão, pagamentos, assinatura inválida), com e-mails mascarados. |
| **A10 SSRF** | O servidor só faz requisições a destinos fixos (Mercado Pago, provedor de IA, SMTP), com timeout. Nenhuma URL vinda do usuário é buscada pelo backend. |

## Verificação de e-mail e verificação em duas etapas (2FA)

- **Cadastro com confirmação de e-mail**: a conta só recebe sessão depois do código de 6 dígitos enviado por e-mail.
  Contas não confirmadas que tentam entrar recebem um novo código.
- **Códigos por e-mail**: gerados com `crypto.randomInt`, guardados só como hash (SHA-256 vinculado ao desafio),
  válidos por 10 min, 5 tentativas por desafio (depois ele é invalidado), reenvio com espera de 60 s e no máximo 5 envios.
  O desafio é um token opaco de 256 bits, de uso único.
- **2FA por app autenticador (TOTP, RFC 6238)**: compatível com Google/Microsoft Authenticator, Authy e 1Password;
  QR Code gerado no servidor; segredo de 160 bits **criptografado em repouso com AES-256-GCM** (`ENCRYPTION_KEY`);
  tolerância de ±30 s e **bloqueio de reuso do mesmo código**. Implementação testada com os vetores oficiais da RFC.
- **2FA por e-mail**: código de 6 dígitos a cada entrada.
- **Códigos de recuperação**: 10 códigos de uso único, guardados como hash, exibidos uma única vez.
- **Alterações sensíveis** (desativar 2FA, gerar novos códigos) exigem senha + segundo fator. Ativação, desativação e
  uso de código de recuperação disparam **e-mail de alerta**.
- Com TOTP ativo, não é possível trocar para código por e-mail na hora do login (evita rebaixar a proteção).

## LGPD e proteção de dados

- **Consentimento**: aceite dos Termos e da Política no cadastro, com data e versão registradas.
- **Direitos do titular** (art. 18), em *Minha conta*: correção de dados, **exportação completa em JSON** (portabilidade), encerramento de todas as sessões e **exclusão da conta** (perfil e histórico apagados; pagamentos mantidos sem vínculo pessoal, por obrigação fiscal).
- **Minimização**: ranking mostra só primeiro nome + inicial; a IA recebe apenas o texto da pergunta; logs mascaram e-mails; dados de cartão nunca passam pelo servidor (Mercado Pago).
- **Segurança da informação**: banco e cache em rede Docker `internal` (sem internet e sem portas publicadas), Redis com senha e comandos perigosos desabilitados, 3 nós Postgres com replicação e failover, backup diário criptografado com retenção.
- **Cookies**: somente o cookie essencial de sessão.

## Operação

- Gere segredos com `openssl rand -base64 48`. Nunca versione `.env.production` (já está no `.gitignore`).
- Copie `./backups` para um armazenamento externo. Para restaurar:
  `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in ARQUIVO.enc | gunzip | psql`.
- Rotação do `JWT_SECRET` invalida todas as sessões (os usuários só precisam entrar de novo).
