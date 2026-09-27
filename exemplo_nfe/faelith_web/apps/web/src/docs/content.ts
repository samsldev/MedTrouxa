/**
 * @fileoverview Documentation content model: grouped Markdown pages for the public Docs.
 * @author Samuel S. L.
 * @version 2.1.1
 * @since 2026-09-14
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
 * - Each page is Markdown (GFM) rendered by DocsLayout; `##` headings become
 *   anchors listed in the "On this page" rail
 * - Groups define the sidebar order; slugs are the /docs/:slug route
 * - Facts mirror the shipped products: gateway routes, CLI slash commands,
 *   plan catalog (lib/plans.ts), data handling and thinking levels
 * - Customize group documents skills, agents, MCP, plugins, hooks and memory
 *   (sources: faelith_cli/docs/*.md and the Rust runtime)
 * - pt-BR and pt-PT translations live in content.br.ts / content.pt.ts keyed by slug;
 *   `docPagesFor(locale)` overlays them (a missing slug falls back to English)
 * - Heading anchors strip diacritics so Portuguese headings get readable ids
 */

import type { Locale } from '../lib/i18n';
import { DOC_GROUP_LABELS_BR, DOC_PAGES_BR } from './content.br';
import { DOC_GROUP_LABELS_PT, DOC_PAGES_PT } from './content.pt';

export type DocGroup = 'Get started' | 'Models' | 'API' | 'CLI' | 'Customize' | 'Desktop and Web' | 'Account';

export type DocPage = {
  slug: string;
  title: string;
  group: DocGroup;
  summary: string;
  body: string;
};

/** Localized title, summary and body of one page. */
export type DocTranslation = Pick<DocPage, 'title' | 'summary' | 'body'>;

export const DOC_GROUPS: DocGroup[] = ['Get started', 'Models', 'API', 'CLI', 'Customize', 'Desktop and Web', 'Account'];

export const DOC_PAGES: DocPage[] = [
  {
    slug: 'overview',
    title: 'Overview',
    group: 'Get started',
    summary: 'What Faelith is, which surfaces exist, and how they share one account.',
    body: `
Faelith is an agentic coding platform built around two model families, **Echo** and **Horizon**, and four surfaces that share one account, one set of keys and one usage budget:

| Surface | What it is | Where |
| --- | --- | --- |
| **Code** | The coding agent: reads, edits and tests your repository | CLI and desktop app |
| **Chat** | A general assistant with web search and file attachments | Desktop app and this website |
| **CLI** | \`faelith\`, a single static binary for macOS, Linux, WSL and Windows | [Download](/download) |
| **API** | OpenAI-compatible HTTP gateway for your own software | The gateway URL shown under **API Keys** |

## How the pieces fit

- **Account** — created on this website. Holds your plan, wallet and keys.
- **Keys** — issued per purpose (\`code\`, \`chat\`, \`api\`). See [Authentication](/docs/authentication).
- **Plans** — a subscription unlocks rolling 5-hour and weekly meters for Code and Chat. The API is prepaid and debits the wallet. See [Usage](/docs/plans-and-usage).
- **Models** — \`echo\` and \`horizon\` (256k context) plus \`echo1m\` and \`horizon1m\` (1M context). See [Echo and Horizon](/docs/models).

## Where to go next

1. [Quickstart](/docs/quickstart) — install the CLI or app and run your first task in two minutes.
2. [Chat Completions](/docs/chat-completions) — call the API from your own code.
3. [Skills](/docs/skills), [Agents](/docs/agents), [MCP servers](/docs/mcp) and [Plugins](/docs/plugins) — extend the agent.
4. [Data handling](/docs/data-handling) — ZDR inference and Faelith's encrypted S3 capture.
`,
  },
  {
    slug: 'quickstart',
    title: 'Quickstart',
    group: 'Get started',
    summary: 'Install, sign in, and hand Faelith its first task.',
    body: `
## 1. Install

**macOS / Linux / WSL**

\`\`\`bash
curl -fsSL https://get.faelithindustries.com | sh
\`\`\`

**Windows (PowerShell)**

\`\`\`powershell
irm https://get.faelithindustries.com/install.ps1 | iex
\`\`\`

Prefer a window? Grab the desktop app for macOS, Windows or Linux from the [Download](/download) page. It bundles Chat and Code with the same login.

## 2. Sign in

Run \`faelith\` inside a repository. The onboarding wizard offers two ways in:

- **Browser login (device flow)** — the CLI shows a short code, opens \`faelithindustries.com/cli/login\`, and you approve it while signed in. The CLI receives a scoped key automatically.
- **Paste an API key** — create one under **Dashboard → API Keys** and paste it. Use purpose \`code\` for the CLI and app.

\`/logout\` signs out and brings you back to this screen.

The same two options appear on the desktop app's first-run screen.

## 3. Run a task

\`\`\`text
> Add a --json flag to the export command and cover it with a test.
\`\`\`

Code reads the relevant files, proposes edits, runs the tests, and shows you a diff. Approve, refine, or ask for a plan first with \`/plan\`.

## 4. Pick a model and effort

\`\`\`text
/model horizon
/thinking high
\`\`\`

Or click the model and mode pickers in the composer. Echo is fast and balanced; Horizon reasons deeper. See [Echo and Horizon](/docs/models).

## Next steps

- [The CLI interface](/docs/cli-interface) — sidebar, composer, mouse and keyboard.
- [Modes and permissions](/docs/cli-modes) — Agent, Ask, Plan, Parallel and Peak.
- [Slash commands](/docs/cli-commands) — the full reference.
- [Desktop app](/docs/desktop-app) — multi-pane sessions and the Plan tab.
`,
  },
  {
    slug: 'authentication',
    title: 'Authentication',
    group: 'Get started',
    summary: 'API keys, key purposes, device login, and how each surface authenticates.',
    body: `
Every request to Faelith is authenticated with a **bearer API key**. Keys are created in **Dashboard → API Keys** and are shown once at creation; store them in a secret manager.

\`\`\`http
Authorization: Bearer sk-fae_...
\`\`\`

## Key purposes

Each key has one purpose. The purpose decides which meter the request debits and which surfaces accept it.

| Purpose | Accepted by | Debits |
| --- | --- | --- |
| \`code\` | CLI, desktop Code | Code 5-hour / weekly meters |
| \`chat\` | Desktop Chat, web Chat | Chat 5-hour / weekly meters |
| \`api\` | \`/v1/*\` from your own software | Prepaid wallet at list price |

A key never crosses purposes: a \`chat\` key cannot drive Code, and an \`api\` key is the only kind that reaches your wallet.

## Data handling

Every key uses the same **ZDR** inference path. Faelith separately retains complete encrypted model I/O and the complete chat transcript in its own S3 for 90 days. See [Data handling](/docs/data-handling).

## Device login

The CLI and desktop app can sign in without copying a key:

1. The client calls \`POST /api/cli/device\` and receives a \`device_code\` plus a short \`user_code\`.
2. You open \`https://faelithindustries.com/cli/login\` while signed in, type the code and approve.
3. The client polls \`POST /api/cli/device/poll\` until it receives a \`code\`-purpose key.

Codes are short-lived. Approving a code you did not request is the only way to leak a key, so the page asks you to type the code and shows the IP, client and time of the request; approving also asks you to confirm it is you and emails you. See [Account security](/docs/security).

## Sign out

\`/logout\` in the CLI or **Log out** in the app deletes the stored keys locally and returns to the sign-in screen. Revoke the key itself under **API Keys** if the machine is lost.
`,
  },
  {
    slug: 'models',
    title: 'Echo and Horizon',
    group: 'Models',
    summary: 'Model ids, context windows, thinking levels and how to choose.',
    body: `
Faelith serves two model families. Both are available in a **256k** context window and a **1M** alias, both accept text and images, and both stream.

| Model id | Family | Context | Best for |
| --- | --- | --- | --- |
| \`echo\` | Echo | 256k | Fast edits, chat, everyday tasks |
| \`echo1m\` | Echo | 1M | Whole-repository context at Echo speed |
| \`horizon\` | Horizon | 256k | Multi-step reasoning, hard debugging, design |
| \`horizon1m\` | Horizon | 1M | Long investigations across large codebases |

The 1M aliases are billed at **1.25×** their 256k counterparts. Rates are on the [Models](/models) page.

## Thinking levels

Both families support extended reasoning. The level controls how much of the budget the model may spend before answering:

| Level | Behaviour |
| --- | --- |
| \`off\` | No extended reasoning; fastest |
| \`low\` | Light reasoning for simple tasks (Echo default) |
| \`medium\` | Skips thinking on simple queries |
| \`high\` | Deep reasoning for complex tasks (Horizon default) |
| \`xhigh\` | Always thinks thoroughly |
| \`max\` | Maximum depth; slowest |

Set it with \`/thinking <level>\` in the CLI, the gauge picker in the app, or the \`reasoning_effort\` field on the API.

## Model lineage

Echo and Horizon are post-trained by Faelith on top of the **DeepSeek V4 Flash** and **DeepSeek V4 Pro** open-weight base models respectively, then served on Faelith infrastructure with Faelith prompts, tools and safety layers. Behaviour, pricing and data handling are Faelith's; upstream model releases do not change a model id under you.
`,
  },
  {
    slug: 'chat-completions',
    title: 'Chat Completions',
    group: 'API',
    summary: 'POST /v1/chat/completions: request body, streaming, tools and images.',
    body: `
The gateway speaks the OpenAI chat-completions protocol, so most SDKs work by changing the base URL.

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

## Request

| Field | Type | Notes |
| --- | --- | --- |
| \`model\` | string | \`echo\`, \`echo1m\`, \`horizon\`, \`horizon1m\` |
| \`messages\` | array | \`system\`, \`user\`, \`assistant\`, \`tool\` roles; content may be a string or an array of \`text\` / \`image_url\` parts |
| \`stream\` | boolean | Server-sent events with \`data:\` frames ending in \`[DONE]\` |
| \`tools\` / \`tool_choice\` | array / string | OpenAI function-calling shape |
| \`reasoning_effort\` | string | Thinking level; see [Echo and Horizon](/docs/models) |
| \`max_tokens\`, \`temperature\`, \`top_p\`, \`stop\` | — | Standard sampling controls |

## Response

Non-streaming responses return a \`chat.completion\` object with \`choices[0].message\` and a \`usage\` block:

\`\`\`json
{
  "usage": {
    "prompt_tokens": 1231,
    "completion_tokens": 212,
    "prompt_tokens_details": { "cached_tokens": 1024 }
  }
}
\`\`\`

Cached prompt tokens are billed at the cache-read rate. Streaming responses emit \`chat.completion.chunk\` objects; reasoning arrives in \`delta.reasoning_content\` before \`delta.content\`.

## SDK example

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

## Limits

- Request bodies are capped by the gateway (\`413\` when exceeded); keep base64 images small and prefer several turns over one giant prompt.
- Budgets, not rate limits, are the usual reason a request fails: a \`402\` means a meter or the wallet is exhausted. See [Errors](/docs/errors).
`,
  },
  {
    slug: 'account-endpoints',
    title: 'Models, account and usage',
    group: 'API',
    summary: 'GET /v1/models, /v1/account, /v1/usage and the billing endpoints.',
    body: `
These endpoints let your software introspect the key it is using. All accept the same bearer key as chat completions.

## GET /v1/models

Lists the models the key may call, in the OpenAI \`list\` shape.

\`\`\`json
{ "object": "list", "data": [ { "id": "echo", "object": "model", "owned_by": "faelith" }, ... ] }
\`\`\`

## GET /v1/account

Returns the account behind the key: display name, email, and active plan.

## GET /v1/usage

Returns the rolling meters for the key's purpose. Every meter has \`used\`, \`limit\`, \`remaining\` and \`exhausted\`, expressed in micro-dollars of list-price debit.

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

\`{ "enabled": true }\` lets Code and Chat continue from the prepaid wallet once a meter is exhausted. Equivalent to the toggle under **Billing**.

## POST /v1/billing/usage-reset/redeem

Consumes the oldest unused **usage reset** grant and zeros the rolling meters immediately. Returns the new usage snapshot. Resets are included with yearly plans and sold in the dashboard.

`,
  },
  {
    slug: 'errors',
    title: 'Errors and rate limits',
    group: 'API',
    summary: 'Status codes, error bodies, and how meters and the wallet produce 402s.',
    body: `
Errors use the OpenAI error envelope: a stable \`error.code\` you can branch on, an \`error.type\` category, a human \`error.message\`, and \`error.param\` naming the exhausted meter window when relevant.

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

## Status codes

| Status | Code | Type | Meaning |
| --- | --- | --- | --- |
| 400 | \`invalid_request\` | \`invalid_request_error\` | Malformed body, unknown field, unsupported content part |
| 400 | \`model_not_found\` | \`invalid_request_error\` | Unknown model id, or a model this key may not use |
| 400 | \`extraction_blocked\` | \`invalid_request_error\` | The request was classified as an attempt to extract system prompts or weights |
| 401 | \`invalid_api_key\` | \`authentication_error\` | Missing, malformed or revoked key |
| 402 | \`plan_limit_reached\` | \`insufficient_quota\` | A rolling meter is full; \`param\` is \`5h\` or \`weekly\` |
| 402 | \`insufficient_quota\` | \`insufficient_quota\` | Prepaid wallet is empty (API keys, or usage-based Code/Chat) |
| 429 | \`rate_limit_exceeded\` | \`rate_limit_error\` | Too many concurrent requests on one key; back off and retry |
| 500 | \`internal_error\` | \`api_error\` | Retry with backoff; include the request id when contacting support |
| 502 | \`upstream_error\` | \`api_error\` | The model fleet returned an error; safe to retry |
| 503 | \`cluster_at_capacity\` | \`api_error\` | Fleet at capacity; retry after a short delay |
| 503 | \`capture_unavailable\` | \`api_error\` | Mandatory encrypted capture storage is temporarily unavailable |

## Meter headers

Every response, including errors, carries the current meters so clients can show budget without an extra call:

\`\`\`http
x-faelith-plan: pro
x-faelith-code-5h-used: 1210000
x-faelith-code-5h-limit: 3730000
x-faelith-code-weekly-used: ...
\`\`\`

Values are micro-dollars of list-price debit.

## Budgets versus throttling

A **402** means a budget ran out and will not clear by retrying:

- **Subscription keys** hit the 5-hour meter first, then weekly. Wait for the window or redeem a usage reset.
- **API keys** debit the wallet at list price. Top up under **Spending**.
- Turning on **usage-based billing** lets subscription keys fall through to the wallet instead of failing.

A **429** is the only throttling signal and is per key and short-lived.

## Idempotency

Chat completions are not idempotent. If a stream drops mid-response you are billed for the tokens generated so far; resend with the partial assistant message appended if you want to continue rather than restart.
`,
  },
  {
    slug: 'cli-commands',
    title: 'Slash commands',
    group: 'CLI',
    summary: 'Every built-in /command in the Faelith CLI and desktop app.',
    body: `
Type \`/\` in the composer to open the command picker. The same commands work in the CLI and in the desktop app's Code panes.

## Session

| Command | What it does |
| --- | --- |
| \`/help\` | Lists commands, skills and plugins |
| \`/clear\` | Starts a fresh conversation and clears the to-do list |
| \`/compact\` | Summarizes the conversation to free context |
| \`/sessions\` (\`/resume\`) | Reopen a previous session in this workspace |
| \`/rename\` | Rename the current session |
| \`/rewind\` | Restore files and conversation to an earlier checkpoint |
| \`/export\` | Write the transcript to Markdown |
| \`/copy\` | Copy the last assistant message |
| \`/status\`, \`/stats\`, \`/cost\`, \`/token-usage\` | Session status, statistics, cost estimate and token budget |
| \`/exit\` | Leave the CLI |

## Model and behaviour

| Command | What it does |
| --- | --- |
| \`/model [id]\` | Show or switch the model (\`echo\`, \`horizon\`, \`echo1m\`, \`horizon1m\`) |
| \`/thinking [level]\` | Show or set the thinking level |
| \`/mode\`, \`/ask\`, \`/plan\`, \`/parallel\`, \`/peak\` | Switch interaction mode; see [Modes and permissions](/docs/cli-modes) |
| \`/goal <text>\`, \`/loop <prompt>\` | Work until a host-verified goal is met; repeat a prompt after every turn |
| \`/tasks\` | Show the current to-do list |
| \`/advisor\`, \`/bugfinder\`, \`/smartshift\` | Second opinion, post-implementation inspector, automatic mode routing |
| \`/subagent inherit\|echo\|horizon\` | Default model for subagents |
| \`/permissions [mode]\` | Show or set the permission mode |
| \`/review\` | Review the current changes |

See [Advisor, Bugfinder, goals and more](/docs/cli-features).

## Workspace and tools

| Command | What it does |
| --- | --- |
| \`/init\` | Create the project's \`.faelith/\` folder |
| \`/add-dir <path>\` | Grant the agent another directory |
| \`/files\`, \`/diff\` | List project files; toggle side-by-side diffs or open one file's diff |
| \`/worktree\`, \`/branch\` | Create (or delete) a git worktree; create a session branch |
| \`/mcp\` | Manage [MCP servers](/docs/mcp) |
| \`/skills\`, \`/agents\`, \`/hooks\`, \`/memory\` | List [skills](/docs/skills), [agents](/docs/agents), [hooks](/docs/hooks) and [memory files](/docs/memory) |
| \`/plugin\`, \`/reload-plugins\` | Manage and reload [plugins](/docs/plugins) and skills |
| \`/autolearn\` | Automatic \`FAELITH.md\` learning |
| \`/toolcalls\` | Minimized or full tool rows |
| \`/sandbox-toggle\` | Bash sandbox on or off |
| \`/scan\` | System diagnostics |
| \`/vim\`, \`/keybindings\` | Vim keys; list every shortcut |
| \`/theme\` | Dark or light |
| \`/settings\` | Open the interactive settings |

## Account

| Command | What it does |
| --- | --- |
| \`/login\`, \`/subscription\` | Sign in with the browser (device flow), or paste a key with \`/login <key>\` |
| \`/apikey\` | Save a Faelith API key |
| \`/logout\` | Sign out and return to the sign-in screen |
| \`/usage\`, \`/limits\` | 5-hour and weekly meters; show or hide the limit line under the composer |
| \`/credits on\|off\` | Continue from prepaid credits when a meter is full |
| \`/usage-reset\` | List or redeem a usage reset grant |
| \`/upgrade\` | Check for a new CLI version |
| \`/version\`, \`/changelog\` (\`/release-notes\`) | Version and release notes |

Skills, plugin commands and MCP prompts add their own \`/\` commands.
`,
  },
  {
    slug: 'cli-modes',
    title: 'Modes and permissions',
    group: 'CLI',
    summary: 'Agent, Ask, Plan, Parallel and Peak, and how tool permissions are granted.',
    body: `
## Interaction modes

| Mode | Behaviour |
| --- | --- |
| **Agent** | Default. Reads, edits and runs commands, asking permission where your settings require it |
| **Ask** | Answers and explains; never edits or runs anything |
| **Plan** | Produces a Markdown plan ending in a \`## To-dos\` checklist. Nothing is executed until you build it |
| **Parallel** | A coordinator splits the work into batches of subagents, each in its own git worktree |
| **Peak** | Peak-of-N: N isolated full implementations of the same task (default 4, 2–8), then the coordinator picks the best |

Switch with **Shift+Tab**, the mode picker in the composer, \`/mode\`, or \`/ask\`, \`/plan\`, \`/parallel\`, \`/peak\`. With [SmartShift](/docs/cli-features#smartshift) on, Faelith can pick the mode for you.

## Plan, then build

In Plan mode the agent is read-only and writes the plan into \`.faelith/plans/\`. The CLI opens a plan review where you can refine it and choose how to execute it (Agent, Parallel or Peak, permission and model); the desktop app shows it in the **Plan** tab. Select text to add comments and refine, then press **Build** (Agent) or **Build in parallel** (Parallel). To-dos are only created when you build, so a plan never leaves half-finished tasks behind.

## Permissions

Permission modes are orthogonal to interaction modes. Change them with the \`◈\` chip under the composer, \`/permissions <mode>\` or **Settings**; per-project overrides live in \`.faelith/settings.json\`:

\`\`\`json
{
  "permissions": {
    "default_mode": "adaptive",
    "allow": ["Read", "Grep", "Glob", "Bash(npm test:*)"],
    "deny": ["Bash(rm -rf:*)"]
  }
}
\`\`\`

| Mode | Behaviour |
| --- | --- |
| \`adaptive\` | Default. A side classifier approves routine, reversible actions and prompts for risky ones |
| \`standard\` | Prompts for every edit and command not covered by an allow rule |
| \`autoAccept\` | Auto-approves file edits; commands still prompt |
| \`fullAccess\` | Runs everything without prompting; only for disposable environments |
| \`survey\` | Reports what it would do and asks before each tool |
| \`silentDeny\` | Denies anything not explicitly allowed, without prompting |

Subagents always run in \`adaptive\`. In the desktop app the default mode applies to the **focused pane**, so a cautious pane and an autonomous pane can run side by side.

## Checkpoints and rewind

Every edit is checkpointed. \`/rewind\` (or the rewind button on a message) restores both files and conversation to that point.
`,
  },
  {
    slug: 'cli-interface',
    title: 'The CLI interface',
    group: 'CLI',
    summary: 'Sidebar, composer, pickers, mouse and keyboard in the Faelith Code terminal UI.',
    body: `
Run \`faelith\` in a repository to open the full-screen interface. It has the same layout as the desktop app, drawn in the terminal.

## Layout

| Area | What it shows |
| --- | --- |
| **Sidebar** | Product switcher, **New worktree**, **Sessions**, **Settings**, the **Projects** tree (this workspace and its sessions), **Recents**, and your account and plan at the bottom |
| **Topbar** | The session title and a pill with the workspace folder; \`◌\` while the agent is working |
| **Thread** | Your messages as bordered cards, replies as plain text, tool summaries, file-change cards and to-dos |
| **Composer** | Your draft, the mode pill (\`∞ Agent ⌄\`), the model and effort (\`Echo Preview Low ⌄\`), the context ring (\`◔ N%\`) and the send button |
| **Footer** | Folder, branch, \`This PC\`, permission mode, run state, and the \`5h limit · Weekly limit\` line |

The sidebar appears automatically from 100 columns. On an empty prompt, **←** hides or shows it (on narrower terminals ← opens it at a compact width).

## Mouse

Everything in the composer is clickable:

- **↑** sends the draft; **■** stops a running agent.
- **\`◔ N%\`** expands or collapses the full context breakdown.
- **\`∞ Agent ⌄\`** opens the mode picker; **\`Echo Preview Low ⌄\`** opens models and thinking effort; **\`◈ Adaptive ⌄\`** in the footer opens permission modes.
- Sidebar rows open sessions, the Sessions list and Settings; empty-state shortcuts run their action.
- File-change cards expand on their header and open the diff viewer on their body; the to-do panel header toggles the full list.

Click anywhere else, press a key or press **Esc** to close a picker.

## Keyboard

| Key | Action |
| --- | --- |
| **Enter** / **Shift+Enter** | Send (queues while the agent runs) / new line |
| **Esc** | Cancel the run, or the subagent you are viewing |
| **Shift+Tab** | Cycle Agent → Plan → Ask → Parallel → Peak |
| **Tab** | Autocomplete \`/commands\`, \`@paths\` and \`@session:\` mentions |
| **←** on an empty prompt | Show or hide the sidebar; from a subagent, return to the main chat |
| **↑ / ↓ / wheel**, **PgUp / PgDn** | Scroll the chat |
| **Ctrl+T** | Toggle the full to-do list |
| **Ctrl+W / Ctrl+S / Ctrl+Q** | New worktree / Sessions / Quit (on the empty screen) |

\`/keybindings\` prints the full list; \`/vim\` switches the composer to Vim keys.

## Mentions

Type \`@\` to attach a file or folder, or \`@session:<id>\` to attach another conversation from the same project as context.

## Headless mode

\`\`\`bash
faelith -p "Update the changelog for the last release" --mode agent
\`\`\`

\`-p\` runs one query without the interface, streams text to stdout and tool lines to stderr, and exits \`0\` on success or \`1\` on error. It uses the permission mode from your settings.
`,
  },
  {
    slug: 'cli-features',
    title: 'Advisor, Bugfinder, goals and more',
    group: 'CLI',
    summary: 'Advisor, Bugfinder, SmartShift, goals, loops, worktrees, Autolearn and the sandbox.',
    body: `
## Advisor

\`/advisor\` gives the agent a read-only second opinion. When on, the model can call an **Advisor** that reads files and searches the web before a decision. \`/advisor echo|horizon\` picks its model; \`/advisor on|off|status\` controls it. At most five Advisor calls run per query.

## Bugfinder

\`/bugfinder\` adds a post-implementation inspector (Horizon by default, always at max thinking, 1M context). After the agent implements a change it runs Bugfinder, which can read, edit and run commands to find and fix defects. \`/bugfinder on|off|status|echo|horizon\`.

## SmartShift

On by default. Before each typed prompt a judge picks the best mode (Agent, Plan, Ask, Parallel or Peak) and switches when it differs from the current one; the model can still switch mid-turn once. \`/smartshift on|off|status\`.

## Goals and loops

- \`/goal <text>\` keeps the agent working on an objective across turns until the host **verifies** completion: listed tests must have passed in commands the host actually ran, and listed files must exist. \`/goal status|resume|clear\`. A prefix like \`30m\` pauses the goal at the deadline.
- \`/loop <prompt>\` resubmits a prompt after every successful turn until \`/loop stop\`. Esc pauses it.

## Subagent model

\`/subagent inherit|echo|horizon\` chooses the model nested agents use when their profile does not set one. See [Agents](/docs/agents).

## Worktrees

\`/worktree\` creates an isolated git worktree under \`~/.faelith/worktrees/\` and moves the session into it; \`/worktree delete\` removes the current one. Parallel mode gives every worker its own worktree automatically.

## Autolearn and memory

After a turn that changed files, **Autolearn** updates the project's root \`FAELITH.md\` with what it learned (build commands, conventions, pitfalls). \`/autolearn on|off|status\`. \`/memory\` lists every memory file loaded. See [Project memory and rules](/docs/memory).

## Sandbox and safety

Bash runs inside the OS sandbox where available (bubblewrap on Linux, Seatbelt on macOS; use WSL2 on Windows). Reads of sensitive paths such as \`.env\` and \`~/.ssh\` are blocked, and every tool input and output passes a secret scan. \`/sandbox-toggle\` turns the Bash sandbox on or off.

## Diffs and to-dos

Every edit adds a \`created\` / \`edited\` / \`deleted\` card with \`+N -N\`. \`/diff\` toggles side-by-side views in the chat, \`/diff <path>\` opens the viewer on one file, and \`R\` \`R\` there reverts that file. The agent keeps a to-do list in a sticky panel above the composer.
`,
  },
  {
    slug: 'skills',
    title: 'Skills',
    group: 'Customize',
    summary: 'Reusable Markdown instructions the agent runs by name or automatically.',
    body: `
A **skill** is a reusable set of instructions in a \`SKILL.md\` file. You run it with \`/skill-name\`, and when a skill matches the task the agent must invoke it itself before doing the work. Skills are instructions only: they do not add tools or bypass permissions.

## Where skills live

| Scope | Path |
| --- | --- |
| Project | \`.faelith/skills/<name>/SKILL.md\` (the cwd and its parents up to the git root) |
| Personal (all projects) | \`~/.faelith/skills/<name>/SKILL.md\` |
| Plugin | \`<plugin>/skills/<name>/SKILL.md\` |
| MCP | Markdown resources of a server become \`mcp__<server>__<name>\` |

Folders from other tools (\`.claude/skills\`, \`.codex/skills\`) are not loaded. On name clashes the first match wins: project, then personal, then plugin, then built-in.

## A minimal skill

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

The frontmatter must be the first thing in the file, and the file must be named exactly \`SKILL.md\`.

## Frontmatter fields

| Field | Meaning |
| --- | --- |
| \`name\`, \`description\`, \`when_to_use\` | Invocation name and what the catalog shows |
| \`paths\` | Globs such as \`src/**/*.rs\`; the skill activates only after a matching file is read or edited |
| \`user-invocable\` | \`false\` hides it from \`/\` (default \`true\`) |
| \`disable-model-invocation\` | \`true\` stops the agent from invoking it automatically |
| \`allowed-tools\` | Tools the skill expects; narrows, never grants |
| \`context\`, \`agent\` | \`fork\` runs the skill in a separate subagent context, optionally with a profile such as \`explore\` |
| \`model\`, \`effort\` | Override model (\`echo\`, \`horizon\`) and thinking for a forked run |
| \`argument-hint\`, \`arguments\`, \`empty-args\` | Document and name arguments |

## Arguments

Use \`$ARGUMENTS\`, positional \`$0\` / \`$1\`, or named \`$file\` in the body:

\`\`\`text
/review-rust file=src/lib.rs focus=errors
/review-rust src/lib.rs errors
\`\`\`

## Built-in skills

Faelith ships reviews (\`code-review\`, \`security-review\`, \`api-review\`, \`architecture-review\`, \`performance-review\`, \`database-review\` and more), authoring helpers (\`create-skill\`, \`create-subagent\`, \`create-hook\`, \`create-rule\`), \`prompt-refiner\`, \`spec-to-plan\`, \`deslop\`, \`frontend-design\`, \`backend-design\` and git flows (\`commit\`, \`push\`, \`open-pr\`, \`create-branch\`, \`create-branch-and-pr\`). The git skills never commit to \`main\` and never force-push.

## Checking

\`/skills\` lists what was discovered; \`/reload-plugins\` reloads skills after edits.
`,
  },
  {
    slug: 'agents',
    title: 'Agents',
    group: 'Customize',
    summary: 'Built-in subagents and your own specialist profiles in .faelith/agents.',
    body: `
The main agent can delegate work to **subagents**: nested runs with their own prompt, mode and tool list that return a report. Click a subagent row (or its entry in the agent panel) to read its full transcript; **Esc** there cancels only that worker.

## Built-in types

| Type | Use it for | Tools |
| --- | --- | --- |
| \`generalPurpose\` | Multi-step implementation | All tools |
| \`explore\` | Read-only research across many files | Read, search, web, skills |
| \`shell\` | Builds, git and verbose commands | Bash, read and search |
| fork | Continue the current context in the background | Inherits the parent |

Subagents never get the to-do list, Advisor or Bugfinder, and nesting stops at depth two.

## Your own profile

Create \`.faelith/agents/<name>.md\` in a project, or \`~/.faelith/agents/<name>.md\` for every project:

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

The body is the worker's system prompt and must not be empty. Only files directly inside \`agents/\` are loaded.

| Field | Meaning |
| --- | --- |
| \`mode\` | \`agent\` (default), \`ask\` or \`plan\`. A parent in Plan keeps the child in Plan |
| \`allowed-tools\`, \`disallowed-tools\` | Narrow the toolset; wildcards like \`mcp__*\` work. Never grants permission |
| \`max-turns\` | 1–1000; omitted means unlimited |
| \`allow-nested-agent\` | Let this worker start its own subagents |
| \`background\` | Run in the background by default |
| \`model\`, \`effort\` | Worker model (\`echo\`, \`horizon\`) and thinking |

## Commands

\`/agents\` lists every profile. \`/subagent inherit|echo|horizon\` sets the default model for subagents. The built-in skill \`/create-subagent\` writes a profile for you.
`,
  },
  {
    slug: 'mcp',
    title: 'MCP servers',
    group: 'Customize',
    summary: 'Connect Model Context Protocol servers: tools, resources and prompts.',
    body: `
Faelith speaks the **Model Context Protocol**. A connected server's tools appear as \`mcp__<server>__<tool>\`, its Markdown resources as skills, and its prompts as slash commands (\`/mcp__github__pr_review\`).

## Configure

\`.faelith/mcp.json\` in a project (or \`mcpServers\` in \`~/.faelith/settings.json\` for every project):

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

Sources merge in this order, later wins: user settings → project \`.faelith/mcp.json\` (or \`.mcp.json\`) → \`.faelith/mcp.local.json\` → \`--mcp-config <file>\`.

## Server fields

| Field | Meaning |
| --- | --- |
| \`command\`, \`args\`, \`env\` | Local stdio server; \`command\` is the executable, flags go in \`args\` |
| \`url\`, \`type\`, \`headers\` | Remote server: \`http\` (Streamable HTTP, default), \`sse\` or \`websocket\` |
| \`oauth\` | \`clientId\`, \`callbackPort\`, \`scopes\` for OAuth servers; tokens are kept in the OS credential store |
| \`disabled\` | Keep the entry but do not start it |

\`\${VAR}\` expands from the environment, so tokens never need to be in the file. Remote servers must use HTTPS (plain HTTP only for \`localhost\`).

## Manage

\`\`\`text
/mcp                     open the MCP panel
/mcp status              connection state and tool counts
/mcp list                every mcp__ tool
/mcp add <name> <command> [args...]
/mcp remove <name>
/mcp reconnect <name>
\`\`\`

## Trust and safety

Servers defined by a project stay **blocked** until you trust that workspace (complete onboarding there). MCP tools pass through the same mode gate, permission engine and secret scan as built-in tools, and local servers run inside the session sandbox. Treat servers with side effects as write tools.
`,
  },
  {
    slug: 'plugins',
    title: 'Plugins',
    group: 'Customize',
    summary: 'Package slash commands, agents, skills, hooks and tools together.',
    body: `
A **plugin** bundles slash commands, agent profiles, skills, hooks and custom tools so they can be shared as one package. If you only need one of those, use a [skill](/docs/skills), an [agent](/docs/agents), a [hook](/docs/hooks) or an [MCP server](/docs/mcp) instead.

## Layout

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

Unknown keys in \`plugin.json\` invalidate the plugin. Commands are Markdown prompts with the same frontmatter and \`$ARGUMENTS\` placeholders as skills; nested folders become \`:\` segments (\`commands/security/deps.md\` → \`/my-plugin:security:deps\`). Custom tools are served by the runtime over JSON-RPC and appear as \`plugin__<plugin>__<tool>\`.

## Load and install

- **Local development:** \`faelith --plugin-dir ./my-plugin\` (repeatable). Loading an unsigned folder is an explicit trust decision.
- **Marketplace:** \`/plugin install @scope/plugin@1.0.0\`. Bundles must be signed (Ed25519) and are verified before extraction; unsigned or unknown-key bundles are rejected. Installed plugins live in \`~/.faelith/plugins/cache\`.

## Commands

\`\`\`text
/plugin list        installed plugins, versions and sources
/plugin diagnose    manifest, command and agent errors
/plugin trust       trusted signing keys
/reload-plugins     reload plugins and skills
\`\`\`

Plugin tools and hooks run through the same permission engine, secret scan and sandbox as everything else; a plugin can never grant itself permissions.
`,
  },
  {
    slug: 'hooks',
    title: 'Hooks',
    group: 'Customize',
    summary: 'Scripts that allow, block or rewrite tool calls and prompts.',
    body: `
A **hook** is a command Faelith runs at a fixed point of every turn. It can block a tool, rewrite its input, block a prompt, or add context the model sees.

## Events

| Event | When |
| --- | --- |
| \`UserPromptSubmit\` | Before your prompt is sent |
| \`PreToolUse\` | Right before a tool runs (Bash, file writes, \`mcp__\`, \`plugin__\` …) |
| \`PostToolUse\` | After a tool returns |
| \`Stop\` | When the main turn ends |

## Configure

\`.faelith/hooks.json\` in a project, or the \`hooks\` key in \`~/.faelith/settings.json\`:

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

\`matcher\` is a tool name, a prefix like \`File*\`, or \`*\` for all. The hook receives the event as JSON on stdin and runs in the session's working directory. The default timeout is 30 seconds; a timeout blocks the call.

## Results

| Hook outcome | Effect |
| --- | --- |
| Exit code \`2\` | Blocks; stderr is shown as the reason |
| Exit \`0\` with JSON | \`allow\`, \`reason\`, \`replacement_input\` (new tool input), \`context_addition\` |
| Exit \`0\` with plain text | The text is added as context |
| Any other exit code | Does not block; the model sees a warning |

A rewritten input goes through the permission checks again, so hooks cannot bypass them. Project hooks run only after you trust the workspace; user hooks always run. \`/hooks\` shows what is loaded.
`,
  },
  {
    slug: 'memory',
    title: 'Project memory and rules',
    group: 'Customize',
    summary: 'FAELITH.md, rules files and settings that shape every session.',
    body: `
## Memory files

Faelith reads these files from the repository root down to the current directory and adds them to every session:

- \`FAELITH.md\`, \`AGENTS.md\` and \`CLAUDE.md\`
- \`.faelith/FAELITH.md\` and every \`.faelith/rules/*.md\`
- \`FAELITH.local.md\` for personal notes you do not commit

Use them for build and test commands, conventions and pitfalls. \`/init\` creates the \`.faelith/\` folder, \`/memory\` lists what is loaded, and [Autolearn](/docs/cli-features#autolearn-and-memory) keeps the root \`FAELITH.md\` up to date. The built-in \`/create-rule\` skill writes a rules file for you.

## Settings files

| File | Scope |
| --- | --- |
| \`~/.faelith/settings.json\` | You, on this machine |
| \`.faelith/settings.json\` | The project (commit it) |
| \`.faelith/settings.local.json\` | You, in this project (do not commit) |
| \`--settings <file>\` | One run |

Later layers win. \`/settings\` opens an interactive editor for the common options. Some preferences (Advisor, Bugfinder, SmartShift) are user-only and cannot be set by a project.

## Where Faelith keeps data

| Path | Contents |
| --- | --- |
| \`~/.faelith/sessions/\` | Session transcripts (\`/sessions\`, \`/export\`) |
| \`~/.faelith/worktrees/\` | Worktrees from \`/worktree\` and Parallel mode |
| \`~/.faelith/skills\`, \`~/.faelith/agents\` | Personal skills and agents |
| \`~/.faelith/plugins/cache\` | Installed plugins |

API keys are stored in the operating system's credential store (Windows Credential Manager, macOS Keychain, Secret Service on Linux) and only fall back to \`settings.json\` when none is available.
`,
  },
  {
    slug: 'desktop-app',
    title: 'Desktop app',
    group: 'Desktop and Web',
    summary: 'Faelith for macOS, Windows and Linux: Chat, Code, Plan tab and multi-pane sessions.',
    body: `
The desktop app packages Chat and Code in one window with the same login as the CLI. Download it from the [Download](/download) page; installers are published for macOS (Apple Silicon and Intel), Windows (\`.msi\` and setup \`.exe\`) and Linux (\`.AppImage\`, \`.deb\`, \`.rpm\`).

## First run

The onboarding screen offers **Continue in browser** (device flow) or **Paste an API key**. **Log out** returns to this screen; the app is unusable without a valid key by design.

## Chat

A general assistant with web search, page fetch, image and file attachments, temporary chats and forkable threads. Effort and model are chosen per conversation.

## Code

Each Code pane is a full agent session bound to a workspace:

- **Changed** — the diff of every file touched this session, with per-file revert.
- **Plan** — appears in Plan mode; rendered plan, inline comments, **Build** and **Build in parallel**.
- **Files** and **Terminal** — browse the workspace and run commands.

## Multi-pane sessions

Drag **New session** onto the canvas to split the view into up to **four** panes. Every pane picks its own workspace (even a different project), has its own model, mode and permission state, and streams independently. The sidebar and the right panel follow the focused pane.

## Subagents

When the agent delegates work, the row shows a **subagent** indicator. Click it to open the subagent's full transcript in a modal.

## Sidebar and attachments

Projects and Recents list your sessions (Chat shows threads). Right-click a project to **Remove from sidebar**; it comes back when it gets new activity. Drag any conversation from the sidebar into the composer to attach its transcript as context.

## Limits and usage

The line under the composer shows your **5h** and **weekly** usage, in both Chat and Code. **Settings → Plan & Usage** shows the meters, usage-based billing and usage resets.

## Settings

Model defaults, thinking per family, permission default mode, MCP servers and appearance live under **Settings**. Project-level settings in \`.faelith/settings.json\` take precedence. Skills, agents, hooks and plugins work exactly as in the CLI; see **Customize**.
`,
  },
  {
    slug: 'web-chat',
    title: 'Web Chat',
    group: 'Desktop and Web',
    summary: 'Faelith Chat in the browser, synced with your dashboard account.',
    body: `
**Chat** in the dashboard is the same Faelith Chat that ships in the desktop app, served from the website with your signed-in session.

## What is shared

- The same models, thinking levels and tools (web search and page fetch; no repository tools).
- The same transcript features: streaming with reasoning rows, tool rows, code blocks with copy, attachments, temporary chats and forking.
- The same **Chat** meters. A web conversation debits your Chat 5-hour and weekly meters exactly like the app, and the line under the composer shows both.

## How it authenticates

Signing in to the website is enough. Behind the scenes the site mints a \`chat\`-purpose key for your account on first use and stores it encrypted; you never see or manage it, and revoking it under **API Keys** simply causes a new one to be minted next time.

## Threads

Threads are stored on the server, so a conversation started in the browser is available from any signed-in browser. Desktop threads remain on the device that created them.

Right-click a thread to **Fork** or **Delete**. Temporary chats are removed when you leave them and never appear in the list.
`,
  },
  {
    slug: 'data-handling',
    title: 'Data handling',
    group: 'Account',
    summary: 'ZDR inference plus complete, encrypted Faelith-side model I/O capture.',
    body: `
Faelith uses **zero data retention (ZDR)** inference for every API key. Every key follows one data-handling policy and the same rate card.

## Faelith capture

Faelith retains a complete, encrypted record for **90 days** in Faelith-controlled S3. The capture contains the exact body read by the model and everything it writes, plus the complete transcript supplied with the request. This includes system, developer, user, assistant and tool messages; reasoning output; tool calls; file reads and writes; grep/search results; tool results; retries; and streamed output. Captures are envelope-encrypted before storage and are not reduced or truncated.

ZDR describes the inference path. Faelith's own encrypted operational capture is separate from provider-side inference retention.

## Data you always control

- **Account data** (email, name, billing) is kept while the account exists, as required to provide the service and comply with tax law.
- **Usage events** (tokens, cost, timestamps) are kept for billing history; they contain no prompt content.
- **Web Chat threads** are stored until you delete them because they are your saved history. The 90-day encrypted model-I/O capture is a separate operational record.

## Regulatory basis

Faelith processes data in accordance with the GDPR and Brazil's LGPD. Requests for access, correction or erasure go through **Settings → Delete account** (which also erases your encrypted captures) or [contact](/contact). See the [Terms](/terms) for the legal detail.
`,
  },
  {
    slug: 'plans-and-usage',
    title: 'Usage',
    group: 'Account',
    summary: 'Rolling meters, the prepaid wallet, usage-based billing and resets.',
    body: `
## How meters roll

The **5-hour** meter is a rolling window, and the **weekly** meter resets seven days after first use. Requests fail with \`402 plan_limit_reached\` when either one is full; the dashboard **Usage** page, the line under every composer and \`/usage\` show both.

## Prepaid wallet

\`api\`-purpose keys debit the wallet at list price. Top up under **Spending** with a $10, $50 or $100 pack or any custom amount from $5. The **Usage events** table lists every request with its tokens and amount: **Included** when your plan covered it, the debited amount when credits paid for it.

## Usage-based billing

Turn it on under **Spending** (or \`/credits on\`) and Code or Chat continue from the wallet when a meter is exhausted instead of stopping. Turn it off any time. Paid invoices are listed under **Billing & Invoices**.

## Usage resets

A reset zeros your rolling meters immediately. Yearly plans include resets; more can be purchased. Redeem from **Usage** in the dashboard, with \`/usage-reset\` in the CLI, or via \`POST /v1/billing/usage-reset/redeem\`.
`,
  },
  {
    slug: 'security',
    title: 'Account security',
    group: 'Account',
    summary: 'Email verification, two-factor authentication, confirmations and recovery.',
    body: `
## Sign-up

New accounts confirm their email with a 6-digit code before the account is created. You can also sign in with GitHub or Google; only provider-verified emails are accepted, and a provider is never linked automatically to an account that has a password — sign in with your password and link it from **Settings**.

## Two-factor authentication

Turn it on under **Settings → Security**. Every sign-in, including GitHub and Google, then asks for a second factor:

- **Authenticator app** — scan the QR code with any TOTP app.
- **Email code** — a 6-digit code sent to your inbox.
- **Backup codes** — 12 single-use codes shown once when you enable 2FA. Store them safely; you can regenerate them.

With an authenticator app enabled, an email code is not accepted to change or disable your factors.

## Confirming sensitive actions

Creating API keys, changing your password, unlinking a provider, enabling usage-based billing, approving a device login and deleting your account ask you to confirm it is you (a 2FA code, or your password when 2FA is off). You receive an email whenever one of these happens.

## Device logins

When the CLI or desktop app signs in through the browser, the approval page shows the IP address, client and time of the request. Approve it only if you started it yourself.

## Forgot your password

Use **Forgot your password?** on the sign-in page. The link works once, expires in 30 minutes and signs out every session; two-factor authentication still applies at the next sign-in.

## Deleting your account

**Settings → Delete account** revokes every API key, cancels your subscription and removes your data, including the encrypted model-I/O capture.
`,
  },
];

const TRANSLATIONS: Record<Exclude<Locale, 'en'>, Record<string, DocTranslation>> = { br: DOC_PAGES_BR, pt: DOC_PAGES_PT };
const GROUP_LABELS: Record<Exclude<Locale, 'en'>, Record<DocGroup, string>> = { br: DOC_GROUP_LABELS_BR, pt: DOC_GROUP_LABELS_PT };

/**
 * Pages in reading order for a locale; untranslated slugs keep the English text.
 */
export function docPagesFor(locale: Locale): DocPage[] {
  if (locale === 'en') return DOC_PAGES;
  const table = TRANSLATIONS[locale];
  return DOC_PAGES.map((page) => ({ ...page, ...(table[page.slug] ?? {}) }));
}

/** Sidebar label of a group in a locale. */
export function docGroupLabel(group: DocGroup, locale: Locale): string {
  return locale === 'en' ? group : GROUP_LABELS[locale][group];
}

/**
 * Finds a page by slug in `pages`, or null when it does not exist.
 */
export function findDoc(slug: string | undefined, pages: DocPage[] = DOC_PAGES): DocPage | null {
  if (!slug) return pages[0];
  return pages.find((page) => page.slug === slug) ?? null;
}

/**
 * Turns a heading into a URL-safe anchor id (GitHub style).
 */
export function slugifyHeading(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Extracts `##` headings from a Markdown body for the "On this page" rail.
 */
export function extractHeadings(body: string): Array<{ id: string; text: string }> {
  const headings: Array<{ id: string; text: string }> = [];
  for (const line of body.split('\n')) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) headings.push({ id: slugifyHeading(match[1]), text: match[1] });
  }
  return headings;
}
