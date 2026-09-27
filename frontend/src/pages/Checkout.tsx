import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { brl, installmentTotal, totalFor } from '../billing';
import { Icon, Logo } from '../components/Brand';
import { usePlans } from '../components/Pricing';

export default function Checkout() {
  const { planId } = useParams();
  const nav = useNavigate();
  const plans = usePlans();
  const plan = plans.find((p) => p.id === planId);
  const [method, setMethod] = useState<'pix' | 'card'>('card');
  const [n, setN] = useState(12);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const options = useMemo(() => (plan ? Array.from({ length: plan.maxInstallments }, (_, i) => i + 1) : []), [plan]);
  if (!plans.length) return <div className="center">Carregando...</div>;
  if (!plan) return <div className="center">Plano não encontrado. <Link to="/planos">Ver planos</Link></div>;

  const installments = method === 'pix' ? 1 : n;
  const total = totalFor(plan, installments);
  const each = Math.round(total / installments);

  async function confirm() {
    setBusy(true); setError('');
    try {
      const r = await api<{ subscriptionId: string; status: string; redirectUrl: string | null }>('/billing/checkout', { body: { planId: plan!.id, paymentMethod: method, installments } });
      if (r.redirectUrl && /^https:\/\/([a-z0-9-]+\.)*mercadopago\.com(\.br)?\//.test(r.redirectUrl)) { window.location.assign(r.redirectUrl); return; }
      nav(`/pagamento/${r.subscriptionId}`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="checkout-page">
      <header className="checkout-top"><Link to="/"><Logo /></Link><Link to="/planos" className="btn btn-text">← Voltar aos planos</Link></header>
      <div className="checkout">
        <section className="card checkout-main">
          <h1>Finalizar assinatura</h1>
          <h3 className="label">Forma de pagamento</h3>
          <div className="pay-methods">
            <button className={method === 'card' ? 'on' : ''} onClick={() => setMethod('card')}>
              <Icon name="card" size={20} /><span><b>Cartão de crédito</b><small>Em até {plan.maxInstallments}x</small></span>
            </button>
            <button className={method === 'pix' ? 'on' : ''} onClick={() => setMethod('pix')}>
              <Icon name="pix" size={20} /><span><b>Pix</b><small>À vista · {brl(plan.cashPrice)}</small></span>
            </button>
          </div>

          {method === 'card' && (
            <>
              <h3 className="label">Parcelamento</h3>
              <div className="installments">
                {options.map((i) => {
                  const t = totalFor(plan, i);
                  return (
                    <label key={i} className={n === i ? 'on' : ''}>
                      <input type="radio" name="n" checked={n === i} onChange={() => setN(i)} />
                      <span><b>{i}x</b> de {brl(Math.round(t / i))}</span>
                      <small>{i === 1 ? 'à vista' : `total ${brl(t)}`}</small>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          <p className="fine"><Icon name="shield" size={14} /> Pagamento processado pelo Mercado Pago. O MedTrouxa não armazena dados do seu cartão.</p>
          {error && <div className="error">{error}</div>}
        </section>

        <aside className="card checkout-summary">
          <span className="kicker">Resumo</span>
          <h2>{plan.name}</h2>
          <p className="muted">{plan.tagline}</p>
          <dl>
            <div><dt>Acesso</dt><dd>{plan.accessYears > 1 ? `${plan.accessYears} anos` : '1 ano'}</dd></div>
            <div><dt>Pagamento</dt><dd>{method === 'pix' ? 'Pix à vista' : installments === 1 ? 'Cartão à vista' : `Cartão em ${installments}x`}</dd></div>
            {installments > 1 && <div><dt>Parcelas</dt><dd>{installments}x de {brl(each)}</dd></div>}
            <div className="total"><dt>Total</dt><dd>{brl(total)}</dd></div>
          </dl>
          {installments > 1 && total > plan.cashPrice && (
            <p className="fine">À vista você economiza {brl(installmentTotal(plan) - plan.cashPrice)}.</p>
          )}
          <button className="btn btn-gold btn-block btn-lg" disabled={busy} onClick={confirm}>
            {busy ? 'Redirecionando...' : 'Ir para o pagamento seguro'}
          </button>
        </aside>
      </div>
    </div>
  );
}
