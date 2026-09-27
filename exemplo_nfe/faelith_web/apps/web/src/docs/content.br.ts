/**
 * @fileoverview Documentação em português do Brasil (tradução de docs/content.ts).
 * @author Samuel S. L.
 * @version 1.0.1
 * @since 2026-09-25
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
 * DETAILED_DESCRIPTION:
 * - Same slugs as the English pages; title, summary and body per slug
 * - Code blocks, commands, field names and API values stay untranslated
 * - Keep in sync with docs/content.ts when the English pages change
 */

import type { DocGroup, DocTranslation } from './content';

export const DOC_GROUP_LABELS_BR: Record<DocGroup, string> = {
  'Get started': 'Primeiros passos',
  Models: 'Modelos',
  API: 'API',
  CLI: 'CLI',
  Customize: 'Personalizar',
  'Desktop and Web': 'Desktop e Web',
  Account: 'Conta',
};

export const DOC_PAGES_BR: Record<string, DocTranslation> = {
  overview: {
    title: 'Visão geral',
    summary: 'O que é o Faelith, quais ferramentas existem e como elas compartilham uma conta.',
    body: `
O Faelith é uma plataforma de programação com agentes, construída em torno de duas famílias de modelos, **Echo** e **Horizon**, e quatro ferramentas que compartilham uma conta, um conjunto de chaves e um orçamento de uso:

| Ferramenta | O que é | Onde |
| --- | --- | --- |
| **Code** | O agente de programação: lê, edita e testa o seu repositório | CLI e app desktop |
| **Chat** | Um assistente geral com pesquisa na web e anexos de arquivos | App desktop e este site |
| **CLI** | \`faelith\`, um único binário estático para macOS, Linux, WSL e Windows | [Download](/download) |
| **API** | Gateway HTTP compatível com OpenAI para o seu próprio software | A URL do gateway mostrada em **Chaves de API** |

## Como as peças se encaixam

- **Conta**: criada neste site. Guarda seu plano, sua carteira e suas chaves.
- **Chaves**: emitidas por finalidade (\`code\`, \`chat\`, \`api\`). Veja [Autenticação](/docs/authentication).
- **Planos**: uma assinatura libera medidores contínuos de 5 horas e semanal para Code e Chat. A API é pré-paga e debita da carteira. Veja [Uso](/docs/plans-and-usage).
- **Modelos**: \`echo\` e \`horizon\` (contexto de 256k) e \`echo1m\` e \`horizon1m\` (contexto de 1M). Veja [Echo e Horizon](/docs/models).

## Por onde seguir

1. [Início rápido](/docs/quickstart): instale a CLI ou o app e rode sua primeira tarefa em dois minutos.
2. [Chat Completions](/docs/chat-completions): chame a API do seu próprio código.
3. [Skills](/docs/skills), [Agentes](/docs/agents), [Servidores MCP](/docs/mcp) e [Plugins](/docs/plugins): estenda o agente.
4. [Tratamento de dados](/docs/data-handling): inferência ZDR e a captura criptografada do Faelith no S3.
`,
  },
  quickstart: {
    title: 'Início rápido',
    summary: 'Instale, entre na conta e passe a primeira tarefa para o Faelith.',
    body: `
## 1. Instale

**macOS / Linux / WSL**

\`\`\`bash
curl -fsSL https://get.faelithindustries.com | sh
\`\`\`

**Windows (PowerShell)**

\`\`\`powershell
irm https://get.faelithindustries.com/install.ps1 | iex
\`\`\`

Prefere uma janela? Baixe o app desktop para macOS, Windows ou Linux na página de [Download](/download). Ele inclui o Chat e o Code com o mesmo login.

## 2. Entre na conta

Rode \`faelith\` dentro de um repositório. O assistente inicial oferece duas formas de entrar:

- **Login pelo navegador (device flow)**: a CLI mostra um código curto, abre \`faelithindustries.com/cli/login\` e você aprova com a sua conta aberta. A CLI recebe uma chave com escopo automaticamente.
- **Colar uma chave de API**: crie uma em **Painel → Chaves de API** e cole. Use a finalidade \`code\` para a CLI e o app.

\`/logout\` sai da conta e volta para esta tela.

As mesmas duas opções aparecem na primeira tela do app desktop.

## 3. Rode uma tarefa

\`\`\`text
> Add a --json flag to the export command and cover it with a test.
\`\`\`

O Code lê os arquivos relevantes, propõe edições, roda os testes e mostra um diff. Aprove, refine, ou peça um plano antes com \`/plan\`.

## 4. Escolha um modelo e um esforço

\`\`\`text
/model horizon
/thinking high
\`\`\`

Ou clique nos seletores de modelo e de modo no compositor. O Echo é rápido e equilibrado; o Horizon raciocina mais fundo. Veja [Echo e Horizon](/docs/models).

## Próximos passos

- [A interface da CLI](/docs/cli-interface): sidebar, compositor, mouse e teclado.
- [Modos e permissões](/docs/cli-modes): Agent, Ask, Plan, Parallel e Peak.
- [Comandos com barra](/docs/cli-commands): a referência completa.
- [App desktop](/docs/desktop-app): sessões em vários painéis e a aba Plan.
`,
  },
  authentication: {
    title: 'Autenticação',
    summary: 'Chaves de API, finalidades das chaves, login por dispositivo e como cada ferramenta se autentica.',
    body: `
Toda requisição ao Faelith é autenticada com uma **chave de API bearer**. As chaves são criadas em **Painel → Chaves de API** e mostradas uma única vez na criação; guarde-as em um gerenciador de segredos.

\`\`\`http
Authorization: Bearer sk-fae_...
\`\`\`

## Finalidades das chaves

Cada chave tem uma finalidade. A finalidade decide qual medidor a requisição debita e quais ferramentas a aceitam.

| Finalidade | Aceita por | Debita |
| --- | --- | --- |
| \`code\` | CLI, Code no desktop | Medidores de 5 horas / semanal do Code |
| \`chat\` | Chat no desktop, Chat na web | Medidores de 5 horas / semanal do Chat |
| \`api\` | \`/v1/*\` a partir do seu software | Carteira pré-paga pelo preço de tabela |

Uma chave nunca troca de finalidade: uma chave \`chat\` não controla o Code, e uma chave \`api\` é a única que chega à sua carteira.

## Tratamento de dados

Toda chave usa o mesmo caminho de inferência **ZDR**. Separadamente, o Faelith guarda o I/O completo dos modelos e a transcrição completa do chat, criptografados, no próprio S3 por 90 dias. Veja [Tratamento de dados](/docs/data-handling).

## Login por dispositivo

A CLI e o app desktop conseguem entrar sem copiar uma chave:

1. O cliente chama \`POST /api/cli/device\` e recebe um \`device_code\` e um \`user_code\` curto.
2. Você abre \`https://faelithindustries.com/cli/login\` com a conta aberta, digita o código e aprova.
3. O cliente consulta \`POST /api/cli/device/poll\` até receber uma chave com finalidade \`code\`.

Os códigos duram pouco. Aprovar um código que você não pediu é a única forma de vazar uma chave, por isso a página pede que você digite o código e mostra o IP, o cliente e o horário da requisição; aprovar também pede que você confirme que é você e envia um e-mail. Veja [Segurança da conta](/docs/security).

## Sair

\`/logout\` na CLI ou **Sair** no app apaga as chaves guardadas localmente e volta para a tela de login. Revogue a própria chave em **Chaves de API** se perder a máquina.
`,
  },
  models: {
    title: 'Echo e Horizon',
    summary: 'IDs dos modelos, janelas de contexto, níveis de raciocínio e como escolher.',
    body: `
O Faelith serve duas famílias de modelos. As duas estão disponíveis com janela de contexto de **256k** e com um alias de **1M**, as duas aceitam texto e imagens, e as duas fazem streaming.

| ID do modelo | Família | Contexto | Melhor para |
| --- | --- | --- | --- |
| \`echo\` | Echo | 256k | Edições rápidas, chat, tarefas do dia a dia |
| \`echo1m\` | Echo | 1M | Contexto do repositório inteiro na velocidade do Echo |
| \`horizon\` | Horizon | 256k | Raciocínio em várias etapas, depuração difícil, design |
| \`horizon1m\` | Horizon | 1M | Investigações longas em bases de código grandes |

Os aliases 1M custam **1,25×** os equivalentes de 256k. Os preços estão na página de [Modelos](/models).

## Níveis de raciocínio

As duas famílias suportam raciocínio estendido. O nível controla quanto do orçamento o modelo pode gastar antes de responder:

| Nível | Comportamento |
| --- | --- |
| \`off\` | Sem raciocínio estendido; mais rápido |
| \`low\` | Raciocínio leve para tarefas simples (padrão do Echo) |
| \`medium\` | Pula o raciocínio em perguntas simples |
| \`high\` | Raciocínio profundo para tarefas complexas (padrão do Horizon) |
| \`xhigh\` | Sempre pensa a fundo |
| \`max\` | Profundidade máxima; mais lento |

Defina com \`/thinking <nível>\` na CLI, no seletor de medidor do app ou no campo \`reasoning_effort\` da API.

## Origem dos modelos

O Echo e o Horizon são pós-treinados pelo Faelith sobre os modelos base de pesos abertos **DeepSeek V4 Flash** e **DeepSeek V4 Pro**, respectivamente, e servidos na infraestrutura do Faelith com prompts, ferramentas e camadas de segurança do Faelith. Comportamento, preço e tratamento de dados são do Faelith; novas versões dos modelos base não mudam um ID de modelo sem você saber.
`,
  },
  'chat-completions': {
    title: 'Chat Completions',
    summary: 'POST /v1/chat/completions: corpo da requisição, streaming, ferramentas e imagens.',
    body: `
O gateway fala o protocolo chat-completions da OpenAI, então a maioria dos SDKs funciona trocando só a base URL.

\`\`\`bash
curl "$FAELITH_API_URL/v1/chat/completions" \\
  -H "Authorization: Bearer $FAELITH_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "echo",
    "messages": [{"role": "user", "content": "Summarize this repo layout."}],
    "stream": true
  }'
\`\`\`

## Requisição

| Campo | Tipo | Observações |
| --- | --- | --- |
| \`model\` | string | \`echo\`, \`echo1m\`, \`horizon\`, \`horizon1m\` |
| \`messages\` | array | Papéis \`system\`, \`user\`, \`assistant\`, \`tool\`; o conteúdo pode ser uma string ou um array de partes \`text\` / \`image_url\` |
| \`stream\` | boolean | Server-sent events com frames \`data:\` terminando em \`[DONE]\` |
| \`tools\` / \`tool_choice\` | array / string | Formato de function calling da OpenAI |
| \`reasoning_effort\` | string | Nível de raciocínio; veja [Echo e Horizon](/docs/models) |
| \`max_tokens\`, \`temperature\`, \`top_p\`, \`stop\` | — | Controles de amostragem padrão |

## Resposta

Respostas sem streaming retornam um objeto \`chat.completion\` com \`choices[0].message\` e um bloco \`usage\`:

\`\`\`json
{
  "usage": {
    "prompt_tokens": 1231,
    "completion_tokens": 212,
    "prompt_tokens_details": { "cached_tokens": 1024 }
  }
}
\`\`\`

Tokens de prompt em cache são cobrados pelo preço de cache read. Respostas com streaming emitem objetos \`chat.completion.chunk\`; o raciocínio chega em \`delta.reasoning_content\` antes de \`delta.content\`.

## Exemplo com SDK

\`\`\`python
from openai import OpenAI

client = OpenAI(base_url=os.environ["FAELITH_API_URL"] + "/v1", api_key=os.environ["FAELITH_API_KEY"])
stream = client.chat.completions.create(
    model="horizon",
    messages=[{"role": "user", "content": "Find the race in this scheduler."}],
    stream=True,
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")
\`\`\`

## Limites

- O corpo da requisição tem tamanho máximo no gateway (\`413\` quando ultrapassado); mantenha imagens base64 pequenas e prefira várias mensagens a um prompt gigante.
- Orçamentos, e não limites de taxa, são o motivo mais comum de falha: um \`402\` significa que um medidor ou a carteira acabou. Veja [Erros](/docs/errors).
`,
  },
  'account-endpoints': {
    title: 'Modelos, conta e uso',
    summary: 'GET /v1/models, /v1/account, /v1/usage e os endpoints de cobrança.',
    body: `
Estes endpoints permitem que o seu software inspecione a chave que está usando. Todos aceitam a mesma chave bearer das chat completions.

## GET /v1/models

Lista os modelos que a chave pode chamar, no formato \`list\` da OpenAI.

\`\`\`json
{ "object": "list", "data": [ { "id": "echo", "object": "model", "owned_by": "faelith" }, ... ] }
\`\`\`

## GET /v1/account

Retorna a conta por trás da chave: nome de exibição, e-mail e plano ativo.

## GET /v1/usage

Retorna os medidores contínuos da finalidade da chave. Todo medidor tem \`used\`, \`limit\`, \`remaining\` e \`exhausted\`, em micro-dólares de débito pelo preço de tabela.

\`\`\`json
{
  "plan": "pro",
  "usage": {
    "code_5h": { "used": 1210000, "limit": 3730000, "remaining": 2520000, "exhausted": false },
    "code_weekly": { "...": "..." },
    "chat_5h": { "...": "..." }
  },
  "available_resets": 1
}
\`\`\`

## POST /v1/billing/usage-based

\`{ "enabled": true }\` deixa o Code e o Chat continuarem pela carteira pré-paga quando um medidor acaba. Equivale à opção em **Cobrança**.

## POST /v1/billing/usage-reset/redeem

Consome o reset de uso não usado mais antigo e zera os medidores contínuos na hora. Retorna o novo retrato de uso. Os resets vêm com os planos anuais e são vendidos no painel.
`,
  },
  errors: {
    title: 'Erros e limites de taxa',
    summary: 'Códigos de status, corpos de erro e como medidores e carteira geram 402.',
    body: `
Os erros usam o envelope de erro da OpenAI: um \`error.code\` estável para você tratar, uma categoria \`error.type\`, uma mensagem legível \`error.message\` e \`error.param\` indicando a janela do medidor esgotada quando for o caso.

\`\`\`json
{
  "error": {
    "message": "plan limit reached for the 5h window",
    "type": "insufficient_quota",
    "param": "5h",
    "code": "plan_limit_reached"
  }
}
\`\`\`

## Códigos de status

| Status | Código | Tipo | Significado |
| --- | --- | --- | --- |
| 400 | \`invalid_request\` | \`invalid_request_error\` | Corpo malformado, campo desconhecido, parte de conteúdo não suportada |
| 400 | \`model_not_found\` | \`invalid_request_error\` | ID de modelo desconhecido, ou modelo que esta chave não pode usar |
| 400 | \`extraction_blocked\` | \`invalid_request_error\` | A requisição foi classificada como tentativa de extrair prompts de sistema ou pesos |
| 401 | \`invalid_api_key\` | \`authentication_error\` | Chave ausente, malformada ou revogada |
| 402 | \`plan_limit_reached\` | \`insufficient_quota\` | Um medidor contínuo está cheio; \`param\` é \`5h\` ou \`weekly\` |
| 402 | \`insufficient_quota\` | \`insufficient_quota\` | A carteira pré-paga está vazia (chaves de API, ou Code/Chat por uso) |
| 429 | \`rate_limit_exceeded\` | \`rate_limit_error\` | Requisições simultâneas demais em uma chave; espere e tente de novo |
| 500 | \`internal_error\` | \`api_error\` | Tente de novo com espera; inclua o ID da requisição ao falar com o suporte |
| 502 | \`upstream_error\` | \`api_error\` | A frota de modelos retornou um erro; pode tentar de novo |
| 503 | \`cluster_at_capacity\` | \`api_error\` | Frota na capacidade máxima; tente de novo após um instante |
| 503 | \`capture_unavailable\` | \`api_error\` | O armazenamento obrigatório da captura criptografada está temporariamente indisponível |

## Cabeçalhos de medidor

Toda resposta, inclusive de erro, traz os medidores atuais para que os clientes mostrem o orçamento sem outra chamada:

\`\`\`http
x-faelith-plan: pro
x-faelith-code-5h-used: 1210000
x-faelith-code-5h-limit: 3730000
x-faelith-code-weekly-used: ...
\`\`\`

Os valores são micro-dólares de débito pelo preço de tabela.

## Orçamentos versus limitação

Um **402** significa que um orçamento acabou e não vai se resolver tentando de novo:

- **Chaves de assinatura** batem primeiro no medidor de 5 horas, depois no semanal. Espere a janela ou resgate um reset de uso.
- **Chaves de API** debitam a carteira pelo preço de tabela. Recarregue em **Gastos**.
- Ativar a **cobrança por uso** faz as chaves de assinatura passarem para a carteira em vez de falhar.

Um **429** é o único sinal de limitação, vale por chave e dura pouco.

## Idempotência

Chat completions não são idempotentes. Se um stream cair no meio da resposta, você paga pelos tokens gerados até ali; reenvie com a mensagem parcial do assistente anexada se quiser continuar em vez de recomeçar.
`,
  },
  'cli-commands': {
    title: 'Comandos com barra',
    summary: 'Todos os /comandos embutidos da CLI e do app desktop do Faelith.',
    body: `
Digite \`/\` no compositor para abrir o seletor de comandos. Os mesmos comandos funcionam na CLI e nos painéis Code do app desktop.

## Sessão

| Comando | O que faz |
| --- | --- |
| \`/help\` | Lista comandos, skills e plugins |
| \`/clear\` | Começa uma conversa nova e limpa a lista de tarefas |
| \`/compact\` | Resume a conversa para liberar contexto |
| \`/sessions\` (\`/resume\`) | Reabre uma sessão anterior deste workspace |
| \`/rename\` | Renomeia a sessão atual |
| \`/rewind\` | Restaura arquivos e conversa a um checkpoint anterior |
| \`/export\` | Grava a transcrição em Markdown |
| \`/copy\` | Copia a última mensagem do assistente |
| \`/status\`, \`/stats\`, \`/cost\`, \`/token-usage\` | Status da sessão, estatísticas, estimativa de custo e orçamento de tokens |
| \`/exit\` | Sai da CLI |

## Modelo e comportamento

| Comando | O que faz |
| --- | --- |
| \`/model [id]\` | Mostra ou troca o modelo (\`echo\`, \`horizon\`, \`echo1m\`, \`horizon1m\`) |
| \`/thinking [nível]\` | Mostra ou define o nível de raciocínio |
| \`/mode\`, \`/ask\`, \`/plan\`, \`/parallel\`, \`/peak\` | Troca o modo de interação; veja [Modos e permissões](/docs/cli-modes) |
| \`/goal <texto>\`, \`/loop <prompt>\` | Trabalha até um objetivo verificado pelo host ser cumprido; repete um prompt a cada turno |
| \`/tasks\` | Mostra a lista de tarefas atual |
| \`/advisor\`, \`/bugfinder\`, \`/smartshift\` | Segunda opinião, inspetor pós-implementação, roteamento automático de modo |
| \`/subagent inherit\|echo\|horizon\` | Modelo padrão dos subagentes |
| \`/permissions [modo]\` | Mostra ou define o modo de permissão |
| \`/review\` | Revisa as mudanças atuais |

Veja [Advisor, Bugfinder, objetivos e mais](/docs/cli-features).

## Workspace e ferramentas

| Comando | O que faz |
| --- | --- |
| \`/init\` | Cria a pasta \`.faelith/\` do projeto |
| \`/add-dir <caminho>\` | Dá ao agente acesso a outra pasta |
| \`/files\`, \`/diff\` | Lista arquivos do projeto; alterna diffs lado a lado ou abre o diff de um arquivo |
| \`/worktree\`, \`/branch\` | Cria (ou apaga) um git worktree; cria um branch da sessão |
| \`/mcp\` | Gerencia [servidores MCP](/docs/mcp) |
| \`/skills\`, \`/agents\`, \`/hooks\`, \`/memory\` | Lista [skills](/docs/skills), [agentes](/docs/agents), [hooks](/docs/hooks) e [arquivos de memória](/docs/memory) |
| \`/plugin\`, \`/reload-plugins\` | Gerencia e recarrega [plugins](/docs/plugins) e skills |
| \`/autolearn\` | Aprendizado automático do \`FAELITH.md\` |
| \`/toolcalls\` | Linhas de ferramentas minimizadas ou completas |
| \`/sandbox-toggle\` | Sandbox do Bash ligado ou desligado |
| \`/scan\` | Diagnóstico do sistema |
| \`/vim\`, \`/keybindings\` | Teclas do Vim; lista todos os atalhos |
| \`/theme\` | Escuro ou claro |
| \`/settings\` | Abre as configurações interativas |

## Conta

| Comando | O que faz |
| --- | --- |
| \`/login\`, \`/subscription\` | Entra pelo navegador (device flow), ou cola uma chave com \`/login <chave>\` |
| \`/apikey\` | Salva uma chave de API do Faelith |
| \`/logout\` | Sai da conta e volta para a tela de login |
| \`/usage\`, \`/limits\` | Medidores de 5 horas e semanal; mostra ou oculta a linha de limites abaixo do compositor |
| \`/credits on\|off\` | Continua com créditos pré-pagos quando um medidor enche |
| \`/usage-reset\` | Lista ou resgata um reset de uso |
| \`/upgrade\` | Verifica se há uma nova versão da CLI |
| \`/version\`, \`/changelog\` (\`/release-notes\`) | Versão e notas de versão |

Skills, comandos de plugins e prompts MCP adicionam os próprios comandos \`/\`.
`,
  },
  'cli-modes': {
    title: 'Modos e permissões',
    summary: 'Agent, Ask, Plan, Parallel e Peak, e como as permissões de ferramentas são concedidas.',
    body: `
## Modos de interação

| Modo | Comportamento |
| --- | --- |
| **Agent** | Padrão. Lê, edita e executa comandos, pedindo permissão onde suas configurações exigem |
| **Ask** | Responde e explica; nunca edita nem executa nada |
| **Plan** | Produz um plano em Markdown terminando em uma checklist \`## To-dos\`. Nada é executado até você mandar construir |
| **Parallel** | Um coordenador divide o trabalho em lotes de subagentes, cada um no próprio git worktree |
| **Peak** | Peak-of-N: N implementações completas e isoladas da mesma tarefa (padrão 4, de 2 a 8), e o coordenador escolhe a melhor |

Troque com **Shift+Tab**, o seletor de modo no compositor, \`/mode\`, ou \`/ask\`, \`/plan\`, \`/parallel\`, \`/peak\`. Com o [SmartShift](/docs/cli-features#smartshift) ligado, o Faelith pode escolher o modo por você.

## Planejar, depois construir

No modo Plan o agente só lê e grava o plano em \`.faelith/plans/\`. A CLI abre uma revisão do plano onde você pode refiná-lo e escolher como executar (Agent, Parallel ou Peak, permissão e modelo); o app desktop mostra o plano na aba **Plan**. Selecione trechos para comentar e refinar, depois aperte **Build** (Agent) ou **Build in parallel** (Parallel). As tarefas só são criadas quando você constrói, então um plano nunca deixa tarefas pela metade.

## Permissões

Os modos de permissão são independentes dos modos de interação. Troque pelo chip \`◈\` abaixo do compositor, \`/permissions <modo>\` ou **Configurações**; ajustes por projeto ficam em \`.faelith/settings.json\`:

\`\`\`json
{
  "permissions": {
    "default_mode": "adaptive",
    "allow": ["Read", "Grep", "Glob", "Bash(npm test:*)"],
    "deny": ["Bash(rm -rf:*)"]
  }
}
\`\`\`

| Modo | Comportamento |
| --- | --- |
| \`adaptive\` | Padrão. Um classificador auxiliar aprova ações rotineiras e reversíveis e pede confirmação nas arriscadas |
| \`standard\` | Pede confirmação para toda edição e comando que não esteja numa regra de permissão |
| \`autoAccept\` | Aprova edições de arquivos automaticamente; comandos ainda pedem confirmação |
| \`fullAccess\` | Executa tudo sem perguntar; só para ambientes descartáveis |
| \`survey\` | Relata o que faria e pergunta antes de cada ferramenta |
| \`silentDeny\` | Nega tudo o que não estiver explicitamente permitido, sem perguntar |

Subagentes sempre rodam em \`adaptive\`. No app desktop o modo padrão vale para o **painel em foco**, então um painel cauteloso e um painel autônomo podem rodar lado a lado.

## Checkpoints e rewind

Toda edição gera um checkpoint. \`/rewind\` (ou o botão de voltar em uma mensagem) restaura arquivos e conversa até aquele ponto.
`,
  },
  'cli-interface': {
    title: 'A interface da CLI',
    summary: 'Sidebar, compositor, seletores, mouse e teclado na interface de terminal do Faelith Code.',
    body: `
Rode \`faelith\` em um repositório para abrir a interface em tela cheia. Ela tem o mesmo layout do app desktop, desenhado no terminal.

## Layout

| Área | O que mostra |
| --- | --- |
| **Sidebar** | Seletor de produto, **New worktree**, **Sessions**, **Settings**, a árvore **Projects** (este workspace e suas sessões), **Recents**, e sua conta e seu plano no rodapé |
| **Topbar** | O título da sessão e uma pílula com a pasta do workspace; \`◌\` enquanto o agente trabalha |
| **Thread** | Suas mensagens em cartões com borda, respostas em texto simples, resumos de ferramentas, cartões de alteração de arquivos e tarefas |
| **Compositor** | Seu rascunho, a pílula de modo (\`∞ Agent ⌄\`), o modelo e o esforço (\`Echo Preview Low ⌄\`), o anel de contexto (\`◔ N%\`) e o botão de enviar |
| **Rodapé** | Pasta, branch, \`This PC\`, modo de permissão, estado da execução e a linha \`5h limit · Weekly limit\` |

A sidebar aparece automaticamente a partir de 100 colunas. Com o prompt vazio, **←** esconde ou mostra a sidebar (em terminais mais estreitos, ← abre numa largura compacta).

## Mouse

Tudo no compositor é clicável:

- **↑** envia o rascunho; **■** para um agente em execução.
- **\`◔ N%\`** expande ou recolhe o detalhamento completo do contexto.
- **\`∞ Agent ⌄\`** abre o seletor de modo; **\`Echo Preview Low ⌄\`** abre modelos e esforço de raciocínio; **\`◈ Adaptive ⌄\`** no rodapé abre os modos de permissão.
- As linhas da sidebar abrem sessões, a lista Sessions e Settings; os atalhos da tela vazia executam sua ação.
- Os cartões de alteração de arquivo expandem pelo cabeçalho e abrem o visualizador de diff pelo corpo; o cabeçalho do painel de tarefas alterna a lista completa.

Clique em qualquer outro lugar, aperte uma tecla ou **Esc** para fechar um seletor.

## Teclado

| Tecla | Ação |
| --- | --- |
| **Enter** / **Shift+Enter** | Enviar (entra na fila enquanto o agente trabalha) / nova linha |
| **Esc** | Cancela a execução, ou o subagente que você está vendo |
| **Shift+Tab** | Alterna Agent → Plan → Ask → Parallel → Peak |
| **Tab** | Autocompleta \`/comandos\`, \`@caminhos\` e menções \`@session:\` |
| **←** com o prompt vazio | Mostra ou esconde a sidebar; de um subagente, volta ao chat principal |
| **↑ / ↓ / roda do mouse**, **PgUp / PgDn** | Rola o chat |
| **Ctrl+T** | Alterna a lista completa de tarefas |
| **Ctrl+W / Ctrl+S / Ctrl+Q** | New worktree / Sessions / Sair (na tela vazia) |

\`/keybindings\` mostra a lista completa; \`/vim\` passa o compositor para as teclas do Vim.

## Menções

Digite \`@\` para anexar um arquivo ou pasta, ou \`@session:<id>\` para anexar outra conversa do mesmo projeto como contexto.

## Modo headless

\`\`\`bash
faelith -p "Update the changelog for the last release" --mode agent
\`\`\`

\`-p\` roda uma consulta sem a interface, envia o texto para stdout e as linhas de ferramentas para stderr, e sai com \`0\` em caso de sucesso ou \`1\` em caso de erro. Usa o modo de permissão das suas configurações.
`,
  },
  'cli-features': {
    title: 'Advisor, Bugfinder, objetivos e mais',
    summary: 'Advisor, Bugfinder, SmartShift, objetivos, loops, worktrees, Autolearn e o sandbox.',
    body: `
## Advisor

\`/advisor\` dá ao agente uma segunda opinião somente leitura. Quando ligado, o modelo pode chamar um **Advisor** que lê arquivos e pesquisa na web antes de uma decisão. \`/advisor echo|horizon\` escolhe o modelo dele; \`/advisor on|off|status\` controla. No máximo cinco chamadas ao Advisor por consulta.

## Bugfinder

\`/bugfinder\` adiciona um inspetor pós-implementação (Horizon por padrão, sempre com raciocínio máximo, contexto de 1M). Depois que o agente implementa uma mudança, ele roda o Bugfinder, que pode ler, editar e executar comandos para achar e corrigir defeitos. \`/bugfinder on|off|status|echo|horizon\`.

## SmartShift

Ligado por padrão. Antes de cada prompt digitado, um juiz escolhe o melhor modo (Agent, Plan, Ask, Parallel ou Peak) e troca quando ele for diferente do atual; o modelo ainda pode trocar uma vez no meio do turno. \`/smartshift on|off|status\`.

## Objetivos e loops

- \`/goal <texto>\` mantém o agente trabalhando em um objetivo ao longo dos turnos até o host **verificar** a conclusão: os testes listados precisam ter passado em comandos que o host realmente executou, e os arquivos listados precisam existir. \`/goal status|resume|clear\`. Um prefixo como \`30m\` pausa o objetivo no prazo.
- \`/loop <prompt>\` reenvia um prompt depois de cada turno bem-sucedido até \`/loop stop\`. Esc pausa.

## Modelo dos subagentes

\`/subagent inherit|echo|horizon\` escolhe o modelo que os agentes aninhados usam quando o perfil deles não define um. Veja [Agentes](/docs/agents).

## Worktrees

\`/worktree\` cria um git worktree isolado em \`~/.faelith/worktrees/\` e move a sessão para ele; \`/worktree delete\` remove o atual. O modo Parallel dá a cada worker o próprio worktree automaticamente.

## Autolearn e memória

Depois de um turno que alterou arquivos, o **Autolearn** atualiza o \`FAELITH.md\` da raiz do projeto com o que aprendeu (comandos de build, convenções, armadilhas). \`/autolearn on|off|status\`. \`/memory\` lista todos os arquivos de memória carregados. Veja [Memória do projeto e regras](/docs/memory).

## Sandbox e segurança

O Bash roda dentro do sandbox do sistema operacional onde houver (bubblewrap no Linux, Seatbelt no macOS; use o WSL2 no Windows). Leituras de caminhos sensíveis como \`.env\` e \`~/.ssh\` são bloqueadas, e toda entrada e saída de ferramenta passa por uma varredura de segredos. \`/sandbox-toggle\` liga ou desliga o sandbox do Bash.

## Diffs e tarefas

Toda edição adiciona um cartão \`created\` / \`edited\` / \`deleted\` com \`+N -N\`. \`/diff\` alterna as visualizações lado a lado no chat, \`/diff <caminho>\` abre o visualizador em um arquivo, e \`R\` \`R\` ali reverte esse arquivo. O agente mantém uma lista de tarefas num painel fixo acima do compositor.
`,
  },
  skills: {
    title: 'Skills',
    summary: 'Instruções reutilizáveis em Markdown que o agente executa pelo nome ou automaticamente.',
    body: `
Uma **skill** é um conjunto reutilizável de instruções em um arquivo \`SKILL.md\`. Você a executa com \`/nome-da-skill\`, e quando uma skill combina com a tarefa o agente precisa invocá-la por conta própria antes de fazer o trabalho. Skills são só instruções: não adicionam ferramentas nem contornam permissões.

## Onde as skills ficam

| Escopo | Caminho |
| --- | --- |
| Projeto | \`.faelith/skills/<nome>/SKILL.md\` (a pasta atual e as pastas acima até a raiz do git) |
| Pessoal (todos os projetos) | \`~/.faelith/skills/<nome>/SKILL.md\` |
| Plugin | \`<plugin>/skills/<nome>/SKILL.md\` |
| MCP | Recursos em Markdown de um servidor viram \`mcp__<servidor>__<nome>\` |

Pastas de outras ferramentas (\`.claude/skills\`, \`.codex/skills\`) não são carregadas. Em caso de nomes repetidos vale a primeira encontrada: projeto, depois pessoal, depois plugin, depois embutida.

## Uma skill mínima

\`\`\`markdown
---
name: review-rust
description: Reviews Rust code for bugs, risks and missing tests.
when_to_use: Use when the task is a review of Rust code.
allowed-tools:
  - FileRead
  - Grep
---

# Rust review

1. Read the relevant files.
2. List concrete problems ordered by severity.
3. Point out behaviour without tests. Do not edit files.
\`\`\`

O frontmatter precisa ser a primeira coisa do arquivo, e o arquivo precisa se chamar exatamente \`SKILL.md\`.

## Campos do frontmatter

| Campo | Significado |
| --- | --- |
| \`name\`, \`description\`, \`when_to_use\` | Nome de invocação e o que o catálogo mostra |
| \`paths\` | Globs como \`src/**/*.rs\`; a skill só ativa depois que um arquivo correspondente é lido ou editado |
| \`user-invocable\` | \`false\` esconde de \`/\` (padrão \`true\`) |
| \`disable-model-invocation\` | \`true\` impede o agente de invocá-la automaticamente |
| \`allowed-tools\` | Ferramentas que a skill espera; restringe, nunca concede |
| \`context\`, \`agent\` | \`fork\` roda a skill num contexto de subagente separado, opcionalmente com um perfil como \`explore\` |
| \`model\`, \`effort\` | Troca o modelo (\`echo\`, \`horizon\`) e o raciocínio numa execução em fork |
| \`argument-hint\`, \`arguments\`, \`empty-args\` | Documentam e nomeiam argumentos |

## Argumentos

Use \`$ARGUMENTS\`, os posicionais \`$0\` / \`$1\`, ou nomeados como \`$file\` no corpo:

\`\`\`text
/review-rust file=src/lib.rs focus=errors
/review-rust src/lib.rs errors
\`\`\`

## Skills embutidas

O Faelith traz revisões (\`code-review\`, \`security-review\`, \`api-review\`, \`architecture-review\`, \`performance-review\`, \`database-review\` e outras), ajudantes de criação (\`create-skill\`, \`create-subagent\`, \`create-hook\`, \`create-rule\`), \`prompt-refiner\`, \`spec-to-plan\`, \`deslop\`, \`frontend-design\`, \`backend-design\` e fluxos de git (\`commit\`, \`push\`, \`open-pr\`, \`create-branch\`, \`create-branch-and-pr\`). As skills de git nunca fazem commit na \`main\` e nunca fazem force-push.

## Conferindo

\`/skills\` lista o que foi encontrado; \`/reload-plugins\` recarrega as skills depois de editá-las.
`,
  },
  agents: {
    title: 'Agentes',
    summary: 'Subagentes embutidos e seus próprios perfis especialistas em .faelith/agents.',
    body: `
O agente principal pode delegar trabalho a **subagentes**: execuções aninhadas com prompt, modo e lista de ferramentas próprios que devolvem um relatório. Clique na linha de um subagente (ou na entrada dele no painel de agentes) para ler a transcrição completa; **Esc** ali cancela só aquele worker.

## Tipos embutidos

| Tipo | Use para | Ferramentas |
| --- | --- | --- |
| \`generalPurpose\` | Implementação em várias etapas | Todas as ferramentas |
| \`explore\` | Pesquisa somente leitura em muitos arquivos | Leitura, busca, web, skills |
| \`shell\` | Builds, git e comandos verbosos | Bash, leitura e busca |
| fork | Continua o contexto atual em segundo plano | Herda do pai |

Subagentes nunca recebem a lista de tarefas, o Advisor ou o Bugfinder, e o aninhamento para na profundidade dois.

## Seu próprio perfil

Crie \`.faelith/agents/<nome>.md\` em um projeto, ou \`~/.faelith/agents/<nome>.md\` para todos os projetos:

\`\`\`markdown
---
name: rust-reviewer
description: Read-only Rust reviewer. Use when asked to review Rust changes.
mode: ask
allowed-tools:
  - FileRead
  - Grep
  - Glob
max-turns: 24
model: horizon
effort: high
---

You are a read-only Rust reviewer. Return findings ordered by severity.
\`\`\`

O corpo é o prompt de sistema do worker e não pode ficar vazio. Só arquivos diretamente dentro de \`agents/\` são carregados.

| Campo | Significado |
| --- | --- |
| \`mode\` | \`agent\` (padrão), \`ask\` ou \`plan\`. Um pai em Plan mantém o filho em Plan |
| \`allowed-tools\`, \`disallowed-tools\` | Restringem o conjunto de ferramentas; curingas como \`mcp__*\` funcionam. Nunca concedem permissão |
| \`max-turns\` | 1 a 1000; se omitido, sem limite |
| \`allow-nested-agent\` | Deixa este worker iniciar os próprios subagentes |
| \`background\` | Roda em segundo plano por padrão |
| \`model\`, \`effort\` | Modelo do worker (\`echo\`, \`horizon\`) e raciocínio |

## Comandos

\`/agents\` lista todos os perfis. \`/subagent inherit|echo|horizon\` define o modelo padrão dos subagentes. A skill embutida \`/create-subagent\` escreve um perfil para você.
`,
  },
  mcp: {
    title: 'Servidores MCP',
    summary: 'Conecte servidores do Model Context Protocol: ferramentas, recursos e prompts.',
    body: `
O Faelith fala o **Model Context Protocol**. As ferramentas de um servidor conectado aparecem como \`mcp__<servidor>__<ferramenta>\`, os recursos em Markdown como skills, e os prompts como comandos com barra (\`/mcp__github__pr_review\`).

## Configurar

\`.faelith/mcp.json\` em um projeto (ou \`mcpServers\` em \`~/.faelith/settings.json\` para todos os projetos):

\`\`\`json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "\${GITHUB_TOKEN}" }
    },
    "acme": {
      "type": "http",
      "url": "https://mcp.acme.example/mcp",
      "headers": { "Authorization": "Bearer \${ACME_MCP_TOKEN}" }
    }
  }
}
\`\`\`

As fontes são combinadas nesta ordem, a última vence: configurações do usuário → \`.faelith/mcp.json\` do projeto (ou \`.mcp.json\`) → \`.faelith/mcp.local.json\` → \`--mcp-config <arquivo>\`.

## Campos do servidor

| Campo | Significado |
| --- | --- |
| \`command\`, \`args\`, \`env\` | Servidor local via stdio; \`command\` é o executável, as flags vão em \`args\` |
| \`url\`, \`type\`, \`headers\` | Servidor remoto: \`http\` (Streamable HTTP, padrão), \`sse\` ou \`websocket\` |
| \`oauth\` | \`clientId\`, \`callbackPort\`, \`scopes\` para servidores com OAuth; os tokens ficam no cofre de credenciais do sistema |
| \`disabled\` | Mantém a entrada mas não inicia o servidor |

\`\${VAR}\` é expandido a partir do ambiente, então os tokens nunca precisam ficar no arquivo. Servidores remotos precisam usar HTTPS (HTTP simples só para \`localhost\`).

## Gerenciar

\`\`\`text
/mcp                     open the MCP panel
/mcp status              connection state and tool counts
/mcp list                every mcp__ tool
/mcp add <name> <command> [args...]
/mcp remove <name>
/mcp reconnect <name>
\`\`\`

## Confiança e segurança

Servidores definidos por um projeto ficam **bloqueados** até você confiar naquele workspace (concluindo o onboarding nele). As ferramentas MCP passam pelo mesmo controle de modo, motor de permissões e varredura de segredos das ferramentas embutidas, e os servidores locais rodam dentro do sandbox da sessão. Trate servidores com efeitos colaterais como ferramentas de escrita.
`,
  },
  plugins: {
    title: 'Plugins',
    summary: 'Empacote comandos com barra, agentes, skills, hooks e ferramentas juntos.',
    body: `
Um **plugin** reúne comandos com barra, perfis de agentes, skills, hooks e ferramentas próprias para serem compartilhados como um pacote só. Se você precisa de apenas um desses, use uma [skill](/docs/skills), um [agente](/docs/agents), um [hook](/docs/hooks) ou um [servidor MCP](/docs/mcp).

## Estrutura

\`\`\`text
my-plugin/
├── plugin.json          required
├── commands/review.md   → /my-plugin:review
├── agents/explorer.md   → plugin:my-plugin:explorer
├── skills/review/SKILL.md
├── hooks/hooks.json
└── runtime.mjs          only for custom tools or RPC hooks
\`\`\`

\`\`\`json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Review helpers.",
  "author": "Example Team"
}
\`\`\`

Chaves desconhecidas em \`plugin.json\` invalidam o plugin. Comandos são prompts em Markdown com o mesmo frontmatter e os mesmos marcadores \`$ARGUMENTS\` das skills; pastas aninhadas viram segmentos \`:\` (\`commands/security/deps.md\` → \`/my-plugin:security:deps\`). Ferramentas próprias são servidas pelo runtime via JSON-RPC e aparecem como \`plugin__<plugin>__<ferramenta>\`.

## Carregar e instalar

- **Desenvolvimento local:** \`faelith --plugin-dir ./my-plugin\` (pode repetir). Carregar uma pasta sem assinatura é uma decisão explícita de confiança.
- **Marketplace:** \`/plugin install @scope/plugin@1.0.0\`. Os pacotes precisam ser assinados (Ed25519) e são verificados antes da extração; pacotes sem assinatura ou com chave desconhecida são rejeitados. Os plugins instalados ficam em \`~/.faelith/plugins/cache\`.

## Comandos

\`\`\`text
/plugin list        installed plugins, versions and sources
/plugin diagnose    manifest, command and agent errors
/plugin trust       trusted signing keys
/reload-plugins     reload plugins and skills
\`\`\`

Ferramentas e hooks de plugins passam pelo mesmo motor de permissões, varredura de segredos e sandbox que todo o resto; um plugin nunca consegue dar permissões a si mesmo.
`,
  },
  hooks: {
    title: 'Hooks',
    summary: 'Scripts que permitem, bloqueiam ou reescrevem chamadas de ferramentas e prompts.',
    body: `
Um **hook** é um comando que o Faelith executa num ponto fixo de cada turno. Ele pode bloquear uma ferramenta, reescrever a entrada dela, bloquear um prompt ou adicionar contexto que o modelo vê.

## Eventos

| Evento | Quando |
| --- | --- |
| \`UserPromptSubmit\` | Antes de o seu prompt ser enviado |
| \`PreToolUse\` | Logo antes de uma ferramenta rodar (Bash, escrita de arquivos, \`mcp__\`, \`plugin__\` …) |
| \`PostToolUse\` | Depois que uma ferramenta retorna |
| \`Stop\` | Quando o turno principal termina |

## Configurar

\`.faelith/hooks.json\` em um projeto, ou a chave \`hooks\` em \`~/.faelith/settings.json\`:

\`\`\`json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "python .faelith/hooks/deny-rm.py", "timeout": 10 }]
      }
    ]
  }
}
\`\`\`

\`matcher\` é o nome de uma ferramenta, um prefixo como \`File*\`, ou \`*\` para todas. O hook recebe o evento como JSON no stdin e roda na pasta de trabalho da sessão. O tempo limite padrão é 30 segundos; estourar o tempo bloqueia a chamada.

## Resultados

| Resultado do hook | Efeito |
| --- | --- |
| Código de saída \`2\` | Bloqueia; o stderr aparece como motivo |
| Saída \`0\` com JSON | \`allow\`, \`reason\`, \`replacement_input\` (nova entrada da ferramenta), \`context_addition\` |
| Saída \`0\` com texto simples | O texto é adicionado como contexto |
| Qualquer outro código de saída | Não bloqueia; o modelo vê um aviso |

Uma entrada reescrita passa de novo pelas verificações de permissão, então hooks não conseguem contorná-las. Hooks de projeto só rodam depois que você confia no workspace; hooks do usuário sempre rodam. \`/hooks\` mostra o que está carregado.
`,
  },
  memory: {
    title: 'Memória do projeto e regras',
    summary: 'FAELITH.md, arquivos de regras e configurações que moldam cada sessão.',
    body: `
## Arquivos de memória

O Faelith lê estes arquivos da raiz do repositório até a pasta atual e os adiciona a toda sessão:

- \`FAELITH.md\`, \`AGENTS.md\` e \`CLAUDE.md\`
- \`.faelith/FAELITH.md\` e todo \`.faelith/rules/*.md\`
- \`FAELITH.local.md\` para anotações pessoais que você não versiona

Use-os para comandos de build e de teste, convenções e armadilhas. \`/init\` cria a pasta \`.faelith/\`, \`/memory\` lista o que está carregado, e o [Autolearn](/docs/cli-features#autolearn-e-memoria) mantém o \`FAELITH.md\` da raiz atualizado. A skill embutida \`/create-rule\` escreve um arquivo de regras para você.

## Arquivos de configuração

| Arquivo | Escopo |
| --- | --- |
| \`~/.faelith/settings.json\` | Você, nesta máquina |
| \`.faelith/settings.json\` | O projeto (versione) |
| \`.faelith/settings.local.json\` | Você, neste projeto (não versione) |
| \`--settings <arquivo>\` | Uma execução |

As camadas posteriores vencem. \`/settings\` abre um editor interativo das opções comuns. Algumas preferências (Advisor, Bugfinder, SmartShift) são só do usuário e não podem ser definidas por um projeto.

## Onde o Faelith guarda dados

| Caminho | Conteúdo |
| --- | --- |
| \`~/.faelith/sessions/\` | Transcrições das sessões (\`/sessions\`, \`/export\`) |
| \`~/.faelith/worktrees/\` | Worktrees do \`/worktree\` e do modo Parallel |
| \`~/.faelith/skills\`, \`~/.faelith/agents\` | Skills e agentes pessoais |
| \`~/.faelith/plugins/cache\` | Plugins instalados |

As chaves de API ficam no cofre de credenciais do sistema (Gerenciador de Credenciais do Windows, Keychain do macOS, Secret Service no Linux) e só vão para o \`settings.json\` quando nenhum estiver disponível.
`,
  },
  'desktop-app': {
    title: 'App desktop',
    summary: 'Faelith para macOS, Windows e Linux: Chat, Code, aba Plan e sessões em vários painéis.',
    body: `
O app desktop reúne o Chat e o Code em uma janela, com o mesmo login da CLI. Baixe na página de [Download](/download); há instaladores para macOS (Apple Silicon e Intel), Windows (\`.msi\` e setup \`.exe\`) e Linux (\`.AppImage\`, \`.deb\`, \`.rpm\`).

## Primeira execução

A tela inicial oferece **Continuar no navegador** (device flow) ou **Colar uma chave de API**. **Sair** volta para esta tela; o app não funciona sem uma chave válida, de propósito.

## Chat

Um assistente geral com pesquisa na web, leitura de páginas, anexos de imagens e arquivos, chats temporários e conversas que podem ser duplicadas. Esforço e modelo são escolhidos por conversa.

## Code

Cada painel Code é uma sessão completa do agente ligada a um workspace:

- **Changed**: o diff de cada arquivo alterado nesta sessão, com reversão por arquivo.
- **Plan**: aparece no modo Plan; plano renderizado, comentários no texto, **Build** e **Build in parallel**.
- **Files** e **Terminal**: navegue pelo workspace e rode comandos.

## Sessões em vários painéis

Arraste **New session** para a área de trabalho para dividir a visualização em até **quatro** painéis. Cada painel escolhe o próprio workspace (até de outro projeto), tem modelo, modo e permissão próprios e faz streaming de forma independente. A sidebar e o painel da direita acompanham o painel em foco.

## Subagentes

Quando o agente delega trabalho, a linha mostra um indicador de **subagente**. Clique para abrir a transcrição completa do subagente numa janela.

## Sidebar e anexos

Projects e Recents listam suas sessões (o Chat mostra as conversas). Clique com o botão direito num projeto para **Remover da sidebar**; ele volta quando tiver atividade nova. Arraste qualquer conversa da sidebar para o compositor para anexar a transcrição dela como contexto.

## Limites e uso

A linha abaixo do compositor mostra seu uso de **5h** e **semanal**, no Chat e no Code. **Settings → Plan & Usage** mostra os medidores, a cobrança por uso e os resets de uso.

## Configurações

Padrões de modelo, raciocínio por família, modo de permissão padrão, servidores MCP e aparência ficam em **Settings**. As configurações do projeto em \`.faelith/settings.json\` têm prioridade. Skills, agentes, hooks e plugins funcionam exatamente como na CLI; veja **Personalizar**.
`,
  },
  'web-chat': {
    title: 'Chat na web',
    summary: 'Faelith Chat no navegador, sincronizado com a conta do painel.',
    body: `
O **Chat** do painel é o mesmo Faelith Chat do app desktop, servido pelo site com a sua sessão aberta.

## O que é compartilhado

- Os mesmos modelos, níveis de raciocínio e ferramentas (pesquisa na web e leitura de páginas; sem ferramentas de repositório).
- Os mesmos recursos de conversa: streaming com linhas de raciocínio, linhas de ferramentas, blocos de código com cópia, anexos, chats temporários e duplicação.
- Os mesmos medidores do **Chat**. Uma conversa na web debita os medidores de 5 horas e semanal do Chat exatamente como o app, e a linha abaixo do compositor mostra os dois.

## Como se autentica

Entrar no site basta. Nos bastidores, o site emite uma chave com finalidade \`chat\` para a sua conta no primeiro uso e a guarda criptografada; você nunca a vê nem gerencia, e revogá-la em **Chaves de API** só faz uma nova ser emitida na próxima vez.

## Conversas

As conversas ficam guardadas no servidor, então uma conversa iniciada no navegador fica disponível em qualquer navegador com a sua conta aberta. As conversas do desktop ficam no dispositivo que as criou.

Clique com o botão direito numa conversa para **Duplicar** ou **Excluir**. Chats temporários são removidos quando você sai deles e nunca aparecem na lista.
`,
  },
  'data-handling': {
    title: 'Tratamento de dados',
    summary: 'Inferência ZDR e captura completa e criptografada do I/O dos modelos pelo Faelith.',
    body: `
O Faelith usa inferência com **zero retenção de dados (ZDR)** para toda chave de API. Toda chave segue uma única política de tratamento de dados e a mesma tabela de preços.

## Captura do Faelith

O Faelith guarda um registro completo e criptografado por **90 dias** em S3 sob controle do Faelith. A captura contém o corpo exato lido pelo modelo e tudo o que ele escreve, além da transcrição completa enviada com a requisição. Isso inclui mensagens de sistema, desenvolvedor, usuário, assistente e ferramentas; saída de raciocínio; chamadas de ferramentas; leituras e escritas de arquivos; resultados de grep/busca; resultados de ferramentas; novas tentativas; e saída em streaming. As capturas recebem criptografia de envelope antes de serem guardadas e não são reduzidas nem truncadas.

ZDR descreve o caminho da inferência. A captura operacional criptografada do próprio Faelith é separada da retenção de inferência no provedor.

## Dados que você sempre controla

- **Dados da conta** (e-mail, nome, cobrança) ficam guardados enquanto a conta existir, como exigido para prestar o serviço e cumprir a lei tributária.
- **Eventos de uso** (tokens, custo, horários) ficam guardados como histórico de cobrança; eles não contêm o conteúdo dos prompts.
- **Conversas do Chat na web** ficam guardadas até você apagá-las, porque são o seu histórico salvo. A captura criptografada de 90 dias do I/O dos modelos é um registro operacional separado.

## Base regulatória

O Faelith trata dados de acordo com o GDPR e a LGPD do Brasil. Pedidos de acesso, correção ou exclusão passam por **Configurações → Excluir conta** (que também apaga as suas capturas criptografadas) ou pelo [contato](/contact). Veja os [Termos](/terms) para os detalhes legais.
`,
  },
  'plans-and-usage': {
    title: 'Uso',
    summary: 'Medidores contínuos, a carteira pré-paga, a cobrança por uso e os resets.',
    body: `
## Como os medidores funcionam

O medidor de **5 horas** é uma janela contínua, e o medidor **semanal** zera sete dias depois do primeiro uso. As requisições falham com \`402 plan_limit_reached\` quando um dos dois enche; a página **Uso** do painel, a linha abaixo de todo compositor e \`/usage\` mostram os dois.

## Carteira pré-paga

Chaves com finalidade \`api\` debitam a carteira pelo preço de tabela. Recarregue em **Gastos** com um pacote de US$ 10, US$ 50 ou US$ 100 ou qualquer valor a partir de US$ 5. A tabela **Eventos de uso** lista cada requisição com seus tokens e valor: **Incluído** quando o seu plano cobriu, o valor debitado quando os créditos pagaram.

## Cobrança por uso

Ative em **Gastos** (ou \`/credits on\`) e o Code ou o Chat continuam pela carteira quando um medidor acaba, em vez de parar. Desative quando quiser. As faturas pagas aparecem em **Cobrança e faturas**.

## Resets de uso

Um reset zera os seus medidores contínuos na hora. Os planos anuais incluem resets; é possível comprar mais. Resgate em **Uso** no painel, com \`/usage-reset\` na CLI, ou via \`POST /v1/billing/usage-reset/redeem\`.
`,
  },
  security: {
    title: 'Segurança da conta',
    summary: 'Verificação de e-mail, autenticação em dois fatores, confirmações e recuperação.',
    body: `
## Cadastro

Contas novas confirmam o e-mail com um código de 6 dígitos antes de a conta ser criada. Você também pode entrar com GitHub ou Google; só são aceitos e-mails verificados pelo provedor, e um provedor nunca é vinculado automaticamente a uma conta que tem senha: entre com a senha e vincule em **Configurações**.

## Autenticação em dois fatores

Ative em **Configurações → Segurança**. A partir daí, todo login, inclusive por GitHub e Google, pede um segundo fator:

- **App autenticador**: escaneie o QR code com qualquer app TOTP.
- **Código por e-mail**: um código de 6 dígitos enviado para a sua caixa de entrada.
- **Códigos de backup**: 12 códigos de uso único mostrados uma vez quando você ativa o 2FA. Guarde-os em lugar seguro; você pode gerar novos.

Com um app autenticador ativado, um código por e-mail não é aceito para alterar ou desativar os seus fatores.

## Confirmação de ações sensíveis

Criar chaves de API, trocar a senha, desvincular um provedor, ativar a cobrança por uso, aprovar um login por dispositivo e excluir a conta pedem que você confirme que é você (um código 2FA, ou a senha quando o 2FA está desligado). Você recebe um e-mail sempre que uma dessas ações acontece.

## Logins por dispositivo

Quando a CLI ou o app desktop entram pelo navegador, a página de aprovação mostra o endereço IP, o cliente e o horário da requisição. Aprove apenas se foi você quem iniciou.

## Esqueceu a senha

Use **Esqueceu a senha?** na página de login. O link funciona uma vez, expira em 30 minutos e encerra todas as sessões; a autenticação em dois fatores continua valendo no próximo login.

## Excluir a conta

**Configurações → Excluir conta** revoga todas as chaves de API, cancela a sua assinatura e remove os seus dados, incluindo a captura criptografada do I/O dos modelos.
`,
  },
};
