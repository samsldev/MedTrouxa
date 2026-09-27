import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Icon, Logo } from '../components/Brand';

interface Sub { id: string; status: 'pending' | 'active' | 'failed' | 'canceled'; planId: string; expiresAt: string | null }

/** Retorno do Mercado Pago: acompanha a confirmação (feita pelo webhook no servidor). */
export default function PaymentReturn() {
  const { id } = useParams();
  const [sub, setSub] = useState<Sub | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      const s = await api<Sub>(`/billing/subscriptions/${id}`).catch(() => null);
      if (!alive) return;
      setSub(s);
      if (s?.status === 'pending' && tries < 40) setTimeout(() => setTries((t) => t + 1), 3000);
    };
    poll();
    return () => { alive = false; };
  }, [id, tries]);

  const view = {
    active: ['spark', 'Assinatura confirmada', 'Seu acesso já está liberado. Bons estudos!'],
    pending: ['timer', 'Aguardando confirmação', 'Assim que o pagamento for aprovado, liberamos seu acesso automaticamente. No Pix, isso leva poucos segundos.'],
    failed: ['lock', 'Pagamento não aprovado', 'Nenhum valor foi cobrado. Você pode tentar novamente com outra forma de pagamento.'],
    canceled: ['lock', 'Assinatura cancelada', 'Este pagamento foi estornado ou cancelado.'],
  }[sub?.status ?? 'pending'];

  return (
    <div className="checkout-page">
      <header className="checkout-top"><Link to="/"><Logo /></Link></header>
      <main className="lp-wrap narrow center payment-return">
        <span className={`pr-icon ${sub?.status ?? 'pending'}`}><Icon name={view[0]} size={28} /></span>
        <h1>{view[1]}</h1>
        <p className="lede">{view[2]}</p>
        <div className="row center-row">
          {sub?.status === 'active' ? <Link to="/inicio" className="btn btn-foil btn-lg">Começar a estudar</Link>
            : <Link to="/planos" className="btn btn-outline btn-lg">Voltar aos planos</Link>}
        </div>
      </main>
    </div>
  );
}
