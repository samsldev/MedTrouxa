# ⚡ MedTrouxa

Plataforma de estudos para estudantes de medicina, inspirada no [MEDsimple](https://medsimple.com/):
questões comentadas, flashcards com repetição espaçada, simulados cronometrados, cronogramas de estudo,
tutora com IA e ranking — da faculdade ao ENAMED e à residência.

> "Trouxa" é referência a Harry Potter 🦉

## Funcionalidades

| Módulo | O que faz |
| --- | --- |
| **Banco de questões** | Filtros por grande área, tema, banca/ano, dificuldade, "não resolvidas" e "que errei". Correção na hora com comentário e % de marcação da comunidade. |
| **Flashcards** | Baralhos públicos e pessoais, revisão com algoritmo **SM-2** (Errei / Difícil / Bom / Fácil) e geração de cards por IA a partir de um resumo. |
| **Simulados** | Monta prova aleatória por filtros, com cronômetro, finalização automática ao fim do tempo, nota e gabarito comentado. |
| **Cronogramas** | Planos (ENAMED, Residência, Clínica) com tarefas diárias e progresso. |
| **Coruja (IA)** | Chat tutor e "explicar questão" (usa a API do Claude; defina `ANTHROPIC_API_KEY`). Limite de 30 req/h por usuário via Redis. |
| **Desempenho** | Aproveitamento geral e por área, atividade dos últimos 14 dias, sequência de dias (streak), XP. |
| **Ranking** | Ranking global de XP (sorted set no Redis). |
| **Landing + Planos** | Página de vendas, 3 assinaturas com parcelamento em até 12x e checkout (Pix ou cartão). |

## Planos

| Plano | Parcelado | À vista | Acesso | Destaques |
| --- | --- | --- | --- | --- |
| **Aprendiz** | 12x R$ 59,90 | R$ 599,90 | 1 ano | Questões, flashcards, simulados, Coruja IA (30/h) |
| **Alquimista** · mais escolhido | 12x R$ 79,90 | R$ 799,90 | 1 ano | + Cronogramas guiados, provas de residência, 3x mais IA (90/h) |
| **Arcano** · melhor custo-benefício | 12x R$ 189,90 | R$ 1.899,90 | 6 anos | Alquimista a faculdade inteira, pagamento único (−60% vs. 6 anos de Alquimista) |

Regras de cobrança (`backend/src/billing`): à vista (Pix ou 1x no cartão) = preço à vista; de 2x a 12x o total é
12 × parcela anunciada, dividido em n vezes. Os limites do plano são aplicados no backend (cronogramas e cota da IA).
**A cobrança ainda é simulada**: o checkout aprova na hora e não coleta dados de cartão. Para produção, integre um
gateway (Pagar.me, Mercado Pago, Stripe) em `BillingService.checkout`.

## Prova social (números, aprovados e depoimentos)

- **Números** (`GET /api/public/stats`): contados ao vivo no banco — questões, flashcards, questões resolvidas e
  estudantes. Nunca são inventados; acima de mil aparecem como "+80 mil".
- **Aprovados e depoimentos** (`GET /api/public/testimonials`): tabela `testimonials`, gerenciada pelo admin:
  `POST`, `PATCH /:id` e `DELETE /:id` em `/api/public/testimonials`. Campos: nome, faculdade, depoimento,
  especialidade, instituições, destaque (ex.: "93 pontos no ENAMED"), nota, foto, vídeo, `featured` (cards grandes)
  e `approved` (entra no mural de aprovados). As seções somem sozinhas enquanto não houver registros.
  Só publique depoimentos reais, com autorização de uso de nome e imagem.
- **Modo de teste** (`DEMO_CONTENT=true`, padrão do compose): a landing mostra números fictícios (+48 mil questões,
  +2.700 aprovados, +21 mil estudantes…), nomes de aprovados e depoimentos em texto e vídeo gerados para teste,
  tudo em `backend/src/database/demo.ts`. **Com `NODE_ENV=production` o modo de teste é desligado
  automaticamente** e a landing passa a mostrar só números e depoimentos reais cadastrados.

### Rodapé

Dados da empresa via variáveis do build do frontend (campos vazios não aparecem):
`VITE_LEGAL_NAME`, `VITE_CNPJ`, `VITE_CONTACT_EMAIL`, `VITE_WHATSAPP` (só dígitos com DDI) e `VITE_INSTAGRAM` (usuário).
Termos de uso e Política de privacidade estão em `/termos` e `/privacidade`, ainda como "em preparação".

## Identidade visual

"Medicina mágica, minimalista": meia-noite (`#0E1030`), pergaminho (`#FAF7F0`) e ouro antigo (`#B8904F`), com
Cormorant Garamond nos títulos e Inter no texto (fontes embutidas no bundle via `@fontsource`). Ícones de traço
fino, céu estrelado discreto e modo escuro automático. Tokens em `frontend/src/styles.css`.

## Arquitetura

```
 React + Vite ──► NestJS API ──► Pgpool-II ──┬─► pg-0 (primário)  ─┐ streaming
     :5173          :3000          :5432      ├─► pg-1 (réplica)  ◄┤ replication
                      │                       └─► pg-2 (réplica)  ◄┘ (repmgr)
                      └──► Redis :6379 (cache, ranking, streak, rate-limit)
```

- **Postgres HA**: 3 nós `postgresql-repmgr`. Toda escrita no primário é replicada às 2 réplicas.
  Se o primário cai, o **repmgr promove automaticamente** uma réplica; quando o nó antigo volta,
  ele **se reintegra como réplica** do novo primário e recebe o que foi escrito durante a queda.
- **Pgpool-II** fica na frente: detecta sozinho quem é o primário (escritas) e balanceia leituras
  entre as réplicas. O backend só conhece o `pgpool`, então o failover é transparente para a aplicação.
- **Redis**: cache-aside (árvore de assuntos, estatísticas, planos), ranking de XP, streak e rate-limit da IA.
  Se o Redis cair, a API continua funcionando (sem cache).

## Produção

```bash
cp .env.production.example .env.production   # preencha todos os segredos (openssl rand -base64 48)
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

- **HTTPS automático** via Caddy (aponte o DNS de `DOMAIN` para o servidor antes). Só as portas 80/443 ficam públicas.
- **Pagamentos**: Mercado Pago Checkout Pro (Pix à vista ou cartão em até 12x). Configure o webhook no painel do
  Mercado Pago para `https://SEU_DOMINIO/api/billing/webhook/mercadopago` (evento *Pagamentos*) e copie a
  *assinatura secreta* para `MP_WEBHOOK_SECRET`. O acesso só é liberado após o webhook confirmar o pagamento.
- **E-mail**: `SMTP_URL` envia os códigos de confirmação de cadastro, os códigos de 2FA, alertas de segurança e a recuperação de senha.
- **2FA**: defina `ENCRYPTION_KEY` (`openssl rand -base64 32`) e guarde-a com os backups — sem ela, o 2FA por app deixa de funcionar.
- **Banco**: o schema é criado e atualizado por migrations (`backend/src/database/migrations`) automaticamente no boot.
  Para mudanças no modelo: `cd backend && npm run migration:generate`.
- **Admin**: defina `ADMIN_EMAIL`/`ADMIN_PASSWORD` no primeiro deploy; o painel fica em `/admin`.
- **Backups** diários criptografados em `./backups`.

### Nota fiscal (NFS-e Nacional)

Emissor próprio da **NFS-e Nacional** (padrão nacional gov.br), portado 1:1 do emissor em Rust do Faelith
(`backend/src/nfse`, original em `exemplo_nfe/faelith_web/crates/faelith-web/src/nfse`):

- **Automático no webhook**: pagamento aprovado no Mercado Pago → a nota entra na fila (uma por assinatura, idempotente)
  **antes** de liberar o acesso. Um worker a cada 30 s monta a DPS (layout 1.01), assina (XMLDSig RSA-SHA1 com o
  certificado A1), envia à Sefin Nacional por mTLS e **manda o e-mail com o PDF (DANFSe) e o XML anexados**.
- **CPF/CNPJ**: vem do pagador no Mercado Pago, do campo no checkout ou de *Assinatura → Notas fiscais*. Sem ele, a nota
  fica "Aguardando seu CPF / CNPJ" e o cliente recebe um e-mail; ao informar, a emissão é retomada.
- **Robustez**: número de DPS atômico por série e gravado antes do envio; resultado incerto é recuperado pelo id da DPS
  (nunca reenvia em duplicidade); falhas transitórias com espera exponencial (até 6 h); rejeições param para o admin.
- **Estornos**: reembolso integral ou chargeback cancela a nota (evento e101101); estorno parcial fica para revisão.
- **Admin** (`/admin` → Notas fiscais): status do emissor e validade do certificado (alerta a 30 dias), filtros,
  downloads, reprocessar e cancelar (exige senha e 2FA, fica no log de segurança).
- **Guarda legal**: notas nunca são apagadas, nem na exclusão da conta.

Configuração: veja o bloco `NFSE_*` em `.env.production.example`. Comece com `NFSE_ENV=homologacao` e valide com o
contador (cTribNac, NBS, regime do Simples). Em desenvolvimento o compose usa `NFSE_ENABLED=simulate`, que monta e
assina a DPS de verdade mas simula o sistema nacional (notas sem valor fiscal).

Conformidade testada: o port gera o **mesmo documento, byte a byte**, que o emissor em Rust para o exemplo
`docs/nfse-exemplo/dps_starter.xml`, com o mesmo `DigestValue`, e a assinatura original valida sobre o SignedInfo do port.

Detalhes de segurança e LGPD: [SECURITY.md](SECURITY.md).

### Plano gratuito × pagos

| Recurso | Gratuito | Aprendiz | Alquimista / Arcano |
| --- | --- | --- | --- |
| Questões comentadas | 20 por dia | ilimitadas | ilimitadas |
| Flashcards | ✓ | ✓ | ✓ |
| Simulados | — | ✓ | ✓ |
| Coruja IA | — | 30/h | 90/h |
| Cronogramas guiados | — | — | ✓ |

## Rodando (desenvolvimento)

```bash
cp .env.example .env        # opcional: ANTHROPIC_API_KEY para a IA
docker compose up -d --build
```

- Frontend: http://localhost:5173
- API: http://localhost:3000/api (health em `/api/health`, mostra qual nó respondeu)
- Admin de desenvolvimento: `admin@medtrouxa.dev` / `Coruja#Dev2026` (em produção, use `ADMIN_EMAIL`/`ADMIN_PASSWORD`)
- Em dev, os e-mails (códigos de 6 dígitos) aparecem no log do backend
- Pagamentos simulados em dev (`PAYMENT_PROVIDER=fake`) — o checkout aprova na hora

No primeiro boot o backend cria as tabelas (`DB_SYNC=true`) e popula áreas, temas, questões,
baralhos e cronogramas de exemplo.

### Desenvolvimento local

```bash
docker compose up -d pg-0 pg-1 pg-2 pgpool redis
cd backend && npm i && REDIS_URL=redis://:devredis@localhost:6379 npm run start:dev   # aplica as migrations
cd frontend && npm i && npm run dev     # proxy /api -> :3000
```

### Testando o failover

```bash
docker compose exec pgpool bash -c 'PGPASSWORD=adminpass psql -h localhost -U postgres -c "show pool_nodes"'
docker compose stop pg-0        # pg-1 ou pg-2 vira primário em ~30s; a API segue escrevendo
docker compose start pg-0       # pg-0 volta como standby e sincroniza
```

Se **todos** os nós caírem ao mesmo tempo (ex.: reinício do Docker), os nós voltam sozinhos, mas o Pgpool pode
manter os nós marcados como `down`; nesse caso rode `docker compose restart pgpool`.

## Endpoints principais

`POST /auth/register|login` · `GET /auth/me` · `GET /subjects` · `GET /questions` · `POST /questions/:id/answer` ·
`GET /questions/:id/stats` · `GET|POST /flashcards/decks` · `GET /flashcards/decks/:id/due` · `POST /flashcards/cards/:id/review` ·
`POST /exams` · `POST /exams/:id/submit` · `GET /study-plans` · `POST /study-plans/:id/enroll` · `GET /stats/me` ·
`GET /stats/ranking` · `POST /ai/chat` · `POST /ai/explain/:questionId` · `POST /ai/flashcards`

Rotas de criação de questões/áreas/temas exigem papel `admin`.

## Próximos passos sugeridos

- Migrations TypeORM no lugar de `synchronize` para produção
- Modo offline dos flashcards (PWA)
- Importação em massa de questões e painel admin
- Refresh token e recuperação de senha
