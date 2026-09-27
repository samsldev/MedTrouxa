import { lazy, Suspense, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import AdminNfse from '../components/AdminNfse';
import { get } from '../components/admin/common';

const Overview = lazy(() => import('../components/admin/Overview'));
const Marketing = lazy(() => import('../components/admin/Marketing'));
const Heatmap = lazy(() => import('../components/admin/Heatmap'));
const Visitors = lazy(() => import('../components/admin/Visitors'));
const Subscriptions = lazy(() => import('../components/admin/Subscriptions'));
const Coupons = lazy(() => import('../components/admin/Coupons'));
const Reports = lazy(() => import('../components/admin/Reports'));
const Support = lazy(() => import('../components/admin/Support'));
const Audit = lazy(() => import('../components/admin/Audit'));
const Content = lazy(() => import('../components/admin/Content'));

const TABS = [
  ['overview', 'Visão geral'], ['marketing', 'Marketing'], ['heatmap', 'Mapas de calor'], ['visitors', 'Visitantes'],
  ['subscriptions', 'Assinaturas'], ['coupons', 'Cupons'], ['support', 'Suporte'], ['reports', 'Denúncias'], ['nfse', 'Notas fiscais'], ['content', 'Conteúdo'], ['audit', 'Auditoria'],
] as const;
type Tab = (typeof TABS)[number][0];
const readTab = (): Tab => { const h = location.hash.slice(1); return (TABS.find(([k]) => k === h)?.[0] ?? 'overview'); };

/** Console administrativo (port do console do faelith_web, adaptado ao MedTrouxa). */
export default function Admin() {
  const [tab, setTabState] = useState<Tab>(readTab);
  const [heatPath, setHeatPath] = useState<string | undefined>();
  const [gate, setGate] = useState<'loading' | 'ok' | 'totp' | 'denied'>('loading');
  const setTab = (t: Tab) => { setTabState(t); history.replaceState(null, '', `#${t}`); };

  useEffect(() => {
    const onHash = () => setTabState(readTab());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    get('/admin/me').then(() => setGate('ok')).catch((e) => setGate(e instanceof ApiError && e.code === 'ADMIN_TOTP_REQUIRED' ? 'totp' : 'denied'));
  }, []);

  if (gate === 'loading') return <p className="c-note">Carregando…</p>;
  if (gate !== 'ok') return (
    <div className="card stack">
      <h2>{gate === 'totp' ? 'Ative o 2FA por aplicativo' : 'Acesso negado'}</h2>
      <p className="muted">{gate === 'totp' ? 'O console administrativo exige login com app autenticador. Ative em Conta → Segurança e entre de novo.' : 'Sua conta não tem acesso ao console.'}</p>
    </div>
  );

  return (
    <div className="console">
      <div className="page-head"><span className="kicker">Administração</span><h1>Console <em>MedTrouxa</em></h1></div>
      <nav className="tabs-inline c-tabs" aria-label="Seções do console">
        {TABS.map(([k, label]) => <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>{label}</button>)}
      </nav>
      <Suspense fallback={<p className="c-note">Carregando…</p>}>
        {tab === 'overview' && <Overview />}
        {tab === 'marketing' && <Marketing openHeatmap={(p) => { setHeatPath(p); setTab('heatmap'); }} />}
        {tab === 'heatmap' && <Heatmap key={heatPath} initialPath={heatPath} />}
        {tab === 'visitors' && <Visitors />}
        {tab === 'subscriptions' && <Subscriptions />}
        {tab === 'coupons' && <Coupons />}
        {tab === 'support' && <Support />}
        {tab === 'reports' && <Reports />}
        {tab === 'nfse' && <AdminNfse />}
        {tab === 'content' && <Content />}
        {tab === 'audit' && <Audit />}
      </Suspense>
    </div>
  );
}
