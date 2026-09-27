/**
 * @fileoverview Operator README for the Faelith Industries website monorepo.
 * @author Samuel S. L.
 * @version 1.3.1
 * @since 2026-09-06
 * @copyright (c) 2026 Samuel S. L. All rights reserved.
 * All information contained herein is, and remains, the property of
 * Samuel S. L. and its suppliers, if any.
 *
 * The intellectual, technical, creative, and software concepts contained
 * herein are proprietary to Samuel S. L. and its suppliers and
 * are protected by copyright law, trade secret law, and other applicable
 * intellectual property laws in the Netherlands, the European Union, and
 * other foreign jurisdictions.
 *
 * Where applicable, such rights may be registered, recorded, or protected
 * with the competent authorities of the Government of the Netherlands,
 * the European Union, and/or other relevant jurisdictions.
 *
 * Dissemination of this information, reproduction of this material,
 * modification, distribution, disclosure, or commercial use is strictly
 * forbidden unless prior written permission is obtained from
 * Samuel S. L.
 *
 * @commercialUse Commercial use permitted only with prior written permission from Samuel S. L.
 *
 * <DETAILED_DESCRIPTION>:
 * - React + Vite SPA in apps/web; Axum origin in crates/faelith-web
 * - Shares the faelith_api Postgres primary; schema lives only in faelith-core migrations
 * - Signup verified by emailed code; 2FA via TOTP app, email code, and 12 backup codes
 */

# Faelith Industries website

Site público e dashboard autenticado.

- Frontend: React + Vite + TypeScript (`apps/web`)
- Origin: Axum 0.8 (`crates/faelith-web`)
- Banco: o **mesmo Postgres primary** de `faelith_api` (migrations só em `faelith-core`)
- Pagamentos: Stripe Checkout (planos + pacotes de crédito) e Customer Portal
- Inglês na UI. Sem plano Free.

O origin **não termina TLS**. Em produção o SPA é o `apps/web/dist` servido pelo próprio Axum (`WEB_DIST`); um reverse proxy faz HTTPS na frente.

## Redis: já está no código

Você **não precisa implementar Redis**. O limiter de auth (`RedisLimiter`) já existe: `INCR` + `EXPIRE` nas chaves `web:rl:{bucket}:{key}` (login, signup, OAuth start, contact — 10 tentativas / 15 min). Sem Redis o check **fail-closed** (bloqueia o login). Sem `REDIS_URL`, cai no limiter in-memory — **não use em produção**.

Use a **mesma instância** do `faelith_api`. Não há schema. O how-to completo (compose, `PING`, senha, Docker de produção) está em `faelith_api/README.md` na seção **Como rodar o Redis**.

Resumo:

```bash
# Na pasta faelith_api — sobe redis:7-alpine na :6379, sem senha
docker compose up -d redis
docker compose exec redis redis-cli PING
# PONG

# No .env deste repo (local):
REDIS_URL=redis://127.0.0.1:6379

# Produção (mesmo Redis da API, com senha):
REDIS_URL=redis://:SUA_SENHA@127.0.0.1:6379/0
```

Exporte a variável **antes** de `cargo run -p faelith-web` (o binário não lê `.env`). Se a API já está no ar com esse Redis, o web só aponta para o mesmo `REDIS_URL`.

## Produção (passo a passo)

Os binários **não lêem `.env` sozinhos**. Use systemd `EnvironmentFile`, `env_file` do Docker, ou `set -a && source /etc/faelith/web.env && set +a`.

Este repo **não tem** `docker-compose` próprio. Postgres e Redis vêm do `faelith_api` (ou do seu provedor).

### 1. Dependências

- Rust 1.85+ (o origin depende de `../faelith_api_test/crates/faelith-core` por enquanto; trocar para `../faelith_api` no `Cargo.toml` ao ir para produção)
- Node 22 LTS (build da SPA)
- Postgres 16 **primary** — a mesma `DATABASE_URL` do gateway
- Redis 7 standalone com AUTH — a mesma instância do gateway serve
- Stripe **live** (Checkout, Customer Portal, webhook)
- Apps OAuth GitHub e Google (opcional, mas necessário se o botão existir na UI)
- Reverse proxy TLS

Suba o gateway (`faelith-gateway`) pelo menos uma vez contra o banco para aplicar as migrations (`001`–`008`). O web também chama `sqlx::migrate!` na conexão; tanto faz quem corre primeiro, desde que seja o primary.

### 2. Segredos

```bash
# FAELITH_KEY_PEPPER (>= 16 bytes). OBRIGATÓRIO ser o mesmo do faelith-gateway.
# Sem isso, chaves emitidas no dashboard não autenticam na API.
openssl rand -base64 48

# COOKIE_SECRET (>= 16 bytes). HMAC do cookie de sessão. Nunca reutilize o pepper.
openssl rand -base64 48

# MFA_SECRET (>= 32 bytes). Cifra as seeds TOTP e assina os códigos de uso único.
# Diferente de todos os outros. Faça backup: se ele mudar ou se perder, todo
# autenticador cadastrado para de funcionar e os usuários precisam de backup code.
openssl rand -base64 48
```

### 3. Variáveis

Copie `.env.example` e preencha. Referência de produção:

```bash
# Axum atrás do proxy, só loopback.
LISTEN_ADDR=127.0.0.1:8081

# Origin público HTTPS, sem barra no final. Tem que bater com o Host que o browser vê.
PUBLIC_ORIGIN=https://www.example.com

COOKIE_SECURE=1
COOKIE_SECRET=<32+ bytes>
# Só ligue se o proxy SOBRESCREVE X-Forwarded-For (não append).
TRUST_FORWARDED_HEADERS=1

# Mesmo primary e mesmo pepper do faelith_api.
DATABASE_URL=postgres://USER:PASS@127.0.0.1:5432/faelith
FAELITH_KEY_PEPPER=<idêntico ao gateway>

# Obrigatório em produção (vários workers).
REDIS_URL=redis://:SENHA@127.0.0.1:6379/0

# 2FA e verificação de e-mail.
MFA_SECRET=<32+ bytes, único>
SMTP_HOST=email-smtp.eu-west-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURITY=starttls
SMTP_USERNAME=...
SMTP_PASSWORD=...
MAIL_FROM=Faelith <no-reply@faelithindustries.com>

# Stripe live. Fulfillment é só via webhook; o Checkout não credita sozinho.
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_MAX=price_...
STRIPE_PRICE_ULTRA=price_...
STRIPE_PRICE_SCALE=price_...
STRIPE_PRICE_STARTER_YEARLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_MAX_YEARLY=price_...
STRIPE_PRICE_ULTRA_YEARLY=price_...
STRIPE_PRICE_SCALE_YEARLY=price_...
STRIPE_PRICE_CREDITS_10=price_...
STRIPE_PRICE_CREDITS_50=price_...
STRIPE_PRICE_CREDITS_100=price_...

OAUTH_GITHUB_CLIENT_ID=...
OAUTH_GITHUB_CLIENT_SECRET=...
OAUTH_GOOGLE_CLIENT_ID=...
OAUTH_GOOGLE_CLIENT_SECRET=...

# Caminho absoluto: o cwd do systemd pode não ser a raiz do repo.
WEB_DIST=/opt/faelith/web/dist

RUST_LOG=info
```

Regras:

- `DATABASE_URL`, `FAELITH_KEY_PEPPER`, `COOKIE_SECRET`, `CHAT_KEY_SECRET`, `MFA_SECRET` e `STRIPE_SECRET_KEY` são obrigatórios no boot.
- `SMTP_HOST` é obrigatório: o processo testa a conexão SMTP no boot e **não sobe** se o relay falhar. Sem SMTP ninguém consegue criar conta.
- `COOKIE_SECURE=1` em produção. Cookie vira `__Host-faelith-sid` (`Secure; HttpOnly; SameSite=Lax; Path=/`, sem `Domain`). Isso **exige HTTPS**. HTTP local usa `COOKIE_SECURE=0` (`faelith-sid`).
- `PUBLIC_ORIGIN` tem que ser exatamente a origem pública (`https://host`). CSRF e redirects OAuth usam isso.
- `TRUST_FORWARDED_HEADERS=1` só atrás de um proxy que **substitui** `X-Forwarded-For`. Se o cliente puder injetar o header, deixe `0`.
- Price IDs ficam **só no servidor**. A SPA nunca vê valores.
- `STRIPE_PRICE_*_YEARLY` entram quando o Checkout manda `interval=yearly`.

### 4. Build da SPA + origin

Não rode `npm run dev` em produção. O Vite de desenvolvimento faz proxy para `:8081`; em produção o Axum serve o `dist`.

```bash
cd apps/web
npm ci
npm run build
# gera apps/web/dist (index.html + assets)

cd ../..
cargo build --release -p faelith-web
# target/release/faelith-web
```

Copie o binário e o `dist` para o servidor. `WEB_DIST` aponta para o diretório que contém `index.html`. Se `index.html` não existir, o origin sobe mas a UI não é servida (API/auth/stripe continuam).

systemd (exemplo):

```ini
[Service]
User=faelith
WorkingDirectory=/opt/faelith/web
EnvironmentFile=/etc/faelith/web.env
ExecStart=/opt/faelith/web/faelith-web
Restart=on-failure
```

### 5. Proxy TLS (mesmo host da API)

Exemplo de papéis:

| Host público | Upstream |
|---|---|
| `https://www.example.com` | `127.0.0.1:8081` (este origin + SPA) |
| `https://api.example.com` | `127.0.0.1:8080` (`faelith-gateway`) |

O site e a API são origens diferentes. Cookies `__Host-` não viajam para `api.`. O CLI usa Bearer `sk-fae_…` na API; o dashboard usa cookie neste origin.

Timeouts: webhook Stripe e OAuth são curtos. `POST /stripe/webhook` precisa do **body cru** (assinatura HMAC). Não reescreva o body no proxy.

`GET /healthz` devolve `ok` e não toca Postgres/Redis.

### 6. Stripe

1. Crie os Prices live (Starter/Pro/Max/Ultra/Scale mensal e anual; packs 10/50/100).
2. Cole os IDs nas `STRIPE_PRICE_*`.
3. Webhook: `POST {PUBLIC_ORIGIN}/stripe/webhook`.
4. Eventos necessários: sessão de Checkout completada e (se usar) mudanças de subscription/portal. O código só credita depois da verificação de `Stripe-Signature` com `STRIPE_WEBHOOK_SECRET`.
5. Customer Portal: o return URL usa `PUBLIC_ORIGIN`.

Test mode (`sk_test_`, `whsec_` de teste) é só desenvolvimento. Go-live = chaves `sk_live_` + endpoint live.

### 7. OAuth

Redirect URIs **exatas**:

- `{PUBLIC_ORIGIN}/auth/github/callback`
- `{PUBLIC_ORIGIN}/auth/google/callback`

GitHub: OAuth App com esses callbacks. Google: OIDC, tipo Web, mesmo callback. Sem `CLIENT_ID`/`SECRET` o start OAuth falha; o signup/login por senha continua.

### 7.1 E-mail transacional e 2FA

O cadastro envia um código de 6 dígitos por e-mail e só cria a conta depois do código. O 2FA oferece app autenticador (QR code), código por e-mail e 12 backup codes de uso único. Tudo depende de SMTP.

**Não mande e-mail direto da VPS** (Postfix próprio): IP de VPS costuma estar em blocklist e cai em spam. Use o SMTP de um provedor transacional. Qualquer um funciona só trocando `SMTP_*`:

| Provedor | `SMTP_HOST` | Porta |
| --- | --- | --- |
| Amazon SES | `email-smtp.<região>.amazonaws.com` | 587 |
| Postmark | `smtp.postmarkapp.com` | 587 |
| Resend | `smtp.resend.com` | 587 ou 465 |
| Brevo | `smtp-relay.brevo.com` | 587 |

`SMTP_SECURITY`: `starttls` (587, padrão) ou `tls` (465, TLS implícito). `plain` só é aceito para relay em loopback (Mailpit no dev). O TLS é validado contra as raízes webpki; sem OpenSSL na VPS.

DNS do domínio remetente (sem isso Gmail/Outlook rejeitam ou mandam para spam):

- **SPF**: TXT `v=spf1 include:<do provedor> -all`
- **DKIM**: os CNAME/TXT que o provedor gerar
- **DMARC**: TXT em `_dmarc` com `v=DMARC1; p=quarantine; rua=mailto:dmarc@seu-dominio`

Regras de segurança já implementadas:

- Códigos valem 10 min, 5 tentativas, reenvio a cada 60 s; ficam no banco só como HMAC (`MFA_SECRET`).
- Login com 2FA ativo (senha **ou** GitHub/Google) recebe um cookie de desafio de 10 min, nunca uma sessão, até o segundo fator.
- Código TOTP não pode ser reutilizado (proteção de replay por passo de 30 s).
- Desligar fator ou gerar novos backup codes exige prova de 2FA; toda mudança manda e-mail de aviso.
- O cadastro responde igual para e-mail já registrado (dono recebe "você já tem conta"), sem enumeração.

### 8. Checklist antes de abrir o site

- [ ] `COOKIE_SECURE=1` e o site só em HTTPS
- [ ] `PUBLIC_ORIGIN` = origem real do browser
- [ ] `FAELITH_KEY_PEPPER` idêntico ao `faelith-gateway`
- [ ] `DATABASE_URL` no **mesmo** primary da API
- [ ] `REDIS_URL` definida (não o fallback in-memory)
- [ ] `WEB_DIST` absoluto, `index.html` presente
- [ ] Stripe live + webhook verificado (`/stripe/webhook`)
- [ ] OAuth callbacks batendo com `PUBLIC_ORIGIN`
- [ ] `TRUST_FORWARDED_HEADERS=1` só se o proxy sanitiza o IP
- [ ] `MFA_SECRET` único e com backup fora da VPS
- [ ] SMTP verificado no log de boot (`smtp relay verified`) e SPF/DKIM/DMARC publicados
- [ ] Cadastro de teste recebeu o código na caixa de entrada (não no spam)
- [ ] Gateway da API no ar (`/readyz`) se o dashboard for emitir chaves

## Desenvolvimento

1. Copie `.env.example` para `.env` e preencha. Stripe em **test mode**.
2. Suba Postgres/Redis do compose em `faelith_api_test` (stack de teste atual; o Chat do site fala com o gateway de teste em `127.0.0.1:8788` por padrão).
3. `COOKIE_SECURE=0` (HTTP local não consegue cookie `__Host-`).
4. Exporte as vars (o binário não carrega `.env`).
   - E-mail no dev: `FAELITH_ALLOW_LOG_MAILER=1` escreve os códigos no log em vez de enviar.
     Para ver o e-mail real, rode o Mailpit (`docker run -p 1025:1025 -p 8025:8025 axllent/mailpit`)
     com `SMTP_HOST=127.0.0.1`, `SMTP_SECURITY=plain`, `MAIL_FROM=Faelith <dev@localhost>` e abra `http://127.0.0.1:8025`.
5. Origin:

```
cargo run -p faelith-web
```

6. SPA (proxy `/api`, `/auth`, `/stripe` → `127.0.0.1:8081`, **sem** reescrever `/api`):

```
cd apps/web
npm install
npm run dev
```

`PUBLIC_ORIGIN=http://127.0.0.1:5173` no dev para CSRF/OAuth baterem com o Vite.

## Testes

```
cargo test --workspace
cd apps/web && npx tsc --noEmit && npm run build
```

Playwright (`npm run test:smoke`) espera `npm run dev` na porta 5173.

## Docs

- https://docs.rs/axum/latest/axum/
- https://vite.dev/guide/
- https://docs.stripe.com/payments/checkout-sessions
- https://docs.stripe.com/webhooks
- https://docs.rs/argon2/latest/argon2/
- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- https://developers.google.com/identity/openid-connect/openid-connect
- https://www.rfc-editor.org/rfc/rfc9700
