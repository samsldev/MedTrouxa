import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Consent, inPreview, onConsentChange, readConsent, writeConsent } from '../lib/analytics';
import { Icon } from './Brand';

/** Banner de consentimento de análise (LGPD). Port de faelith_web ConsentBanner. */
export default function ConsentBanner() {
  const { pathname } = useLocation();
  const [consent, setConsent] = useState<Consent>(() => readConsent());
  useEffect(() => onConsentChange(() => setConsent(readConsent())), []);
  const publicPage = !inPreview() && (['/', '/login', '/esqueci-senha', '/termos', '/privacidade'].includes(pathname) || pathname.startsWith('/lp/'));
  if (consent !== null || window.self !== window.top || !publicPage) return null;
  return (
    <div className="consent" role="dialog" aria-labelledby="consent-title" aria-live="polite">
      <span className="consent-icon"><Icon name="shield" size={18} /></span>
      <div className="consent-text">
        <strong id="consent-title">Cookies de análise</strong>
        <p>Medimos como nossas páginas são usadas (visitas, rolagem, cliques) para melhorá-las. Sem o seu consentimento, contamos apenas totais anônimos. Com ele, também ligamos suas visitas por um identificador aleatório. Nunca vendemos esses dados. <a href="/privacidade" className="link">Saiba mais</a></p>
      </div>
      <div className="consent-actions">
        <button type="button" className="btn btn-text" onClick={() => writeConsent('denied')}>Apenas anônimo</button>
        <button type="button" className="btn btn-dark" onClick={() => writeConsent('granted')}>Aceitar</button>
      </div>
    </div>
  );
}
