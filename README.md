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

## Rodando

```bash
cp .env.example .env        # opcional: ANTHROPIC_API_KEY para a IA
docker compose up -d --build
```

- Frontend: http://localhost:5173
- API: http://localhost:3000/api (health em `/api/health`, mostra qual nó respondeu)
- Admin semeado: `admin@medtrouxa.dev` / `admin123`

No primeiro boot o backend cria as tabelas (`DB_SYNC=true`) e popula áreas, temas, questões,
baralhos e cronogramas de exemplo.

### Desenvolvimento local

```bash
docker compose up -d pg-0 pg-1 pg-2 pgpool redis
cd backend && npm i && DB_SYNC=true npm run start:dev
cd frontend && npm i && npm run dev     # proxy /api -> :3000
```

### Testando o failover

```bash
docker compose exec pgpool bash -c 'PGPASSWORD=adminpass psql -h localhost -U postgres -c "show pool_nodes"'
docker compose stop pg-0        # pg-1 ou pg-2 vira primário em ~30s; a API segue escrevendo
docker compose start pg-0       # pg-0 volta como standby e sincroniza
```

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
