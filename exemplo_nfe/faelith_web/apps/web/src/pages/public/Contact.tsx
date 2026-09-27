/**
 * @fileoverview Public talk-to-sales page with a two-column contact layout.
 * @author Samuel S. L.
 * @version 2.3.1
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
 * DETAILED_DESCRIPTION:
 * - Left column: headline, direct email, and what to expect
 * - Right column: CSRF-protected sales form with success and error notices
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icons';
import { ApiError, fetchCsrf, submitContact } from '../../lib/api';
import { useT, type Dict } from '../../lib/i18n';
import styles from './Marketing.module.css';

interface ContactStrings {
  kicker: string;
  title: [string, string];
  lede: string;
  email: string;
  responseTime: string;
  responseValue: string;
  timezones: string;
  timezonesValue: string;
  name: string;
  namePlaceholder: string;
  workEmail: string;
  message: string;
  messagePlaceholder: string;
  received: string;
  failed: string;
  sending: string;
  send: string;
}

const T: Dict<ContactStrings> = {
  en: {
    kicker: 'Contact',
    title: ['Talk to someone who ', 'ships.'],
    lede: 'Volume pricing, consolidated invoicing, dedicated capacity, or a data-processing agreement. Your message lands with an engineer, not a queue, and you get a real answer in one business day.',
    email: 'Email',
    responseTime: 'Response time',
    responseValue: 'Within one business day',
    timezones: 'Timezones',
    timezonesValue: 'Europe and Americas',
    name: 'Name',
    namePlaceholder: 'Your name',
    workEmail: 'Work email',
    message: 'Message',
    messagePlaceholder: 'Tell us about your team, volume, and timeline.',
    received: 'Received. An engineer will reply within one business day.',
    failed: 'Unable to send message',
    sending: 'Sending…',
    send: 'Send message',
  },
  br: {
    kicker: 'Contato',
    title: ['Fale com alguém que ', 'entrega.'],
    lede: 'Preço por volume, faturamento consolidado, capacidade dedicada ou um acordo de tratamento de dados. Sua mensagem chega a um engenheiro, não a uma fila, e você recebe uma resposta de verdade em um dia útil.',
    email: 'E-mail',
    responseTime: 'Tempo de resposta',
    responseValue: 'Em até um dia útil',
    timezones: 'Fusos horários',
    timezonesValue: 'Europa e Américas',
    name: 'Nome',
    namePlaceholder: 'Seu nome',
    workEmail: 'E-mail corporativo',
    message: 'Mensagem',
    messagePlaceholder: 'Conte sobre seu time, volume e prazo.',
    received: 'Recebido. Um engenheiro vai responder em até um dia útil.',
    failed: 'Não foi possível enviar a mensagem',
    sending: 'Enviando…',
    send: 'Enviar mensagem',
  },
  pt: {
    kicker: 'Contacto',
    title: ['Fale com alguém que ', 'entrega.'],
    lede: 'Preços por volume, faturação consolidada, capacidade dedicada ou um acordo de tratamento de dados. A sua mensagem chega a um engenheiro, não a uma fila, e recebe uma resposta a sério num dia útil.',
    email: 'E-mail',
    responseTime: 'Tempo de resposta',
    responseValue: 'Num dia útil',
    timezones: 'Fusos horários',
    timezonesValue: 'Europa e Américas',
    name: 'Nome',
    namePlaceholder: 'O seu nome',
    workEmail: 'E-mail profissional',
    message: 'Mensagem',
    messagePlaceholder: 'Fale-nos da sua equipa, volume e prazos.',
    received: 'Recebido. Um engenheiro responderá num dia útil.',
    failed: 'Não foi possível enviar a mensagem',
    sending: 'A enviar…',
    send: 'Enviar mensagem',
  },
};

/**
 * Public talk-to-sales form.
 */
export function ContactPage() {
  const t = useT(T);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /**
   * Loads a CSRF token then posts the sales inquiry.
   */
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setStatus('idle');
    try {
      const csrf = await fetchCsrf();
      await submitContact({ name, email, message, csrf });
      setStatus('ok');
      setMessage('');
    } catch (caught) {
      setStatus('err');
      setError(caught instanceof ApiError ? caught.message : t.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page">
      <div className={styles.contact}>
        <aside className={styles.contactAside}>
          <header className={styles.pageHero} style={{ padding: 0 }}>
            <p className="kicker fade-up">{t.kicker}</p>
            <h1 className={`${styles.title} fade-up`} style={{ ['--delay' as string]: '80ms' }}>
              {t.title[0]}<span className="serif">{t.title[1]}</span>
            </h1>
            <p className="lede fade-up" style={{ ['--delay' as string]: '160ms' }}>
              {t.lede}
            </p>
          </header>
          <div className={`${styles.contactList} fade-up`} style={{ ['--delay' as string]: '240ms' }}>
            <div className={styles.contactItem}>
              <span>{t.email}</span>
              <a href="mailto:sales@faelithindustries.com">sales@faelithindustries.com</a>
            </div>
            <div className={styles.contactItem}>
              <span>{t.responseTime}</span>
              <span>{t.responseValue}</span>
            </div>
            <div className={styles.contactItem}>
              <span>{t.timezones}</span>
              <span>{t.timezonesValue}</span>
            </div>
          </div>
        </aside>

        <form
          className={`card fade-up`}
          style={{ ['--delay' as string]: '200ms', padding: 32 }}
          onSubmit={(event) => void onSubmit(event)}
        >
          <label className="field">
            <span>{t.name}</span>
            <input
              autoComplete="name"
              placeholder={t.namePlaceholder}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>{t.workEmail}</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>{t.message}</span>
            <textarea
              placeholder={t.messagePlaceholder}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
            />
          </label>
          {status === 'ok' ? <p className="notice notice-success">{t.received}</p> : null}
          {error ? <p className="notice notice-error">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? t.sending : t.send}
            <Icon name="arrow" size={16} className="arrow" />
          </button>
        </form>
      </div>
    </div>
  );
}
