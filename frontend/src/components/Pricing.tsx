import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { brl, Plan } from '../billing';
import { Icon } from './Brand';

export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  useEffect(() => { api<Plan[]>('/billing/plans').then(setPlans).catch(() => setPlans([])); }, []);
  return plans;
}

export default function Pricing({ currentPlanId, ctaHref }: { currentPlanId?: string | null; ctaHref(id: string): string }) {
  const plans = usePlans();
  const yearly = plans.find((p) => p.id === 'alquimista');

  return (
    <div className="pricing">
      {plans.map((p) => {
        const featured = p.id === 'alquimista';
        const multi = p.accessYears > 1 && yearly;
        const reference = multi ? yearly.cashPrice * p.accessYears : 0;
        const current = currentPlanId === p.id;
        return (
          <article key={p.id} className={`price-card ${featured ? 'featured' : ''} ${p.id}`}>
            <header>
              <div className="price-name">
                <h3>{p.name}</h3>
                {p.badge && <span className="badge">{p.badge}</span>}
              </div>
              <p className="price-tagline">{p.tagline}</p>
            </header>

            <div className="price-value">
              {multi && <s className="strike">{brl(reference)} em {p.accessYears} anos de Alquimista</s>}
              <div className="price-main">
                <small>12x</small><strong>{brl(p.installmentPrice)}</strong>
              </div>
              <div className="price-cash">
                ou <b>{brl(p.cashPrice)}</b> à vista
                {multi && <span className="discount">−{Math.round((1 - p.cashPrice / reference) * 100)}%</span>}
              </div>
              <div className="price-terms">
                {p.accessYears > 1 ? `${p.accessYears} anos de acesso · pagamento único` : '1 ano de acesso · assinatura anual'}
              </div>
              {multi && (
                <div className="price-note">
                  Equivale a <b>{brl(Math.round(p.cashPrice / (p.accessYears * 12)))}</b> por mês de acesso
                </div>
              )}
            </div>

            {current ? (
              <span className="btn btn-block btn-ghost is-static"><Icon name="check" size={16} /> Seu plano atual</span>
            ) : (
              <Link to={ctaHref(p.id)} className={`btn btn-block ${featured ? 'btn-gold' : 'btn-outline'}`}>
                Quero o {p.name}
              </Link>
            )}

            <ul className="price-features">
              {p.features.map((f, i) => (
                <li key={f} className={i === 0 && f.endsWith(':') ? 'lead' : ''}>
                  {!(i === 0 && f.endsWith(':')) && <Icon name="check" size={16} />}
                  {f}
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
