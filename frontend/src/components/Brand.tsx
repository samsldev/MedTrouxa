import { SVGProps } from 'react';

/** Varinha + estrela de quatro pontas: o "feitiço" do MedTrouxa */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="mark">
      <rect width="32" height="32" rx="8" fill="var(--mark-bg)" />
      <path d="M9 23 L20 12" stroke="var(--gold)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M22.5 5.5 L23.6 8.4 L26.5 9.5 L23.6 10.6 L22.5 13.5 L21.4 10.6 L18.5 9.5 L21.4 8.4 Z" fill="var(--gold)" />
      <circle cx="11" cy="9" r="1" fill="var(--gold)" opacity=".7" />
      <circle cx="24" cy="21" r="1.2" fill="var(--gold)" opacity=".5" />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo">
      <Mark size={size} />
      <span className="logo-text">Med<em>Trouxa</em></span>
    </span>
  );
}

const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  questions: 'M9 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9zM9 4v5H4M8 13h8M8 17h5',
  cards: 'M7 3h11a1 1 0 0 1 1 1v13M4 7h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z',
  timer: 'M12 8v5l3 2M9 2h6M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3',
  owl: 'M5 5l3 2h8l3-2v9a7 7 0 0 1-14 0zM9.5 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM14.5 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM12 15l-1-1h2z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5zM5 19h14',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  pix: 'M12 3l4 4-4 4-4-4zM12 13l4 4-4 4-4-4zM3 12l4-4 4 4-4 4zM13 12l4-4 4 4-4 4z',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4',
};

export function Icon({ name, size = 18, ...rest }: { name: keyof typeof PATHS | string; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Céu estrelado sutil (decorativo) */
export function Stars({ className = '' }: { className?: string }) {
  const pts = [[8, 18], [22, 42], [37, 12], [51, 30], [64, 8], [78, 36], [91, 16], [15, 70], [44, 60], [70, 72], [86, 58], [30, 88], [58, 90], [95, 84]];
  return (
    <svg className={`stars ${className}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="8,18 22,42 37,12 51,30 64,8" fill="none" stroke="var(--gold)" strokeWidth=".12" opacity=".35" />
      <polyline points="70,72 86,58 95,84" fill="none" stroke="var(--gold)" strokeWidth=".12" opacity=".35" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 0.35 : 0.55} fill="var(--gold)" opacity={i % 2 ? 0.5 : 0.8} />)}
    </svg>
  );
}
