/**
 * @fileoverview Documentação em português europeu (tradução de docs/content.ts).
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
 * - European Portuguese vocabulary (ficheiro, ecrã, utilizador, palavra-passe, definições)
 * - Keep in sync with docs/content.ts when the English pages change
 */

import type { DocGroup, DocTranslation } from './content';

export const DOC_GROUP_LABELS_PT: Record<DocGroup, string> = {
  'Get started': 'Começar',
  Models: 'Modelos',
  API: 'API',
  CLI: 'CLI',
  Customize: 'Personalizar',
  'Desktop and Web': 'Desktop e Web',
  Account: 'Conta',
};

export const DOC_PAGES_PT: Record<string, DocTranslation> = {
  overview: {
    title: 'Visão geral',
    summary: 'O que é o Faelith, que ferramentas existem e como partilham uma conta.',
    body: `
O Faelith é uma plataforma de programação com agentes, construída em torno de duas famílias de modelos, **Echo** e **Horizon**, e quatro ferramentas que partilham uma conta, um conjunto de chaves e um orçamento de utilização:

| Ferramenta | O que é | Onde |
| --- | --- | --- |
| **Code** | O agente de programação: lê, edita e testa o seu repositório | CLI e aplicação desktop |
| **Chat** | Um assistente geral com pesquisa na web e anexos de ficheiros | Aplicação desktop e este site |
| **CLI** | \`faelith\`, um único binário estático para macOS, Linux, WSL e Windows | [Transferir](/download) |
| **API** | Gateway HTTP compatível com OpenAI para o seu próprio software | O URL do gateway mostrado em **Chaves de API** |

## Como as peças encaixam

- **Conta**: criada neste site. Guarda o seu plano, a sua carteira e as suas chaves.
- **Chaves**: emitidas por finalidade (\`code\`, \`chat\`, \`api\`). Veja [Autenticação](/docs/authentication).
- **Planos**: uma subscrição desbloqueia medidores contínuos de 5 horas e semanal para Code e Chat. A API é pré-paga e debita da carteira. Veja [Utilização](/docs/plans-and-usage).
- **Modelos**: \`echo\` e \`horizon\` (contexto de 256k) e \`echo1m\` e \`horizon1m\` (contexto de 1M). Veja [Echo e Horizon](/docs/models).

## Por onde seguir

1. [Início rápido](/docs/quickstart): instale a CLI ou a aplicação e execute a primeira tarefa em dois minutos.
2. [Chat Completions](/docs/chat-completions): chame a API a partir do seu código.
3. [Skills](/docs/skills), [Agentes](/docs/agents), [Servidores MCP](/docs/mcp) e [Plugins](/docs/plugins): estenda o agente.
4. [Tratamento de dados](/docs/data-handling): inferência ZDR e a captura cifrada do Faelith no S3.
`,
  },
  quickstart: {
    title: 'Início rápido',
    summary: 'Instale, inicie sessão e atribua a primeira tarefa ao Faelith.',
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

Prefere uma janela? Obtenha a aplicação desktop para macOS, Windows ou Linux na página [Transferir](/download). Inclui o Chat e o Code com o mesmo início de sessão.

## 2. Inicie sessão

Execute \`faelith\` dentro de um repositório. O assistente inicial oferece duas formas de entrar:

- **Início de sessão no navegador (device flow)**: a CLI mostra um código curto, abre \`faelithindustries.com/cli/login\` e aprova-o com a sua conta aberta. A CLI recebe automaticamente uma chave com âmbito.
- **Colar uma chave de API**: crie uma em **Painel → Chaves de API** e cole-a. Use a finalidade \`code\` para a CLI e a aplicação.

\`/logout\` termina a sessão e volta a este ecrã.

As mesmas duas opções aparecem no primeiro ecrã da aplicação desktop.

## 3. Execute uma tarefa

\`\`\`text
> Add a --json flag to the export command and cover it with a test.
\`\`\`

O Code lê os ficheiros relevantes, propõe edições, corre os testes e mostra um diff. Aprove, refine, ou peça primeiro um plano com \`/plan\`.

## 4. Escolha um modelo e um esforço

\`\`\`text
/model horizon
/thinking high
\`\`\`

Ou clique nos seletores de modelo e de modo no compositor. O Echo é rápido e equilibrado; o Horizon raciocina mais a fundo. Veja [Echo e Horizon](/docs/models).

## Próximos passos

- [A interface da CLI](/docs/cli-interface): barra lateral, compositor, rato e teclado.
- [Modos e permissões](/docs/cli-modes): Agent, Ask, Plan, Parallel e Peak.
- [Comandos com barra](/docs/cli-commands): a referência completa.
- [Aplicação desktop](/docs/desktop-app): sessões em vários painéis e o separador Plan.
`,
  },
  authentication: {
    title: 'Autenticação',
    summary: 'Chaves de API, finalidades das chaves, início de sessão por dispositivo e como cada ferramenta se autentica.',
    body: `
Todos os pedidos ao Faelith são autenticados com uma **chave de API bearer**. As chaves são criadas em **Painel → Chaves de API** e mostradas uma única vez na criação; guarde-as num gestor de segredos.

\`\`\`http
Authorization: Bearer sk-fae_...
\`\`\`

## Finalidades das chaves

Cada chave tem uma finalidade. A finalidade decide que medidor o pedido debita e que ferramentas o aceitam.

| Finalidade | Aceite por | Debita |
| --- | --- | --- |
| \`code\` | CLI, Code no desktop | Medidores de 5 horas / semanal do Code |
| \`chat\` | Chat no desktop, Chat na web | Medidores de 5 horas / semanal do Chat |
| \`api\` | \`/v1/*\` a partir do seu software | Carteira pré-paga ao preço de tabela |

Uma chave nunca muda de finalidade: uma chave \`chat\` não controla o Code, e uma chave \`api\` é a única que chega à sua carteira.

## Tratamento de dados

Todas as chaves usam o mesmo caminho de inferência **ZDR**. Separadamente, o Faelith guarda o I/O completo dos modelos e a transcrição completa do chat, cifrados, no seu próprio S3 durante 90 dias. Veja [Tratamento de dados](/docs/data-handling).

## Início de sessão por dispositivo

A CLI e a aplicação desktop conseguem iniciar sessão sem copiar uma chave:

1. O cliente chama \`POST /api/cli/device\` e recebe um \`device_code\` e um \`user_code\` curto.
2. Abre \`https://faelithindustries.com/cli/login\` com a sessão iniciada, introduz o código e aprova.
3. O cliente consulta \`POST /api/cli/device/poll\` até receber uma chave com finalidade \`code\`.

Os códigos duram pouco. Aprovar um código que não pediu é a única forma de divulgar uma chave, por isso a página pede-lhe que introduza o código e mostra o IP, o cliente e a hora do pedido; aprovar também lhe pede que confirme que é você e envia-lhe um e-mail. Veja [Segurança da conta](/docs/security).

## Terminar sessão

\`/logout\` na CLI ou **Terminar sessão** na aplicação apaga as chaves guardadas localmente e volta ao ecrã de início de sessão. Revogue a própria chave em **Chaves de API** se perder a máquina.
`,
  },
  models: {
    title: 'Echo e Horizon',
    summary: 'IDs dos modelos, janelas de contexto, níveis de raciocínio e como escolher.',
    body: `
O Faelith disponibiliza duas famílias de modelos. Ambas existem com janela de contexto de **256k** e com um alias de **1M**, ambas aceitam texto e imagens, e ambas fazem streaming.

| ID do modelo | Família | Contexto | Ideal para |
| --- | --- | --- | --- |
| \`echo\` | Echo | 256k | Edições rápidas, chat, tarefas do dia a dia |
| \`echo1m\` | Echo | 1M | Contexto do repositório inteiro à velocidade do Echo |
| \`horizon\` | Horizon | 256k | Raciocínio em várias etapas, depuração difícil, design |
| \`horizon1m\` | Horizon | 1M | Investigações longas em bases de código grandes |

Os aliases 1M custam **1,25×** os equivalentes de 256k. Os preços estão na página de [Modelos](/models).

## Níveis de raciocínio

Ambas as famílias suportam raciocínio alargado. O nível controla quanto do orçamento o modelo pode gastar antes de responder:

| Nível | Comportamento |
| --- | --- |
| \`off\` | Sem raciocínio alargado; mais rápido |
| \`low\` | Raciocínio leve para tarefas simples (predefinição do Echo) |
| \`medium\` | Salta o raciocínio em perguntas simples |
| \`high\` | Raciocínio profundo para tarefas complexas (predefinição do Horizon) |
| \`xhigh\` | Pensa sempre a fundo |
| \`max\` | Profundidade máxima; mais lento |

Defina-o com \`/thinking <nível>\` na CLI, no seletor de medidor da aplicação ou no campo \`reasoning_effort\` da API.

## Origem dos modelos

O Echo e o Horizon são pós-treinados pelo Faelith sobre os modelos base de pesos abertos **DeepSeek V4 Flash** e **DeepSeek V4 Pro**, respetivamente, e servidos na infraestrutura do Faelith com prompts, ferramentas e camadas de segurança do Faelith. Comportamento, preço e tratamento de dados são do Faelith; novas versões dos modelos base não alteram um ID de modelo sem o seu conhecimento.
`,
  },
  'chat-completions': {
    title: 'Chat Completions',
    summary: 'POST /v1/chat/completions: corpo do pedido, streaming, ferramentas e imagens.',
    body: `
O gateway fala o protocolo chat-completions da OpenAI, por isso a maioria dos SDKs funciona alterando apenas o base URL.

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

## Pedido

| Campo | Tipo | Notas |
| --- | --- | --- |
| \`model\` | string | \`echo\`, \`echo1m\`, \`horizon\`, \`horizon1m\` |
| \`messages\` | array | Papéis \`system\`, \`user\`, \`assistant\`, \`tool\`; o conteúdo pode ser uma string ou um array de partes \`text\` / \`image_url\` |
| \`stream\` | boolean | Server-sent events com frames \`data:\` que terminam em \`[DONE]\` |
| \`tools\` / \`tool_choice\` | array / string | Formato de function calling da OpenAI |
| \`reasoning_effort\` | string | Nível de raciocínio; veja [Echo e Horizon](/docs/models) |
| \`max_tokens\`, \`temperature\`, \`top_p\`, \`stop\` | — | Controlos de amostragem habituais |

## Resposta

As respostas sem streaming devolvem um objeto \`chat.completion\` com \`choices[0].message\` e um bloco \`usage\`:

\`\`\`json
{
  "usage": {
    "prompt_tokens": 1231,
    "completion_tokens": 212,
    "prompt_tokens_details": { "cached_tokens": 1024 }
  }
}
\`\`\`

Os tokens de prompt em cache são cobrados ao preço de cache read. As respostas com streaming emitem objetos \`chat.completion.chunk\`; o raciocínio chega em \`delta.reasoning_content\` antes de \`delta.content\`.

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

- O corpo do pedido tem um tamanho máximo no gateway (\`413\` quando excedido); mantenha as imagens base64 pequenas e prefira várias mensagens a um prompt gigante.
- Orçamentos, e não limites de taxa, são o motivo mais comum de falha: um \`402\` significa que um medidor ou a carteira se esgotou. Veja [Erros](/docs/errors).
`,
  },
  'account-endpoints': {
    title: 'Modelos, conta e utilização',
    summary: 'GET /v1/models, /v1/account, /v1/usage e os endpoints de faturação.',
    body: `
Estes endpoints permitem ao seu software inspecionar a chave que está a usar. Todos aceitam a mesma chave bearer das chat completions.

## GET /v1/models

Lista os modelos que a chave pode chamar, no formato \`list\` da OpenAI.

\`\`\`json
{ "object": "list", "data": [ { "id": "echo", "object": "model", "owned_by": "faelith" }, ... ] }
\`\`\`

## GET /v1/account

Devolve a conta por trás da chave: nome apresentado, e-mail e plano ativo.

## GET /v1/usage

Devolve os medidores contínuos da finalidade da chave. Cada medidor tem \`used\`, \`limit\`, \`remaining\` e \`exhausted\`, em micro-dólares de débito ao preço de tabela.

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

\`{ "enabled": true }\` permite ao Code e ao Chat continuarem pela carteira pré-paga quando um medidor se esgota. Equivale à opção em **Faturação**.

## POST /v1/billing/usage-reset/redeem

Consome a reposição de utilização não usada mais antiga e põe os medidores contínuos a zero de imediato. Devolve o novo retrato de utilização. As reposições vêm com os planos anuais e são vendidas no painel.
`,
  },
  errors: {
    title: 'Erros e limites de taxa',
    summary: 'Códigos de estado, corpos de erro e como medidores e carteira geram 402.',
    body: `
Os erros usam o envelope de erro da OpenAI: um \`error.code\` estável para tratar, uma categoria \`error.type\`, uma mensagem legível \`error.message\` e \`error.param\` a indicar a janela do medidor esgotada quando aplicável.

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

## Códigos de estado

| Estado | Código | Tipo | Significado |
| --- | --- | --- | --- |
| 400 | \`invalid_request\` | \`invalid_request_error\` | Corpo malformado, campo desconhecido, parte de conteúdo não suportada |
| 400 | \`model_not_found\` | \`invalid_request_error\` | ID de modelo desconhecido, ou modelo que esta chave não pode usar |
| 400 | \`extraction_blocked\` | \`invalid_request_error\` | O pedido foi classificado como tentativa de extrair prompts de sistema ou pesos |
| 401 | \`invalid_api_key\` | \`authentication_error\` | Chave em falta, malformada ou revogada |
| 402 | \`plan_limit_reached\` | \`insufficient_quota\` | Um medidor contínuo está cheio; \`param\` é \`5h\` ou \`weekly\` |
| 402 | \`insufficient_quota\` | \`insufficient_quota\` | A carteira pré-paga está vazia (chaves de API, ou Code/Chat por utilização) |
| 429 | \`rate_limit_exceeded\` | \`rate_limit_error\` | Demasiados pedidos em simultâneo numa chave; aguarde e tente novamente |
| 500 | \`internal_error\` | \`api_error\` | Tente novamente com espera; inclua o ID do pedido ao contactar o suporte |
| 502 | \`upstream_error\` | \`api_error\` | A frota de modelos devolveu um erro; pode tentar novamente |
| 503 | \`cluster_at_capacity\` | \`api_error\` | Frota no limite de capacidade; tente novamente daqui a pouco |
| 503 | \`capture_unavailable\` | \`api_error\` | O armazenamento obrigatório da captura cifrada está temporariamente indisponível |

## Cabeçalhos de medidor

Todas as respostas, incluindo as de erro, trazem os medidores atuais para que os clientes mostrem o orçamento sem outra chamada:

\`\`\`http
x-faelith-plan: pro
x-faelith-code-5h-used: 1210000
x-faelith-code-5h-limit: 3730000
x-faelith-code-weekly-used: ...
\`\`\`

Os valores são micro-dólares de débito ao preço de tabela.

## Orçamentos versus limitação

Um **402** significa que um orçamento se esgotou e não se resolve tentando novamente:

- **Chaves de subscrição** atingem primeiro o medidor de 5 horas, depois o semanal. Aguarde pela janela ou resgate uma reposição de utilização.
- **Chaves de API** debitam a carteira ao preço de tabela. Carregue em **Gastos**.
- Ativar a **faturação por utilização** faz as chaves de subscrição passarem para a carteira em vez de falharem.

Um **429** é o único sinal de limitação, aplica-se por chave e é de curta duração.

## Idempotência

As chat completions não são idempotentes. Se um stream cair a meio da resposta, paga pelos tokens gerados até esse ponto; reenvie com a mensagem parcial do assistente anexada se quiser continuar em vez de recomeçar.
`,
  },
  'cli-commands': {
    title: 'Comandos com barra',
    summary: 'Todos os /comandos incorporados da CLI e da aplicação desktop do Faelith.',
    body: `
Escreva \`/\` no compositor para abrir o seletor de comandos. Os mesmos comandos funcionam na CLI e nos painéis Code da aplicação desktop.

## Sessão

| Comando | O que faz |
| --- | --- |
| \`/help\` | Lista comandos, skills e plugins |
| \`/clear\` | Começa uma conversa nova e limpa a lista de tarefas |
| \`/compact\` | Resume a conversa para libertar contexto |
| \`/sessions\` (\`/resume\`) | Reabre uma sessão anterior deste workspace |
| \`/rename\` | Muda o nome da sessão atual |
| \`/rewind\` | Restaura ficheiros e conversa para um checkpoint anterior |
| \`/export\` | Grava a transcrição em Markdown |
| \`/copy\` | Copia a última mensagem do assistente |
| \`/status\`, \`/stats\`, \`/cost\`, \`/token-usage\` | Estado da sessão, estatísticas, estimativa de custo e orçamento de tokens |
| \`/exit\` | Sai da CLI |

## Modelo e comportamento

| Comando | O que faz |
| --- | --- |
| \`/model [id]\` | Mostra ou troca o modelo (\`echo\`, \`horizon\`, \`echo1m\`, \`horizon1m\`) |
| \`/thinking [nível]\` | Mostra ou define o nível de raciocínio |
| \`/mode\`, \`/ask\`, \`/plan\`, \`/parallel\`, \`/peak\` | Troca o modo de interação; veja [Modos e permissões](/docs/cli-modes) |
| \`/goal <texto>\`, \`/loop <prompt>\` | Trabalha até um objetivo verificado pelo host ser cumprido; repete um prompt a cada turno |
| \`/tasks\` | Mostra a lista de tarefas atual |
| \`/advisor\`, \`/bugfinder\`, \`/smartshift\` | Segunda opinião, inspetor pós-implementação, encaminhamento automático de modo |
| \`/subagent inherit\|echo\|horizon\` | Modelo predefinido dos subagentes |
| \`/permissions [modo]\` | Mostra ou define o modo de permissão |
| \`/review\` | Revê as alterações atuais |

Veja [Advisor, Bugfinder, objetivos e mais](/docs/cli-features).

## Workspace e ferramentas

| Comando | O que faz |
| --- | --- |
| \`/init\` | Cria a pasta \`.faelith/\` do projeto |
| \`/add-dir <caminho>\` | Dá ao agente acesso a outra pasta |
| \`/files\`, \`/diff\` | Lista os ficheiros do projeto; alterna diffs lado a lado ou abre o diff de um ficheiro |
| \`/worktree\`, \`/branch\` | Cria (ou elimina) um git worktree; cria um branch da sessão |
| \`/mcp\` | Gere [servidores MCP](/docs/mcp) |
| \`/skills\`, \`/agents\`, \`/hooks\`, \`/memory\` | Lista [skills](/docs/skills), [agentes](/docs/agents), [hooks](/docs/hooks) e [ficheiros de memória](/docs/memory) |
| \`/plugin\`, \`/reload-plugins\` | Gere e recarrega [plugins](/docs/plugins) e skills |
| \`/autolearn\` | Aprendizagem automática do \`FAELITH.md\` |
| \`/toolcalls\` | Linhas de ferramentas minimizadas ou completas |
| \`/sandbox-toggle\` | Sandbox do Bash ligado ou desligado |
| \`/scan\` | Diagnóstico do sistema |
| \`/vim\`, \`/keybindings\` | Teclas do Vim; lista todos os atalhos |
| \`/theme\` | Escuro ou claro |
| \`/settings\` | Abre as definições interativas |

## Conta

| Comando | O que faz |
| --- | --- |
| \`/login\`, \`/subscription\` | Inicia sessão pelo navegador (device flow), ou cola uma chave com \`/login <chave>\` |
| \`/apikey\` | Guarda uma chave de API do Faelith |
| \`/logout\` | Termina a sessão e volta ao ecrã de início de sessão |
| \`/usage\`, \`/limits\` | Medidores de 5 horas e semanal; mostra ou oculta a linha de limites sob o compositor |
| \`/credits on\|off\` | Continua com créditos pré-pagos quando um medidor enche |
| \`/usage-reset\` | Lista ou resgata uma reposição de utilização |
| \`/upgrade\` | Verifica se há uma nova versão da CLI |
| \`/version\`, \`/changelog\` (\`/release-notes\`) | Versão e notas de versão |

Skills, comandos de plugins e prompts MCP acrescentam os seus próprios comandos \`/\`.
`,
  },
  'cli-modes': {
    title: 'Modos e permissões',
    summary: 'Agent, Ask, Plan, Parallel e Peak, e como são concedidas as permissões de ferramentas.',
    body: `
## Modos de interação

| Modo | Comportamento |
| --- | --- |
| **Agent** | Predefinido. Lê, edita e executa comandos, pedindo permissão onde as suas definições o exigem |
| **Ask** | Responde e explica; nunca edita nem executa nada |
| **Plan** | Produz um plano em Markdown que termina numa checklist \`## To-dos\`. Nada é executado até mandar construir |
| **Parallel** | Um coordenador divide o trabalho em lotes de subagentes, cada um no seu próprio git worktree |
| **Peak** | Peak-of-N: N implementações completas e isoladas da mesma tarefa (predefinição 4, de 2 a 8), e o coordenador escolhe a melhor |

Troque com **Shift+Tab**, o seletor de modo no compositor, \`/mode\`, ou \`/ask\`, \`/plan\`, \`/parallel\`, \`/peak\`. Com o [SmartShift](/docs/cli-features#smartshift) ligado, o Faelith pode escolher o modo por si.

## Planear, depois construir

No modo Plan o agente só lê e grava o plano em \`.faelith/plans/\`. A CLI abre uma revisão do plano onde o pode refinar e escolher como executar (Agent, Parallel ou Peak, permissão e modelo); a aplicação desktop mostra-o no separador **Plan**. Selecione excertos para comentar e refinar, depois carregue em **Build** (Agent) ou **Build in parallel** (Parallel). As tarefas só são criadas quando constrói, por isso um plano nunca deixa tarefas a meio.

## Permissões

Os modos de permissão são independentes dos modos de interação. Altere-os no chip \`◈\` sob o compositor, \`/permissions <modo>\` ou **Definições**; os ajustes por projeto ficam em \`.faelith/settings.json\`:

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
| \`adaptive\` | Predefinido. Um classificador auxiliar aprova ações rotineiras e reversíveis e pede confirmação nas arriscadas |
| \`standard\` | Pede confirmação para cada edição e comando que não esteja numa regra de permissão |
| \`autoAccept\` | Aprova automaticamente edições de ficheiros; os comandos continuam a pedir confirmação |
| \`fullAccess\` | Executa tudo sem perguntar; apenas para ambientes descartáveis |
| \`survey\` | Relata o que faria e pergunta antes de cada ferramenta |
| \`silentDeny\` | Recusa tudo o que não estiver explicitamente permitido, sem perguntar |

Os subagentes correm sempre em \`adaptive\`. Na aplicação desktop o modo predefinido aplica-se ao **painel em foco**, por isso um painel cauteloso e um painel autónomo podem correr lado a lado.

## Checkpoints e rewind

Cada edição gera um checkpoint. \`/rewind\` (ou o botão de recuar numa mensagem) restaura ficheiros e conversa até esse ponto.
`,
  },
  'cli-interface': {
    title: 'A interface da CLI',
    summary: 'Barra lateral, compositor, seletores, rato e teclado na interface de terminal do Faelith Code.',
    body: `
Execute \`faelith\` num repositório para abrir a interface em ecrã inteiro. Tem o mesmo layout da aplicação desktop, desenhado no terminal.

## Layout

| Área | O que mostra |
| --- | --- |
| **Barra lateral** | Seletor de produto, **New worktree**, **Sessions**, **Settings**, a árvore **Projects** (este workspace e as suas sessões), **Recents**, e a sua conta e o seu plano no fundo |
| **Barra superior** | O título da sessão e uma pílula com a pasta do workspace; \`◌\` enquanto o agente trabalha |
| **Conversa** | As suas mensagens em cartões com contorno, respostas em texto simples, resumos de ferramentas, cartões de alteração de ficheiros e tarefas |
| **Compositor** | O seu rascunho, a pílula de modo (\`∞ Agent ⌄\`), o modelo e o esforço (\`Echo Preview Low ⌄\`), o anel de contexto (\`◔ N%\`) e o botão de enviar |
| **Rodapé** | Pasta, branch, \`This PC\`, modo de permissão, estado da execução e a linha \`5h limit · Weekly limit\` |

A barra lateral aparece automaticamente a partir de 100 colunas. Com o prompt vazio, **←** esconde ou mostra a barra lateral (em terminais mais estreitos, ← abre-a numa largura compacta).

## Rato

Tudo no compositor é clicável:

- **↑** envia o rascunho; **■** para um agente em execução.
- **\`◔ N%\`** expande ou recolhe o detalhe completo do contexto.
- **\`∞ Agent ⌄\`** abre o seletor de modo; **\`Echo Preview Low ⌄\`** abre modelos e esforço de raciocínio; **\`◈ Adaptive ⌄\`** no rodapé abre os modos de permissão.
- As linhas da barra lateral abrem sessões, a lista Sessions e Settings; os atalhos do ecrã vazio executam a sua ação.
- Os cartões de alteração de ficheiros expandem pelo cabeçalho e abrem o visualizador de diff pelo corpo; o cabeçalho do painel de tarefas alterna a lista completa.

Clique noutro sítio, carregue numa tecla ou em **Esc** para fechar um seletor.

## Teclado

| Tecla | Ação |
| --- | --- |
| **Enter** / **Shift+Enter** | Enviar (entra na fila enquanto o agente trabalha) / nova linha |
| **Esc** | Cancela a execução, ou o subagente que está a ver |
| **Shift+Tab** | Alterna Agent → Plan → Ask → Parallel → Peak |
| **Tab** | Completa \`/comandos\`, \`@caminhos\` e menções \`@session:\` |
| **←** com o prompt vazio | Mostra ou esconde a barra lateral; a partir de um subagente, volta ao chat principal |
| **↑ / ↓ / roda do rato**, **PgUp / PgDn** | Percorre o chat |
| **Ctrl+T** | Alterna a lista completa de tarefas |
| **Ctrl+W / Ctrl+S / Ctrl+Q** | New worktree / Sessions / Sair (no ecrã vazio) |

\`/keybindings\` mostra a lista completa; \`/vim\` passa o compositor para as teclas do Vim.

## Menções

Escreva \`@\` para anexar um ficheiro ou pasta, ou \`@session:<id>\` para anexar outra conversa do mesmo projeto como contexto.

## Modo headless

\`\`\`bash
faelith -p "Update the changelog for the last release" --mode agent
\`\`\`

\`-p\` executa uma consulta sem a interface, envia o texto para stdout e as linhas de ferramentas para stderr, e sai com \`0\` em caso de sucesso ou \`1\` em caso de erro. Usa o modo de permissão das suas definições.
`,
  },
  'cli-features': {
    title: 'Advisor, Bugfinder, objetivos e mais',
    summary: 'Advisor, Bugfinder, SmartShift, objetivos, loops, worktrees, Autolearn e o sandbox.',
    body: `
## Advisor

\`/advisor\` dá ao agente uma segunda opinião apenas de leitura. Quando ligado, o modelo pode chamar um **Advisor** que lê ficheiros e pesquisa na web antes de uma decisão. \`/advisor echo|horizon\` escolhe o seu modelo; \`/advisor on|off|status\` controla-o. No máximo cinco chamadas ao Advisor por consulta.

## Bugfinder

\`/bugfinder\` acrescenta um inspetor pós-implementação (Horizon por predefinição, sempre com raciocínio máximo, contexto de 1M). Depois de o agente implementar uma alteração, executa o Bugfinder, que pode ler, editar e executar comandos para encontrar e corrigir defeitos. \`/bugfinder on|off|status|echo|horizon\`.

## SmartShift

Ligado por predefinição. Antes de cada prompt escrito, um juiz escolhe o melhor modo (Agent, Plan, Ask, Parallel ou Peak) e troca quando for diferente do atual; o modelo ainda pode trocar uma vez a meio do turno. \`/smartshift on|off|status\`.

## Objetivos e loops

- \`/goal <texto>\` mantém o agente a trabalhar num objetivo ao longo dos turnos até o host **verificar** a conclusão: os testes indicados têm de ter passado em comandos que o host executou de facto, e os ficheiros indicados têm de existir. \`/goal status|resume|clear\`. Um prefixo como \`30m\` pausa o objetivo no prazo.
- \`/loop <prompt>\` reenvia um prompt depois de cada turno bem-sucedido até \`/loop stop\`. Esc pausa-o.

## Modelo dos subagentes

\`/subagent inherit|echo|horizon\` escolhe o modelo que os agentes aninhados usam quando o seu perfil não define um. Veja [Agentes](/docs/agents).

## Worktrees

\`/worktree\` cria um git worktree isolado em \`~/.faelith/worktrees/\` e move a sessão para ele; \`/worktree delete\` remove o atual. O modo Parallel dá a cada worker o seu próprio worktree automaticamente.

## Autolearn e memória

Depois de um turno que alterou ficheiros, o **Autolearn** atualiza o \`FAELITH.md\` da raiz do projeto com o que aprendeu (comandos de build, convenções, armadilhas). \`/autolearn on|off|status\`. \`/memory\` lista todos os ficheiros de memória carregados. Veja [Memória do projeto e regras](/docs/memory).

## Sandbox e segurança

O Bash corre dentro do sandbox do sistema operativo quando disponível (bubblewrap no Linux, Seatbelt no macOS; use o WSL2 no Windows). As leituras de caminhos sensíveis como \`.env\` e \`~/.ssh\` são bloqueadas, e todas as entradas e saídas de ferramentas passam por uma verificação de segredos. \`/sandbox-toggle\` liga ou desliga o sandbox do Bash.

## Diffs e tarefas

Cada edição acrescenta um cartão \`created\` / \`edited\` / \`deleted\` com \`+N -N\`. \`/diff\` alterna as vistas lado a lado no chat, \`/diff <caminho>\` abre o visualizador num ficheiro, e \`R\` \`R\` aí reverte esse ficheiro. O agente mantém uma lista de tarefas num painel fixo acima do compositor.
`,
  },
  skills: {
    title: 'Skills',
    summary: 'Instruções reutilizáveis em Markdown que o agente executa pelo nome ou automaticamente.',
    body: `
Uma **skill** é um conjunto reutilizável de instruções num ficheiro \`SKILL.md\`. Executa-a com \`/nome-da-skill\`, e quando uma skill corresponde à tarefa o agente tem de a invocar por si antes de fazer o trabalho. As skills são apenas instruções: não acrescentam ferramentas nem contornam permissões.

## Onde ficam as skills

| Âmbito | Caminho |
| --- | --- |
| Projeto | \`.faelith/skills/<nome>/SKILL.md\` (a pasta atual e as pastas acima até à raiz do git) |
| Pessoal (todos os projetos) | \`~/.faelith/skills/<nome>/SKILL.md\` |
| Plugin | \`<plugin>/skills/<nome>/SKILL.md\` |
| MCP | Os recursos em Markdown de um servidor tornam-se \`mcp__<servidor>__<nome>\` |

As pastas de outras ferramentas (\`.claude/skills\`, \`.codex/skills\`) não são carregadas. Em caso de nomes repetidos prevalece a primeira encontrada: projeto, depois pessoal, depois plugin, depois incorporada.

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

O frontmatter tem de ser a primeira coisa do ficheiro, e o ficheiro tem de se chamar exatamente \`SKILL.md\`.

## Campos do frontmatter

| Campo | Significado |
| --- | --- |
| \`name\`, \`description\`, \`when_to_use\` | Nome de invocação e o que o catálogo mostra |
| \`paths\` | Globs como \`src/**/*.rs\`; a skill só fica ativa depois de um ficheiro correspondente ser lido ou editado |
| \`user-invocable\` | \`false\` esconde-a de \`/\` (predefinição \`true\`) |
| \`disable-model-invocation\` | \`true\` impede o agente de a invocar automaticamente |
| \`allowed-tools\` | Ferramentas que a skill espera; restringe, nunca concede |
| \`context\`, \`agent\` | \`fork\` executa a skill num contexto de subagente separado, opcionalmente com um perfil como \`explore\` |
| \`model\`, \`effort\` | Altera o modelo (\`echo\`, \`horizon\`) e o raciocínio numa execução em fork |
| \`argument-hint\`, \`arguments\`, \`empty-args\` | Documentam e dão nome aos argumentos |

## Argumentos

Use \`$ARGUMENTS\`, os posicionais \`$0\` / \`$1\`, ou nomeados como \`$file\` no corpo:

\`\`\`text
/review-rust file=src/lib.rs focus=errors
/review-rust src/lib.rs errors
\`\`\`

## Skills incorporadas

O Faelith inclui revisões (\`code-review\`, \`security-review\`, \`api-review\`, \`architecture-review\`, \`performance-review\`, \`database-review\` e outras), ajudantes de criação (\`create-skill\`, \`create-subagent\`, \`create-hook\`, \`create-rule\`), \`prompt-refiner\`, \`spec-to-plan\`, \`deslop\`, \`frontend-design\`, \`backend-design\` e fluxos de git (\`commit\`, \`push\`, \`open-pr\`, \`create-branch\`, \`create-branch-and-pr\`). As skills de git nunca fazem commit na \`main\` e nunca fazem force-push.

## Verificar

\`/skills\` lista o que foi encontrado; \`/reload-plugins\` recarrega as skills depois de as editar.
`,
  },
  agents: {
    title: 'Agentes',
    summary: 'Subagentes incorporados e os seus próprios perfis especialistas em .faelith/agents.',
    body: `
O agente principal pode delegar trabalho em **subagentes**: execuções aninhadas com prompt, modo e lista de ferramentas próprios que devolvem um relatório. Clique na linha de um subagente (ou na sua entrada no painel de agentes) para ler a transcrição completa; **Esc** aí cancela apenas esse worker.

## Tipos incorporados

| Tipo | Use para | Ferramentas |
| --- | --- | --- |
| \`generalPurpose\` | Implementação em várias etapas | Todas as ferramentas |
| \`explore\` | Pesquisa apenas de leitura em muitos ficheiros | Leitura, pesquisa, web, skills |
| \`shell\` | Builds, git e comandos verbosos | Bash, leitura e pesquisa |
| fork | Continua o contexto atual em segundo plano | Herda do pai |

Os subagentes nunca recebem a lista de tarefas, o Advisor ou o Bugfinder, e o aninhamento para na profundidade dois.

## O seu próprio perfil

Crie \`.faelith/agents/<nome>.md\` num projeto, ou \`~/.faelith/agents/<nome>.md\` para todos os projetos:

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

O corpo é o prompt de sistema do worker e não pode estar vazio. Só os ficheiros diretamente dentro de \`agents/\` são carregados.

| Campo | Significado |
| --- | --- |
| \`mode\` | \`agent\` (predefinição), \`ask\` ou \`plan\`. Um pai em Plan mantém o filho em Plan |
| \`allowed-tools\`, \`disallowed-tools\` | Restringem o conjunto de ferramentas; funcionam caracteres universais como \`mcp__*\`. Nunca concedem permissão |
| \`max-turns\` | 1 a 1000; se omitido, sem limite |
| \`allow-nested-agent\` | Permite a este worker iniciar os seus próprios subagentes |
| \`background\` | Corre em segundo plano por predefinição |
| \`model\`, \`effort\` | Modelo do worker (\`echo\`, \`horizon\`) e raciocínio |

## Comandos

\`/agents\` lista todos os perfis. \`/subagent inherit|echo|horizon\` define o modelo predefinido dos subagentes. A skill incorporada \`/create-subagent\` escreve um perfil por si.
`,
  },
  mcp: {
    title: 'Servidores MCP',
    summary: 'Ligue servidores do Model Context Protocol: ferramentas, recursos e prompts.',
    body: `
O Faelith fala o **Model Context Protocol**. As ferramentas de um servidor ligado aparecem como \`mcp__<servidor>__<ferramenta>\`, os recursos em Markdown como skills, e os prompts como comandos com barra (\`/mcp__github__pr_review\`).

## Configurar

\`.faelith/mcp.json\` num projeto (ou \`mcpServers\` em \`~/.faelith/settings.json\` para todos os projetos):

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

As fontes são combinadas por esta ordem, a última prevalece: definições do utilizador → \`.faelith/mcp.json\` do projeto (ou \`.mcp.json\`) → \`.faelith/mcp.local.json\` → \`--mcp-config <ficheiro>\`.

## Campos do servidor

| Campo | Significado |
| --- | --- |
| \`command\`, \`args\`, \`env\` | Servidor local via stdio; \`command\` é o executável, as flags vão em \`args\` |
| \`url\`, \`type\`, \`headers\` | Servidor remoto: \`http\` (Streamable HTTP, predefinição), \`sse\` ou \`websocket\` |
| \`oauth\` | \`clientId\`, \`callbackPort\`, \`scopes\` para servidores com OAuth; os tokens ficam no cofre de credenciais do sistema |
| \`disabled\` | Mantém a entrada mas não inicia o servidor |

\`\${VAR}\` é expandido a partir do ambiente, por isso os tokens nunca precisam de estar no ficheiro. Os servidores remotos têm de usar HTTPS (HTTP simples apenas para \`localhost\`).

## Gerir

\`\`\`text
/mcp                     open the MCP panel
/mcp status              connection state and tool counts
/mcp list                every mcp__ tool
/mcp add <name> <command> [args...]
/mcp remove <name>
/mcp reconnect <name>
\`\`\`

## Confiança e segurança

Os servidores definidos por um projeto ficam **bloqueados** até confiar nesse workspace (concluindo aí o onboarding). As ferramentas MCP passam pelo mesmo controlo de modo, motor de permissões e verificação de segredos das ferramentas incorporadas, e os servidores locais correm dentro do sandbox da sessão. Trate servidores com efeitos secundários como ferramentas de escrita.
`,
  },
  plugins: {
    title: 'Plugins',
    summary: 'Agrupe comandos com barra, agentes, skills, hooks e ferramentas num só pacote.',
    body: `
Um **plugin** reúne comandos com barra, perfis de agentes, skills, hooks e ferramentas próprias para serem partilhados como um único pacote. Se precisa apenas de um desses, use uma [skill](/docs/skills), um [agente](/docs/agents), um [hook](/docs/hooks) ou um [servidor MCP](/docs/mcp).

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

Chaves desconhecidas em \`plugin.json\` invalidam o plugin. Os comandos são prompts em Markdown com o mesmo frontmatter e os mesmos marcadores \`$ARGUMENTS\` das skills; as pastas aninhadas tornam-se segmentos \`:\` (\`commands/security/deps.md\` → \`/my-plugin:security:deps\`). As ferramentas próprias são servidas pelo runtime via JSON-RPC e aparecem como \`plugin__<plugin>__<ferramenta>\`.

## Carregar e instalar

- **Desenvolvimento local:** \`faelith --plugin-dir ./my-plugin\` (pode repetir). Carregar uma pasta sem assinatura é uma decisão explícita de confiança.
- **Marketplace:** \`/plugin install @scope/plugin@1.0.0\`. Os pacotes têm de estar assinados (Ed25519) e são verificados antes da extração; pacotes sem assinatura ou com chave desconhecida são rejeitados. Os plugins instalados ficam em \`~/.faelith/plugins/cache\`.

## Comandos

\`\`\`text
/plugin list        installed plugins, versions and sources
/plugin diagnose    manifest, command and agent errors
/plugin trust       trusted signing keys
/reload-plugins     reload plugins and skills
\`\`\`

As ferramentas e hooks de plugins passam pelo mesmo motor de permissões, verificação de segredos e sandbox que tudo o resto; um plugin nunca consegue atribuir permissões a si próprio.
`,
  },
  hooks: {
    title: 'Hooks',
    summary: 'Scripts que permitem, bloqueiam ou reescrevem chamadas de ferramentas e prompts.',
    body: `
Um **hook** é um comando que o Faelith executa num ponto fixo de cada turno. Pode bloquear uma ferramenta, reescrever a sua entrada, bloquear um prompt ou acrescentar contexto que o modelo vê.

## Eventos

| Evento | Quando |
| --- | --- |
| \`UserPromptSubmit\` | Antes de o seu prompt ser enviado |
| \`PreToolUse\` | Mesmo antes de uma ferramenta correr (Bash, escrita de ficheiros, \`mcp__\`, \`plugin__\` …) |
| \`PostToolUse\` | Depois de uma ferramenta devolver |
| \`Stop\` | Quando o turno principal termina |

## Configurar

\`.faelith/hooks.json\` num projeto, ou a chave \`hooks\` em \`~/.faelith/settings.json\`:

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

\`matcher\` é o nome de uma ferramenta, um prefixo como \`File*\`, ou \`*\` para todas. O hook recebe o evento como JSON no stdin e corre na pasta de trabalho da sessão. O tempo limite predefinido é de 30 segundos; exceder o tempo bloqueia a chamada.

## Resultados

| Resultado do hook | Efeito |
| --- | --- |
| Código de saída \`2\` | Bloqueia; o stderr é mostrado como motivo |
| Saída \`0\` com JSON | \`allow\`, \`reason\`, \`replacement_input\` (nova entrada da ferramenta), \`context_addition\` |
| Saída \`0\` com texto simples | O texto é acrescentado como contexto |
| Qualquer outro código de saída | Não bloqueia; o modelo vê um aviso |

Uma entrada reescrita volta a passar pelas verificações de permissão, por isso os hooks não as conseguem contornar. Os hooks de projeto só correm depois de confiar no workspace; os hooks do utilizador correm sempre. \`/hooks\` mostra o que está carregado.
`,
  },
  memory: {
    title: 'Memória do projeto e regras',
    summary: 'FAELITH.md, ficheiros de regras e definições que moldam cada sessão.',
    body: `
## Ficheiros de memória

O Faelith lê estes ficheiros desde a raiz do repositório até à pasta atual e acrescenta-os a cada sessão:

- \`FAELITH.md\`, \`AGENTS.md\` e \`CLAUDE.md\`
- \`.faelith/FAELITH.md\` e todos os \`.faelith/rules/*.md\`
- \`FAELITH.local.md\` para notas pessoais que não versiona

Use-os para comandos de build e de testes, convenções e armadilhas. \`/init\` cria a pasta \`.faelith/\`, \`/memory\` lista o que está carregado, e o [Autolearn](/docs/cli-features#autolearn-e-memoria) mantém o \`FAELITH.md\` da raiz atualizado. A skill incorporada \`/create-rule\` escreve um ficheiro de regras por si.

## Ficheiros de definições

| Ficheiro | Âmbito |
| --- | --- |
| \`~/.faelith/settings.json\` | Você, nesta máquina |
| \`.faelith/settings.json\` | O projeto (versione-o) |
| \`.faelith/settings.local.json\` | Você, neste projeto (não o versione) |
| \`--settings <ficheiro>\` | Uma execução |

As camadas posteriores prevalecem. \`/settings\` abre um editor interativo das opções comuns. Algumas preferências (Advisor, Bugfinder, SmartShift) são apenas do utilizador e não podem ser definidas por um projeto.

## Onde o Faelith guarda dados

| Caminho | Conteúdo |
| --- | --- |
| \`~/.faelith/sessions/\` | Transcrições das sessões (\`/sessions\`, \`/export\`) |
| \`~/.faelith/worktrees/\` | Worktrees do \`/worktree\` e do modo Parallel |
| \`~/.faelith/skills\`, \`~/.faelith/agents\` | Skills e agentes pessoais |
| \`~/.faelith/plugins/cache\` | Plugins instalados |

As chaves de API ficam no cofre de credenciais do sistema operativo (Gestor de Credenciais do Windows, Keychain do macOS, Secret Service no Linux) e só vão para o \`settings.json\` quando nenhum estiver disponível.
`,
  },
  'desktop-app': {
    title: 'Aplicação desktop',
    summary: 'Faelith para macOS, Windows e Linux: Chat, Code, separador Plan e sessões em vários painéis.',
    body: `
A aplicação desktop reúne o Chat e o Code numa janela, com o mesmo início de sessão da CLI. Transfira-a na página [Transferir](/download); há instaladores para macOS (Apple Silicon e Intel), Windows (\`.msi\` e setup \`.exe\`) e Linux (\`.AppImage\`, \`.deb\`, \`.rpm\`).

## Primeira execução

O ecrã inicial oferece **Continuar no navegador** (device flow) ou **Colar uma chave de API**. **Terminar sessão** volta a este ecrã; a aplicação não funciona sem uma chave válida, propositadamente.

## Chat

Um assistente geral com pesquisa na web, leitura de páginas, anexos de imagens e ficheiros, chats temporários e conversas que podem ser duplicadas. O esforço e o modelo são escolhidos por conversa.

## Code

Cada painel Code é uma sessão completa do agente associada a um workspace:

- **Changed**: o diff de cada ficheiro alterado nesta sessão, com reversão por ficheiro.
- **Plan**: aparece no modo Plan; plano renderizado, comentários no texto, **Build** e **Build in parallel**.
- **Files** e **Terminal**: navegue no workspace e execute comandos.

## Sessões em vários painéis

Arraste **New session** para a área de trabalho para dividir a vista em até **quatro** painéis. Cada painel escolhe o seu próprio workspace (até de outro projeto), tem modelo, modo e permissão próprios e faz streaming de forma independente. A barra lateral e o painel da direita acompanham o painel em foco.

## Subagentes

Quando o agente delega trabalho, a linha mostra um indicador de **subagente**. Clique para abrir a transcrição completa do subagente numa janela.

## Barra lateral e anexos

Projects e Recents listam as suas sessões (o Chat mostra as conversas). Clique com o botão direito num projeto para **Remover da barra lateral**; volta a aparecer quando tiver atividade nova. Arraste qualquer conversa da barra lateral para o compositor para anexar a sua transcrição como contexto.

## Limites e utilização

A linha sob o compositor mostra a sua utilização de **5h** e **semanal**, no Chat e no Code. **Settings → Plan & Usage** mostra os medidores, a faturação por utilização e as reposições de utilização.

## Definições

As predefinições de modelo, o raciocínio por família, o modo de permissão predefinido, os servidores MCP e o aspeto ficam em **Settings**. As definições do projeto em \`.faelith/settings.json\` têm prioridade. Skills, agentes, hooks e plugins funcionam exatamente como na CLI; veja **Personalizar**.
`,
  },
  'web-chat': {
    title: 'Chat na web',
    summary: 'O Faelith Chat no navegador, sincronizado com a conta do painel.',
    body: `
O **Chat** do painel é o mesmo Faelith Chat da aplicação desktop, servido pelo site com a sua sessão iniciada.

## O que é partilhado

- Os mesmos modelos, níveis de raciocínio e ferramentas (pesquisa na web e leitura de páginas; sem ferramentas de repositório).
- As mesmas funcionalidades de conversa: streaming com linhas de raciocínio, linhas de ferramentas, blocos de código com cópia, anexos, chats temporários e duplicação.
- Os mesmos medidores do **Chat**. Uma conversa na web debita os medidores de 5 horas e semanal do Chat exatamente como a aplicação, e a linha sob o compositor mostra ambos.

## Como se autentica

Basta iniciar sessão no site. Nos bastidores, o site emite uma chave com finalidade \`chat\` para a sua conta na primeira utilização e guarda-a cifrada; nunca a vê nem a gere, e revogá-la em **Chaves de API** apenas faz com que seja emitida uma nova na próxima vez.

## Conversas

As conversas ficam guardadas no servidor, por isso uma conversa iniciada no navegador está disponível em qualquer navegador com a sua sessão iniciada. As conversas do desktop ficam no dispositivo que as criou.

Clique com o botão direito numa conversa para **Duplicar** ou **Eliminar**. Os chats temporários são removidos quando sai deles e nunca aparecem na lista.
`,
  },
  'data-handling': {
    title: 'Tratamento de dados',
    summary: 'Inferência ZDR e captura completa e cifrada do I/O dos modelos pelo Faelith.',
    body: `
O Faelith usa inferência com **zero retenção de dados (ZDR)** para todas as chaves de API. Todas as chaves seguem uma única política de tratamento de dados e a mesma tabela de preços.

## Captura do Faelith

O Faelith guarda um registo completo e cifrado durante **90 dias** em S3 sob controlo do Faelith. A captura contém o corpo exato lido pelo modelo e tudo o que ele escreve, bem como a transcrição completa enviada com o pedido. Inclui mensagens de sistema, programador, utilizador, assistente e ferramentas; saída de raciocínio; chamadas de ferramentas; leituras e escritas de ficheiros; resultados de grep/pesquisa; resultados de ferramentas; novas tentativas; e saída em streaming. As capturas são cifradas por envelope antes de serem guardadas e não são reduzidas nem truncadas.

ZDR descreve o caminho da inferência. A captura operacional cifrada do próprio Faelith é separada da retenção de inferência no fornecedor.

## Dados que controla sempre

- **Dados da conta** (e-mail, nome, faturação) são guardados enquanto a conta existir, conforme necessário para prestar o serviço e cumprir a lei fiscal.
- **Eventos de utilização** (tokens, custo, horas) são guardados como histórico de faturação; não contêm o conteúdo dos prompts.
- **Conversas do Chat na web** ficam guardadas até as eliminar, porque são o seu histórico guardado. A captura cifrada de 90 dias do I/O dos modelos é um registo operacional separado.

## Base regulamentar

O Faelith trata os dados em conformidade com o RGPD e a LGPD do Brasil. Os pedidos de acesso, retificação ou apagamento passam por **Definições → Eliminar conta** (que também apaga as suas capturas cifradas) ou pelo [contacto](/contact). Veja os [Termos](/terms) para os detalhes legais.
`,
  },
  'plans-and-usage': {
    title: 'Utilização',
    summary: 'Medidores contínuos, a carteira pré-paga, a faturação por utilização e as reposições.',
    body: `
## Como funcionam os medidores

O medidor de **5 horas** é uma janela contínua, e o medidor **semanal** é reposto sete dias depois da primeira utilização. Os pedidos falham com \`402 plan_limit_reached\` quando um dos dois enche; a página **Utilização** do painel, a linha sob cada compositor e \`/usage\` mostram ambos.

## Carteira pré-paga

As chaves com finalidade \`api\` debitam a carteira ao preço de tabela. Carregue em **Gastos** com um pacote de 10, 50 ou 100 USD ou qualquer valor a partir de 5 USD. A tabela **Eventos de utilização** lista cada pedido com os tokens e o valor: **Incluído** quando o seu plano o cobriu, o valor debitado quando os créditos o pagaram.

## Faturação por utilização

Ative-a em **Gastos** (ou \`/credits on\`) e o Code ou o Chat continuam pela carteira quando um medidor se esgota, em vez de pararem. Desative-a quando quiser. As faturas pagas aparecem em **Faturação e faturas**.

## Reposições de utilização

Uma reposição põe os seus medidores contínuos a zero de imediato. Os planos anuais incluem reposições; é possível comprar mais. Resgate-as em **Utilização** no painel, com \`/usage-reset\` na CLI, ou via \`POST /v1/billing/usage-reset/redeem\`.
`,
  },
  security: {
    title: 'Segurança da conta',
    summary: 'Verificação de e-mail, autenticação de dois fatores, confirmações e recuperação.',
    body: `
## Registo

As contas novas confirmam o e-mail com um código de 6 dígitos antes de a conta ser criada. Também pode iniciar sessão com GitHub ou Google; só são aceites e-mails verificados pelo fornecedor, e um fornecedor nunca é associado automaticamente a uma conta que tenha palavra-passe: inicie sessão com a palavra-passe e associe-o em **Definições**.

## Autenticação de dois fatores

Ative-a em **Definições → Segurança**. A partir daí, todos os inícios de sessão, incluindo por GitHub e Google, pedem um segundo fator:

- **Aplicação autenticadora**: leia o código QR com qualquer aplicação TOTP.
- **Código por e-mail**: um código de 6 dígitos enviado para a sua caixa de entrada.
- **Códigos de cópia de segurança**: 12 códigos de utilização única mostrados uma vez quando ativa o 2FA. Guarde-os em lugar seguro; pode gerar novos.

Com uma aplicação autenticadora ativa, um código por e-mail não é aceite para alterar ou desativar os seus fatores.

## Confirmação de ações sensíveis

Criar chaves de API, alterar a palavra-passe, desassociar um fornecedor, ativar a faturação por utilização, aprovar um início de sessão por dispositivo e eliminar a conta pedem que confirme que é você (um código 2FA, ou a palavra-passe quando o 2FA está desligado). Recebe um e-mail sempre que uma destas ações acontece.

## Inícios de sessão por dispositivo

Quando a CLI ou a aplicação desktop iniciam sessão pelo navegador, a página de aprovação mostra o endereço IP, o cliente e a hora do pedido. Aprove apenas se tiver sido você a iniciá-lo.

## Esqueceu-se da palavra-passe

Use **Esqueceu-se da palavra-passe?** na página de início de sessão. A ligação funciona uma vez, expira em 30 minutos e termina todas as sessões; a autenticação de dois fatores continua a aplicar-se no próximo início de sessão.

## Eliminar a conta

**Definições → Eliminar conta** revoga todas as chaves de API, cancela a sua subscrição e remove os seus dados, incluindo a captura cifrada do I/O dos modelos.
`,
  },
};
