import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { brl, Plan } from '../billing';
import { Icon } from '../components/Brand';
import Pricing from '../components/Pricing';

interface Me { plan: Plan | null; subscription: { expiresAt: string; installments: number; amount: number } | null; limits: { tier: string; answersPerDay: number | null } }

export default function Subscription() {
  const [me, setMe] = useState<Me | null>(null);
  const [params] = useSearchParams();
  useEffect(() => { api<Me>('/billing/me').then(setMe); }, []);

  return (
    <>
      {params.get('ok') && <div className="notice"><Icon name="spark" size={16} /> Assinatura confirmada. Bons estudos!</div>}
      <div className="page-head">
        <span className="kicker">Assinatura</span>
        <h1>{me?.plan ? <>Você é <em>{me.plan.name}</em></> : <>Escolha seu <em>grau de maestria</em></>}</h1>
        {me && !me.plan && me.limits.tier === 'free' && (
          <p className="muted">Você está no plano gratuito: {me.limits.answersPerDay} questões por dia e flashcards. Assine para liberar simulados, Coruja IA e cronogramas.</p>
        )}
        {me?.subscription && (
          <p className="muted">
            Acesso até {new Date(me.subscription.expiresAt).toLocaleDateString('pt-BR')} · {me.subscription.installments}x · total {brl(me.subscription.amount)}
          </p>
        )}
      </div>
      <Pricing currentPlanId={me?.plan?.id} ctaHref={(id) => `/checkout/${id}`} />
    </>
  );
}
