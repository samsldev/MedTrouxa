import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { brl } from '../billing';
import { Icon, Logo } from '../components/Brand';

interface Sub {
  id: string; status: 'pending' | 'active' | 'failed' | 'canceled'; planId: string; expiresAt: string | null; method: 'pix' | 'card'; installments: number; amount: number;
  message: string | null; pix: { qrCode: string; qrCodeBase64: string | null; ticketUrl: string | null; expiresAt: string | null } | null; pixExpired: boolean;
}

function useCountdown(until: string | null | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!until) return null;
  const left = Math.max(0, new Date(until).getTime() - now);
  return `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
}

/** Acompanha o pagamento: QR do Pix, análise do cartão e confirmação (feita pelo webhook no servidor). */
export default function PaymentReturn() {
  const { id } = useParams();
  const [sub, setSub] = useState<Sub | null>(null);
  const [tick, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [dev, setDev] = useState(false);
  const left = useCountdown(sub?.pix?.expiresAt);

  useEffect(() => { api<{ provider: string }>('/billing/config').then((c) => setDev(c.provider === 'fake')).catch(() => undefined); }, []);
  useEffect(() => {
    let alive = true;
    api<Sub>(`/billing/subscriptions/${id}`).then((s) => {
      if (!alive) return;
      setSub(s);
      if (s.status === 'pending' && !s.pixExpired && tick < 400) setTimeout(() => alive && setTick((t) => t + 1), 3000);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [id, tick]);

  async function copy() {
    if (!sub?.pix) return;
    try { await navigator.clipboard.writeText(sub.pix.qrCode); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* sem permissão */ }
  }

  const pixOpen = sub?.status === 'pending' && sub.pix;
  const view = !sub ? ['timer', 'Carregando…', ''] : sub.status === 'active'
    ? ['spark', 'Assinatura confirmada', 'Seu acesso já está liberado. A nota fiscal chega no seu e-mail. Bons estudos!']
    : sub.status === 'failed' ? ['lock', 'Pagamento não aprovado', `${sub.message ?? ''} Nenhum valor foi cobrado.`]
    : sub.status === 'canceled' ? ['lock', 'Assinatura cancelada', 'Este pagamento foi estornado ou cancelado.']
    : sub.pixExpired ? ['timer', 'O Pix expirou', 'O código venceu sem pagamento. Gere um novo para continuar.']
    : ['timer', 'Pagamento em análise', sub.message ?? 'Assim que for aprovado, liberamos seu acesso automaticamente.'];

  return (
    <div className="checkout-page">
      <header className="checkout-top"><Link to="/"><Logo /></Link><span className="co-secure"><Icon name="lock" size={15} /> Compra 100% segura</span></header>
      <main className="lp-wrap narrow center payment-return">
        {pixOpen ? (
          <div className="card pix-box">
            <span className="kicker">Pague com Pix</span>
            <h1>{brl(sub.amount)}</h1>
            <p className="muted">Abra o app do seu banco, escolha <b>Pix → Ler QR Code</b> ou use o copia-e-cola.</p>
            {sub.pix!.qrCodeBase64 && <img className="pix-qr" src={`data:image/png;base64,${sub.pix!.qrCodeBase64}`} alt="QR Code do Pix" width={240} height={240} />}
            <div className="pix-copy">
              <input readOnly value={sub.pix!.qrCode} aria-label="Código Pix copia-e-cola" onFocus={(e) => e.target.select()} />
              <button className="btn btn-dark" onClick={copy}>{copied ? 'Copiado!' : 'Copiar código'}</button>
            </div>
            <p className="pix-wait"><span className="pulse" /> Aguardando pagamento{left ? ` · expira em ${left}` : ''}</p>
            <p className="fine">Esta página atualiza sozinha: quando o banco confirmar, seu acesso é liberado na hora.</p>
            {dev && <button className="btn btn-outline" onClick={() => api(`/billing/subscriptions/${id}/dev-confirm`, { method: 'POST' }).then(() => setTick((t) => t + 1))}>Simular pagamento (modo de teste)</button>}
          </div>
        ) : (
          <>
            <span className={`pr-icon ${sub?.status ?? 'pending'}`}><Icon name={view[0]} size={28} /></span>
            <h1>{view[1]}</h1>
            <p className="lede">{view[2]}</p>
            <div className="row center-row">
              {sub?.status === 'active' ? <Link to="/inicio" className="btn btn-foil btn-lg">Começar a estudar</Link>
                : sub && (sub.status === 'failed' || sub.pixExpired) ? <Link to={`/checkout/${sub.planId}`} className="btn btn-foil btn-lg">Tentar novamente</Link>
                : <Link to="/planos" className="btn btn-outline btn-lg">Voltar aos planos</Link>}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
