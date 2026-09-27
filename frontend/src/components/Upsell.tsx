import { Link } from 'react-router-dom';
import { Icon } from './Brand';

/** Aviso elegante quando o recurso não está no plano atual */
export default function Upsell({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div className={`upsell-card ${compact ? 'compact' : ''}`} role="status">
      <span className="upsell-icon"><Icon name="lock" size={18} /></span>
      <div>
        <b>{message}</b>
        {!compact && <p>Assine um plano para liberar agora. Em até 12x no cartão ou à vista no Pix.</p>}
      </div>
      <Link to="/planos" className="btn btn-foil">Ver planos</Link>
    </div>
  );
}
