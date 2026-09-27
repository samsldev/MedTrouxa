/**
 * @fileoverview Public download page with a tabbed install block and next-step cards.
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
 * - Unix and Windows PowerShell installers behind a tab switch
 * - One-click copy with transient confirmation
 * - Three-step onboarding strip and disabled Desktop/Mobile placeholders
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icons';
import { Reveal } from '../../components/Reveal';
import { HTML_LANG, useLocale, useT, type Dict } from '../../lib/i18n';
import {
  RELEASES_URL,
  detectPlatform,
  fetchLatestRelease,
  formatSize,
  type LatestRelease,
  type Platform as AppPlatform,
} from '../../lib/releases';
import styles from './Marketing.module.css';

type Platform = 'unix' | 'windows';

const APP_LABELS: Record<AppPlatform, string> = { macos: 'macOS', windows: 'Windows', linux: 'Linux' };
const APP_ORDER: AppPlatform[] = ['macos', 'windows', 'linux'];

const COMMANDS: Record<Platform, { label: string; command: string }> = {
  unix: { label: 'macOS / Linux', command: 'curl -fsSL https://get.faelithindustries.com | sh' },
  windows: { label: 'Windows PowerShell', command: 'irm https://get.faelithindustries.com/install.ps1 | iex' },
};

interface DownloadStrings {
  requirement: Record<AppPlatform, string>;
  note: Record<AppPlatform, string>;
  hints: Record<Platform, string>;
  steps: { title: string; body: string }[];
  desktopTabs: string;
  platformTabs: string;
  lookingUp: string;
  githubDown: string;
  releasesPage: string;
  firstRelease: string;
  noBundle: (platform: string, version: string) => string;
  requires: string;
  verify: string;
  checksums: string;
  checksumsNote: string;
  releaseNotes: string;
  whatChanged: string;
  kicker: string;
  title: [string, string, string];
  lede: string;
  cliKicker: string;
  cliTitle: [string, string];
  cliLede: string;
  copied: string;
  copy: string;
  step: (n: number) => string;
  otherKicker: string;
  otherTitle: [string, string, string];
  otherLede: string;
  webChat: string;
  webChatBody: string;
  openChat: string;
  afterSignIn: string;
  mobile: string;
  mobileBody: string;
}

const T: Dict<DownloadStrings> = {
  en: {
    requirement: { macos: 'macOS 12 Monterey or later', windows: 'Windows 10 (1809) or later, 64-bit', linux: 'glibc 2.35+ (Ubuntu 22.04, Fedora 38 or newer)' },
    note: {
      macos: 'Pick Apple Silicon for M-series Macs. First launch: right-click the app and choose Open.',
      windows: 'The .msi is best for managed installs; the setup .exe supports per-user install. WebView2 is downloaded if missing.',
      linux: 'AppImage runs anywhere after chmod +x. The .deb and .rpm register the app in your launcher.',
    },
    hints: { unix: 'Installs to ~/.faelith/bin and adds it to your PATH.', windows: 'Installs to %LOCALAPPDATA%\\Faelith and updates the user PATH.' },
    steps: [
      { title: 'Install', body: 'Paste the one-liner. Thirty seconds, no package manager, no sudo.' },
      { title: 'Connect', body: 'Run faelith. The onboarding wizard picks your theme and takes the API key from your dashboard once.' },
      { title: 'Ship', body: 'Type the task. Watch it read, edit, and test. Review the diff. Commit.' },
    ],
    desktopTabs: 'Desktop platform',
    platformTabs: 'Platform',
    lookingUp: 'Looking up the latest release...',
    githubDown: 'Could not reach GitHub right now. Browse the installers on the',
    releasesPage: 'releases page',
    firstRelease: 'The first desktop release is being prepared. Installers for macOS, Windows and Linux will appear here automatically; until then follow the',
    noBundle: (platform, version) => `No ${platform} bundle in v${version} yet.`,
    requires: 'REQUIRES',
    verify: 'VERIFY',
    checksums: 'SHA-256 checksums',
    checksumsNote: 'Every release ships SHA256SUMS.txt next to the installers.',
    releaseNotes: 'RELEASE NOTES',
    whatChanged: 'What changed in this version',
    kicker: 'Download',
    title: ['Faelith for your ', 'desktop', ' and terminal.'],
    lede: 'The Faelith App brings Chat and Code to macOS, Windows and Linux with the same account, models and keys. Prefer the terminal? The CLI is a single static binary, installed in one line.',
    cliKicker: 'Command line',
    cliTitle: ['From zero to agent in ', 'one line.'],
    cliLede: 'No runtime, no package manager, no dependency it can break. Works on macOS, Linux, WSL and Windows.',
    copied: 'Copied',
    copy: 'Copy',
    step: (n) => `STEP 0${n}`,
    otherKicker: 'Other clients',
    otherTitle: ['One account, ', 'every', ' surface.'],
    otherLede: 'Chat also runs in the browser from your dashboard. Mobile is on the way.',
    webChat: 'Web Chat',
    webChatBody: 'The same Faelith Chat as the desktop app, in your browser.',
    openChat: 'Open Chat',
    afterSignIn: 'after signing in.',
    mobile: 'Mobile',
    mobileBody: 'Watch agents work, read the diff, and approve the merge from wherever you are.',
  },
  br: {
    requirement: { macos: 'macOS 12 Monterey ou mais recente', windows: 'Windows 10 (1809) ou mais recente, 64 bits', linux: 'glibc 2.35+ (Ubuntu 22.04, Fedora 38 ou mais recente)' },
    note: {
      macos: 'Escolha Apple Silicon para Macs com chip M. Na primeira abertura: clique com o botão direito no app e escolha Abrir.',
      windows: 'O .msi é o melhor para instalações gerenciadas; o setup .exe permite instalar só para o seu usuário. O WebView2 é baixado se estiver faltando.',
      linux: 'O AppImage roda em qualquer lugar depois do chmod +x. O .deb e o .rpm registram o app no seu menu.',
    },
    hints: { unix: 'Instala em ~/.faelith/bin e adiciona ao seu PATH.', windows: 'Instala em %LOCALAPPDATA%\\Faelith e atualiza o PATH do usuário.' },
    steps: [
      { title: 'Instale', body: 'Cole a linha de comando. Trinta segundos, sem gerenciador de pacotes, sem sudo.' },
      { title: 'Conecte', body: 'Rode faelith. O assistente inicial escolhe seu tema e faz o login uma única vez.' },
      { title: 'Entregue', body: 'Digite a tarefa. Veja ele ler, editar e testar. Revise o diff. Faça o commit.' },
    ],
    desktopTabs: 'Plataforma desktop',
    platformTabs: 'Plataforma',
    lookingUp: 'Buscando a versão mais recente...',
    githubDown: 'Não foi possível acessar o GitHub agora. Veja os instaladores na',
    releasesPage: 'página de versões',
    firstRelease: 'A primeira versão desktop está sendo preparada. Os instaladores para macOS, Windows e Linux vão aparecer aqui automaticamente; até lá, acompanhe a',
    noBundle: (platform, version) => `Ainda não há pacote para ${platform} na v${version}.`,
    requires: 'REQUISITOS',
    verify: 'VERIFICAR',
    checksums: 'Checksums SHA-256',
    checksumsNote: 'Toda versão vem com um SHA256SUMS.txt ao lado dos instaladores.',
    releaseNotes: 'NOTAS DA VERSÃO',
    whatChanged: 'O que mudou nesta versão',
    kicker: 'Download',
    title: ['Faelith no seu ', 'desktop', ' e no terminal.'],
    lede: 'O Faelith App leva o Chat e o Code para macOS, Windows e Linux com a mesma conta, os mesmos modelos e as mesmas chaves. Prefere o terminal? A CLI é um único binário estático, instalado com uma linha.',
    cliKicker: 'Linha de comando',
    cliTitle: ['Do zero ao agente em ', 'uma linha.'],
    cliLede: 'Sem runtime, sem gerenciador de pacotes, sem dependência para quebrar. Funciona em macOS, Linux, WSL e Windows.',
    copied: 'Copiado',
    copy: 'Copiar',
    step: (n) => `PASSO 0${n}`,
    otherKicker: 'Outros clientes',
    otherTitle: ['Uma conta, ', 'todas', ' as ferramentas.'],
    otherLede: 'O Chat também roda no navegador, pelo seu painel. O app mobile está a caminho.',
    webChat: 'Chat na web',
    webChatBody: 'O mesmo Faelith Chat do app desktop, no seu navegador.',
    openChat: 'Abra o Chat',
    afterSignIn: 'depois de entrar.',
    mobile: 'Mobile',
    mobileBody: 'Acompanhe os agentes trabalhando, leia o diff e aprove o merge de onde estiver.',
  },
  pt: {
    requirement: { macos: 'macOS 12 Monterey ou mais recente', windows: 'Windows 10 (1809) ou mais recente, 64 bits', linux: 'glibc 2.35+ (Ubuntu 22.04, Fedora 38 ou mais recente)' },
    note: {
      macos: 'Escolha Apple Silicon para Macs com chip M. No primeiro arranque: clique com o botão direito na aplicação e escolha Abrir.',
      windows: 'O .msi é o melhor para instalações geridas; o setup .exe permite instalar apenas para o seu utilizador. O WebView2 é transferido se faltar.',
      linux: 'O AppImage funciona em qualquer lado depois do chmod +x. O .deb e o .rpm registam a aplicação no seu menu.',
    },
    hints: { unix: 'Instala em ~/.faelith/bin e adiciona-o ao seu PATH.', windows: 'Instala em %LOCALAPPDATA%\\Faelith e atualiza o PATH do utilizador.' },
    steps: [
      { title: 'Instale', body: 'Cole a linha de comando. Trinta segundos, sem gestor de pacotes, sem sudo.' },
      { title: 'Ligue', body: 'Execute faelith. O assistente inicial escolhe o seu tema e inicia a sessão uma única vez.' },
      { title: 'Entregue', body: 'Escreva a tarefa. Veja-o ler, editar e testar. Reveja o diff. Faça o commit.' },
    ],
    desktopTabs: 'Plataforma desktop',
    platformTabs: 'Plataforma',
    lookingUp: 'A procurar a versão mais recente...',
    githubDown: 'Não foi possível contactar o GitHub agora. Veja os instaladores na',
    releasesPage: 'página de versões',
    firstRelease: 'A primeira versão desktop está a ser preparada. Os instaladores para macOS, Windows e Linux vão aparecer aqui automaticamente; até lá, acompanhe a',
    noBundle: (platform, version) => `Ainda não há pacote para ${platform} na v${version}.`,
    requires: 'REQUISITOS',
    verify: 'VERIFICAR',
    checksums: 'Checksums SHA-256',
    checksumsNote: 'Todas as versões incluem um SHA256SUMS.txt junto dos instaladores.',
    releaseNotes: 'NOTAS DA VERSÃO',
    whatChanged: 'O que mudou nesta versão',
    kicker: 'Transferir',
    title: ['Faelith no seu ', 'desktop', ' e no terminal.'],
    lede: 'A Faelith App leva o Chat e o Code para macOS, Windows e Linux com a mesma conta, os mesmos modelos e as mesmas chaves. Prefere o terminal? A CLI é um único binário estático, instalado com uma linha.',
    cliKicker: 'Linha de comandos',
    cliTitle: ['Do zero ao agente numa ', 'só linha.'],
    cliLede: 'Sem runtime, sem gestor de pacotes, sem dependências que se possam partir. Funciona em macOS, Linux, WSL e Windows.',
    copied: 'Copiado',
    copy: 'Copiar',
    step: (n) => `PASSO 0${n}`,
    otherKicker: 'Outros clientes',
    otherTitle: ['Uma conta, ', 'todas', ' as ferramentas.'],
    otherLede: 'O Chat também funciona no navegador, a partir do seu painel. A aplicação móvel vem a caminho.',
    webChat: 'Chat na web',
    webChatBody: 'O mesmo Faelith Chat da aplicação desktop, no seu navegador.',
    openChat: 'Abra o Chat',
    afterSignIn: 'depois de iniciar sessão.',
    mobile: 'Móvel',
    mobileBody: 'Acompanhe os agentes a trabalhar, leia o diff e aprove o merge onde quer que esteja.',
  },
};

/**
 * Copies an install command and ignores clipboard failures in insecure contexts.
 */
async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // Clipboard can be unavailable on insecure origins; the command remains visible.
  }
}

type ReleaseState = { status: 'loading' } | { status: 'ready'; release: LatestRelease | null } | { status: 'error' };

/**
 * Desktop installers block. Reads the latest GitHub Release and lists the
 * bundles for the selected platform; before the first release it points to
 * the releases page instead of showing an empty list.
 */
function DesktopDownloads({ t }: { t: DownloadStrings }) {
  const { locale } = useLocale();
  const [state, setState] = useState<ReleaseState>({ status: 'loading' });
  const [platform, setPlatform] = useState<AppPlatform>(() => detectPlatform());

  useEffect(() => {
    let cancelled = false;
    fetchLatestRelease()
      .then((release) => {
        if (!cancelled) setState({ status: 'ready', release });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const release = state.status === 'ready' ? state.release : null;
  const installers = release?.installers.filter((entry) => entry.platform === platform) ?? [];
  const releasesLink = (
    <a href={RELEASES_URL} target="_blank" rel="noreferrer">
      {t.releasesPage}
    </a>
  );

  return (
    <Reveal className={styles.install}>
      <div className={styles.tabs} role="tablist" aria-label={t.desktopTabs}>
        {APP_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={platform === id}
            className={`${styles.tab} ${platform === id ? styles.tabActive : ''}`}
            onClick={() => setPlatform(id)}
          >
            {APP_LABELS[id]}
          </button>
        ))}
        {release && (
          <span className={styles.releaseMeta}>
            v{release.version}
            <span aria-hidden="true"> · </span>
            {new Date(release.publishedAt).toLocaleDateString(HTML_LANG[locale], { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
      <div className={styles.installBody}>
        {state.status === 'loading' && <p className="muted">{t.lookingUp}</p>}
        {state.status === 'error' && (
          <p className="muted">
            {t.githubDown} {releasesLink}.
          </p>
        )}
        {state.status === 'ready' && !release && (
          <p className="muted">
            {t.firstRelease} {releasesLink}.
          </p>
        )}
        {release && installers.length === 0 && <p className="muted">{t.noBundle(APP_LABELS[platform], release.version)}</p>}
        {installers.length > 0 && (
          <div className={styles.assetGrid}>
            {installers.map((entry) => (
              <a key={entry.url} className={styles.asset} href={entry.url}>
                <span className={styles.assetLabel}>
                  <Icon name="arrow" size={14} />
                  {entry.label}
                </span>
                <span className={styles.assetMeta}>
                  {entry.arch}
                  {entry.sizeBytes ? ` · ${formatSize(entry.sizeBytes)}` : ''}
                </span>
              </a>
            ))}
          </div>
        )}
        <div className={styles.installSteps}>
          <div className={styles.step}>
            <span className={styles.stepIndex}>{t.requires}</span>
            <strong>{t.requirement[platform]}</strong>
            <span>{t.note[platform]}</span>
          </div>
          <div className={styles.step}>
            <span className={styles.stepIndex}>{t.verify}</span>
            <strong>{t.checksums}</strong>
            <span>{release?.checksumsUrl ? <a href={release.checksumsUrl}>SHA256SUMS.txt</a> : t.checksumsNote}</span>
          </div>
          <div className={styles.step}>
            <span className={styles.stepIndex}>{t.releaseNotes}</span>
            <strong>{release ? `Faelith ${release.tag}` : 'Changelog'}</strong>
            <span>
              <a href={release?.notesUrl ?? '/changelog'} target={release ? '_blank' : undefined} rel="noreferrer">
                {t.whatChanged}
              </a>
            </span>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/**
 * Public download page: desktop installers first, then the CLI one-liners.
 */
export function DownloadPage() {
  const t = useT(T);
  const [platform, setPlatform] = useState<Platform>('unix');
  const [copied, setCopied] = useState(false);
  const active = COMMANDS[platform];

  /**
   * Copies the active command and shows a short confirmation.
   */
  async function onCopy() {
    await copyText(active.command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  /**
   * Switches the platform tab and resets the copy confirmation.
   */
  function onSelect(next: Platform) {
    setPlatform(next);
    setCopied(false);
  }

  return (
    <div className="page">
      <header className={styles.pageHero}>
        <p className="kicker fade-up">{t.kicker}</p>
        <h1 className={`${styles.title} fade-up`} style={{ ['--delay' as string]: '80ms' }}>
          {t.title[0]}<span className="serif">{t.title[1]}</span>{t.title[2]}
        </h1>
        <p className="lede fade-up" style={{ ['--delay' as string]: '160ms' }}>
          {t.lede}
        </p>
      </header>

      <DesktopDownloads t={t} />

      <Reveal className="section-head">
        <p className="kicker">{t.cliKicker}</p>
        <h2 className="section-title">
          {t.cliTitle[0]}<span className="serif">{t.cliTitle[1]}</span>
        </h2>
        <p className="lede">{t.cliLede}</p>
      </Reveal>

      <Reveal className={styles.install}>
        <div className={styles.tabs} role="tablist" aria-label={t.platformTabs}>
          {(Object.keys(COMMANDS) as Platform[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={platform === key}
              className={`${styles.tab} ${platform === key ? styles.tabActive : ''}`}
              onClick={() => onSelect(key)}
            >
              {COMMANDS[key].label}
            </button>
          ))}
        </div>
        <div className={styles.installBody}>
          <pre className={styles.pre}>
            <code>{active.command}</code>
            <button type="button" className={`btn btn-ghost btn-sm ${styles.copyBtn}`} onClick={() => void onCopy()}>
              <Icon name={copied ? 'check' : 'copy'} size={14} />
              {copied ? t.copied : t.copy}
            </button>
          </pre>
          <p className="muted" style={{ fontSize: 13.5 }}>
            {t.hints[platform]}
          </p>
          <div className={styles.installSteps}>
            {t.steps.map((step, index) => (
              <div key={step.title} className={styles.step}>
                <span className={styles.stepIndex}>{t.step(index + 1)}</span>
                <strong>{step.title}</strong>
                <span>{step.body}</span>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal className="section-head">
        <p className="kicker">{t.otherKicker}</p>
        <h2 className="section-title">
          {t.otherTitle[0]}<span className="serif">{t.otherTitle[1]}</span>{t.otherTitle[2]}
        </h2>
        <p className="lede">{t.otherLede}</p>
      </Reveal>
      <div className="grid grid-2">
        <Reveal className="card">
          <h3>{t.webChat}</h3>
          <p>
            {t.webChatBody} <a href="/app/chat">{t.openChat}</a> {t.afterSignIn}
          </p>
        </Reveal>
        <Reveal delay={80} className={`card coming-soon ${styles.disabledCard}`}>
          <h3>{t.mobile}</h3>
          <p>{t.mobileBody}</p>
        </Reveal>
      </div>
    </div>
  );
}
