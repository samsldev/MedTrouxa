/**
 * @fileoverview Portuguese (pt-BR and pt-PT) text for the changelog releases, keyed by version.
 * @author Samuel S. L.
 * @version 1.0.0
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
 * - One entry per release version: translated title and item texts in the same order
 *   as docs/changelog.ts; a missing version or item falls back to English
 * - `releasesFor(locale)` returns the localized release list
 */

import type { Locale } from '../lib/i18n';
import { RELEASES, type Release } from './changelog';

type ReleaseText = { title: string; items: string[] };

const BR: Record<string, ReleaseText> = {
  '2026.09.14': {
    title: 'Chat na web, instaladores desktop, documentação',
    items: [
      '**Chat na web** no painel: o Chat do desktop, servido pelo site com a sua sessão aberta, com conversas sincronizadas no servidor.',
      'Motor do chat extraído para um crate compartilhado para que o app e o site transmitam os mesmos eventos (`chat-delta`, `chat-reasoning`, `chat-tool`, `chat-done`).',
      'A página de Download lista os instaladores desktop para macOS, Windows e Linux direto da última versão no GitHub, com checksums SHA-256.',
      'Páginas de Documentação, Changelog e Termos.',
      'O cadastro no site emite uma chave criptografada com finalidade `chat` no primeiro uso do Chat; nada para configurar.',
    ],
  },
  '2026.09.13': {
    title: 'Onboarding e saída da conta',
    items: [
      'Tela inicial com **Continuar no navegador** (device flow) e **Colar uma chave de API**, idêntica ao login da CLI.',
      'Sair da conta volta para a tela de onboarding; o app exige uma chave válida para continuar.',
      'Builds de teste do app apontam para o gateway de teste por padrão.',
    ],
  },
  '2026.09.12': {
    title: 'Build in parallel, transcrições de subagentes',
    items: [
      '**Build in parallel** na aba Plan executa o plano no modo Parallel; o botão Build agora usa a cor do modo Plan.',
      'As linhas de subagentes têm um indicador próprio; clique para abrir a transcrição completa do subagente.',
      'O compositor não é mais cortado quando três ou quatro painéis estão abertos.',
    ],
  },
  '2026.09.11': {
    title: 'Sessões em vários painéis',
    items: [
      'Arraste **New session** para a área de trabalho para dividir em até quatro painéis Code independentes, cada um com workspace, modelo e permissões próprios.',
      'Seletor de comandos com barra: digite `/` para ver comandos embutidos, skills, plugins e prompts MCP.',
      'Estado de execução por sessão (tarefas, histórico de arquivos, subagentes, escopo MCP) para que sessões simultâneas nunca compartilhem estado.',
      'Servidores MCP configurados por painéis diferentes não entram mais em conflito; os servidores ganham um alias por workspace.',
    ],
  },
  '2026.09.10': {
    title: 'Aba Plan',
    items: [
      'O modo Plan mostra o plano numa aba **Plan** com comentários no texto, seletor de modelo e um botão **Build**.',
      'As tarefas são criadas quando você constrói, não quando o plano é gerado; o plano termina numa checklist `## To-dos`.',
      'Os planos são guardados em `.faelith/plans/` junto com os metadados do host.',
    ],
  },
  '2026.09.06': {
    title: 'Painel e cobrança',
    items: [
      'Painel com mapa de atividade na Visão geral, medidores de Uso, extrato de Gastos, Chaves de API e Cobrança.',
      'Opção de cobrança por uso e resets de uso; `POST /v1/billing/usage-reset/redeem`.',
      'Finalidades de chave (`code`, `chat`, `api`) e captura criptografada unificada do I/O dos modelos.',
      'Proteção CSRF nas rotas do painel que alteram estado; sessões vinculadas à Origin.',
    ],
  },
};

const PT: Record<string, ReleaseText> = {
  '2026.09.14': {
    title: 'Chat na web, instaladores desktop, documentação',
    items: [
      '**Chat na web** no painel: o Chat do desktop, servido pelo site com a sua sessão iniciada, com conversas sincronizadas no servidor.',
      'Motor do chat extraído para um crate partilhado para que a aplicação e o site transmitam os mesmos eventos (`chat-delta`, `chat-reasoning`, `chat-tool`, `chat-done`).',
      'A página Transferir lista os instaladores desktop para macOS, Windows e Linux diretamente da última versão no GitHub, com checksums SHA-256.',
      'Páginas de Documentação, Changelog e Termos.',
      'O registo no site emite uma chave cifrada com finalidade `chat` na primeira utilização do Chat; nada para configurar.',
    ],
  },
  '2026.09.13': {
    title: 'Onboarding e terminar sessão',
    items: [
      'Ecrã inicial com **Continuar no navegador** (device flow) e **Colar uma chave de API**, idêntico ao início de sessão da CLI.',
      'Terminar sessão volta ao ecrã de onboarding; a aplicação exige uma chave válida para continuar.',
      'As builds de teste da aplicação apontam para o gateway de teste por predefinição.',
    ],
  },
  '2026.09.12': {
    title: 'Build in parallel, transcrições de subagentes',
    items: [
      '**Build in parallel** no separador Plan executa o plano no modo Parallel; o botão Build usa agora a cor do modo Plan.',
      'As linhas de subagentes têm um indicador próprio; clique para abrir a transcrição completa do subagente.',
      'O compositor deixou de ser cortado quando há três ou quatro painéis abertos.',
    ],
  },
  '2026.09.11': {
    title: 'Sessões em vários painéis',
    items: [
      'Arraste **New session** para a área de trabalho para dividir em até quatro painéis Code independentes, cada um com workspace, modelo e permissões próprios.',
      'Seletor de comandos com barra: escreva `/` para ver comandos incorporados, skills, plugins e prompts MCP.',
      'Estado de execução por sessão (tarefas, histórico de ficheiros, subagentes, âmbito MCP) para que sessões simultâneas nunca partilhem estado.',
      'Os servidores MCP configurados por painéis diferentes deixaram de entrar em conflito; os servidores recebem um alias por workspace.',
    ],
  },
  '2026.09.10': {
    title: 'Separador Plan',
    items: [
      'O modo Plan mostra o plano num separador **Plan** com comentários no texto, seletor de modelo e um botão **Build**.',
      'As tarefas são criadas quando constrói, não quando o plano é gerado; o plano termina numa checklist `## To-dos`.',
      'Os planos são guardados em `.faelith/plans/` juntamente com os metadados do host.',
    ],
  },
  '2026.09.06': {
    title: 'Painel e faturação',
    items: [
      'Painel com mapa de atividade na Visão geral, medidores de Utilização, extrato de Gastos, Chaves de API e Faturação.',
      'Opção de faturação por utilização e reposições de utilização; `POST /v1/billing/usage-reset/redeem`.',
      'Finalidades de chave (`code`, `chat`, `api`) e captura cifrada unificada do I/O dos modelos.',
      'Proteção CSRF nas rotas do painel que alteram estado; sessões associadas à Origin.',
    ],
  },
};

const TABLES: Record<Exclude<Locale, 'en'>, Record<string, ReleaseText>> = { br: BR, pt: PT };

/**
 * Releases with titles and item texts in `locale` (English where a translation is missing).
 */
export function releasesFor(locale: Locale): Release[] {
  if (locale === 'en') return RELEASES;
  const table = TABLES[locale];
  return RELEASES.map((release) => {
    const text = table[release.version];
    if (!text) return release;
    return {
      ...release,
      title: text.title,
      items: release.items.map((item, index) => ({ ...item, text: text.items[index] ?? item.text })),
    };
  });
}
