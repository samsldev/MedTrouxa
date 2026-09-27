/**
 * @fileoverview Localized strings for the web Faelith Chat (en, pt-BR, pt-PT).
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
 * - One table shared by ChatPage, ChatThread, ChatComposer, PlanLimits and ContextRing
 * - Model names stay in English (product names); descriptions and effort labels translate
 * - `localizedItems` overlays translated labels/descriptions on the picker item lists
 */

import { useT, type Dict } from '../lib/i18n';
import type { DropdownItem } from './Dropdown';

export interface ChatStrings {
  modelDescriptions: Record<string, string>;
  efforts: Record<string, { label: string; description: string }>;
  fork: string;
  delete: string;
  temporaryChat: string;
  newChat: string;
  recents: string;
  noChats: string;
  showChats: string;
  hideChats: string;
  temporaryOn: string;
  temporaryOff: string;
  now: string;
  tips: string[];
  running: string;
  ran: string;
  temporaryBody: string;
  emptyBody: string;
  askAnything: string;
  attachFiles: string;
  attach: string;
  thinkingEffort: string;
  stop: string;
  send: string;
  webOnly: string;
  enterHint: string;
  limits: (five: number, weekly: number) => string;
  contextAria: (pct: number) => string;
  contextTitle: (pct: number, used: string, limit: string) => string;
  contextUsage: string;
  full: (pct: number) => string;
  tokens: string;
  noContext: string;
}

const T: Dict<ChatStrings> = {
  en: {
    modelDescriptions: { echo: 'Fast, balanced', horizon: 'Deep reasoning' },
    efforts: {
      off: { label: 'Off', description: 'No extended reasoning; fastest' },
      low: { label: 'Low', description: 'Light reasoning for simple tasks' },
      medium: { label: 'Medium', description: 'Skips thinking on simple queries' },
      high: { label: 'High', description: 'Deep reasoning for complex tasks' },
      xhigh: { label: 'Extra high', description: 'Always thinks thoroughly' },
      max: { label: 'Max', description: 'Maximum depth; slowest' },
    },
    fork: 'Fork',
    delete: 'Delete',
    temporaryChat: 'Temporary chat',
    newChat: 'New chat',
    recents: 'Recents',
    noChats: 'No chats yet',
    showChats: 'Show chats',
    hideChats: 'Hide chats',
    temporaryOn: 'Temporary chat: not saved to history. Click to keep it.',
    temporaryOff: 'Turn on temporary chat (not saved to history)',
    now: 'now',
    tips: [
      'Attach images or files to ground the answer in your own material.',
      'Chat can search the web and fetch pages; ask for sources.',
      'Right-click a conversation to fork or delete it.',
      'Change the thinking effort per model with the gauge picker.',
    ],
    running: 'Running',
    ran: 'Ran',
    temporaryBody: 'This chat is not saved to your history and disappears when you leave it.',
    emptyBody: 'Ask anything. Attach files or images to ground the answer.',
    askAnything: 'Ask anything',
    attachFiles: 'Attach files',
    attach: 'Attach',
    thinkingEffort: 'Thinking effort',
    stop: 'Stop',
    send: 'Send',
    webOnly: 'Web search and fetch, no repository tools',
    enterHint: 'Enter to send, Shift+Enter for newline',
    limits: (five, weekly) => `5h limit: ${five}% used · Weekly limit: ${weekly}% used`,
    contextAria: (pct) => `Context usage ${pct}%`,
    contextTitle: (pct, used, limit) => `Context ${pct}% (${used} / ${limit})`,
    contextUsage: 'Context Usage',
    full: (pct) => `${pct}% Full`,
    tokens: 'Tokens',
    noContext: 'No context consumed yet',
  },
  br: {
    modelDescriptions: { echo: 'Rápido, equilibrado', horizon: 'Raciocínio profundo' },
    efforts: {
      off: { label: 'Desligado', description: 'Sem raciocínio estendido; mais rápido' },
      low: { label: 'Baixo', description: 'Raciocínio leve para tarefas simples' },
      medium: { label: 'Médio', description: 'Pula o raciocínio em perguntas simples' },
      high: { label: 'Alto', description: 'Raciocínio profundo para tarefas complexas' },
      xhigh: { label: 'Muito alto', description: 'Sempre pensa a fundo' },
      max: { label: 'Máximo', description: 'Profundidade máxima; mais lento' },
    },
    fork: 'Duplicar',
    delete: 'Excluir',
    temporaryChat: 'Chat temporário',
    newChat: 'Novo chat',
    recents: 'Recentes',
    noChats: 'Nenhum chat ainda',
    showChats: 'Mostrar chats',
    hideChats: 'Ocultar chats',
    temporaryOn: 'Chat temporário: não fica salvo no histórico. Clique para mantê-lo.',
    temporaryOff: 'Ativar chat temporário (não fica salvo no histórico)',
    now: 'agora',
    tips: [
      'Anexe imagens ou arquivos para basear a resposta no seu próprio material.',
      'O Chat pode pesquisar na web e abrir páginas; peça as fontes.',
      'Clique com o botão direito em uma conversa para duplicar ou excluir.',
      'Mude o esforço de raciocínio de cada modelo no seletor de medidor.',
    ],
    running: 'Executando',
    ran: 'Executou',
    temporaryBody: 'Este chat não fica salvo no seu histórico e some quando você sair dele.',
    emptyBody: 'Pergunte qualquer coisa. Anexe arquivos ou imagens para basear a resposta.',
    askAnything: 'Pergunte qualquer coisa',
    attachFiles: 'Anexar arquivos',
    attach: 'Anexar',
    thinkingEffort: 'Esforço de raciocínio',
    stop: 'Parar',
    send: 'Enviar',
    webOnly: 'Pesquisa e leitura na web, sem ferramentas de repositório',
    enterHint: 'Enter para enviar, Shift+Enter para nova linha',
    limits: (five, weekly) => `Limite de 5h: ${five}% usado · Limite semanal: ${weekly}% usado`,
    contextAria: (pct) => `Uso de contexto ${pct}%`,
    contextTitle: (pct, used, limit) => `Contexto ${pct}% (${used} / ${limit})`,
    contextUsage: 'Uso de contexto',
    full: (pct) => `${pct}% cheio`,
    tokens: 'Tokens',
    noContext: 'Nenhum contexto usado ainda',
  },
  pt: {
    modelDescriptions: { echo: 'Rápido, equilibrado', horizon: 'Raciocínio profundo' },
    efforts: {
      off: { label: 'Desligado', description: 'Sem raciocínio alargado; mais rápido' },
      low: { label: 'Baixo', description: 'Raciocínio leve para tarefas simples' },
      medium: { label: 'Médio', description: 'Salta o raciocínio em perguntas simples' },
      high: { label: 'Alto', description: 'Raciocínio profundo para tarefas complexas' },
      xhigh: { label: 'Muito alto', description: 'Pensa sempre a fundo' },
      max: { label: 'Máximo', description: 'Profundidade máxima; mais lento' },
    },
    fork: 'Duplicar',
    delete: 'Eliminar',
    temporaryChat: 'Chat temporário',
    newChat: 'Novo chat',
    recents: 'Recentes',
    noChats: 'Ainda não há chats',
    showChats: 'Mostrar chats',
    hideChats: 'Ocultar chats',
    temporaryOn: 'Chat temporário: não é guardado no histórico. Clique para o manter.',
    temporaryOff: 'Ativar chat temporário (não é guardado no histórico)',
    now: 'agora',
    tips: [
      'Anexe imagens ou ficheiros para basear a resposta no seu próprio material.',
      'O Chat pode pesquisar na web e abrir páginas; peça as fontes.',
      'Clique com o botão direito numa conversa para a duplicar ou eliminar.',
      'Altere o esforço de raciocínio de cada modelo no seletor de medidor.',
    ],
    running: 'A executar',
    ran: 'Executou',
    temporaryBody: 'Este chat não é guardado no seu histórico e desaparece quando sair dele.',
    emptyBody: 'Pergunte o que quiser. Anexe ficheiros ou imagens para basear a resposta.',
    askAnything: 'Pergunte o que quiser',
    attachFiles: 'Anexar ficheiros',
    attach: 'Anexar',
    thinkingEffort: 'Esforço de raciocínio',
    stop: 'Parar',
    send: 'Enviar',
    webOnly: 'Pesquisa e leitura na web, sem ferramentas de repositório',
    enterHint: 'Enter para enviar, Shift+Enter para nova linha',
    limits: (five, weekly) => `Limite de 5h: ${five}% usado · Limite semanal: ${weekly}% usado`,
    contextAria: (pct) => `Utilização de contexto ${pct}%`,
    contextTitle: (pct, used, limit) => `Contexto ${pct}% (${used} / ${limit})`,
    contextUsage: 'Utilização de contexto',
    full: (pct) => `${pct}% cheio`,
    tokens: 'Tokens',
    noContext: 'Ainda não foi usado contexto',
  },
};

/** Chat strings for the active locale. */
export function useChatT(): ChatStrings {
  return useT(T);
}

/** Overlays translated labels/descriptions on picker items (unknown ids keep theirs). */
export function localizedItems(items: DropdownItem[], t: ChatStrings): DropdownItem[] {
  return items.map((item) => {
    const effort = t.efforts[item.id];
    if (effort) return { ...item, label: effort.label, description: effort.description };
    const description = t.modelDescriptions[item.id];
    return description ? { ...item, description } : item;
  });
}
