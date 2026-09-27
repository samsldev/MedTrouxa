import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Icon } from './Brand';

export interface Testimonial {
  id: number; name: string; school?: string; quote: string; specialty?: string; institutions?: string; highlight?: string;
  rating: number; photoUrl?: string; videoUrl?: string; featured: boolean; approved: boolean; isDemo: boolean;
}
interface Stats { questions: number; flashcards: number; students: number; answers: number }

export function useSocial() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<Testimonial[]>([]);
  useEffect(() => {
    api<Stats>('/public/stats').then(setStats).catch(() => undefined);
    api<Testimonial[]>('/public/testimonials').then(setItems).catch(() => undefined);
  }, []);
  return { stats, items };
}

/** "+80 mil" para números grandes; valor exato para pequenos (sempre verdadeiro) */
function compact(n: number) {
  if (n >= 1_000_000) return { prefix: '+', value: Math.floor(n / 100_000) / 10, suffix: ' mi' };
  if (n >= 1_000) return { prefix: '+', value: Math.floor(n / 1_000), suffix: ' mil' };
  return { prefix: '', value: n, suffix: '' };
}

function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(to); return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / 1400);
        setV(to * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  const decimals = to % 1 ? 1 : 0;
  return <span ref={ref}>{v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>;
}

export function StatsStrip({ stats }: { stats: Stats | null }) {
  if (!stats) return null;
  const rows = [
    [stats.questions, 'Questões comentadas'],
    [stats.flashcards, 'Flashcards'],
    [stats.answers, 'Questões resolvidas'],
    [stats.students, 'Estudantes'],
  ] as const;
  return (
    <section className="stats-strip">
      <div className="lp-wrap stats-in">
        <div className="stats-copy" data-reveal>
          <h3>Tudo que você precisa.<br /><em>Em um só lugar.</em></h3>
          <span className="rule" />
        </div>
        <dl className="stats-nums">
          {rows.map(([n, label]) => {
            const c = compact(n);
            return (
              <div key={label} data-reveal>
                <dt>{label}</dt>
                <dd>{c.prefix && <i>{c.prefix}</i>}<CountUp to={c.value} />{c.suffix}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}

function Stars5({ n }: { n: number }) {
  return (
    <span className="stars5" aria-label={`${n} de 5 estrelas`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" width="15" height="15" className={i < n ? 'on' : ''} aria-hidden="true">
          <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8z" />
        </svg>
      ))}
    </span>
  );
}

function Avatar({ t, size = 44 }: { t: Testimonial; size?: number }) {
  const initials = t.name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return t.photoUrl
    ? <img className="t-avatar" src={t.photoUrl} alt="" width={size} height={size} loading="lazy" />
    : <span className="t-avatar initials" style={{ width: size, height: size }}>{initials}</span>;
}

const DemoTag = () => <span className="demo-tag" title="Conteúdo de exemplo, visível apenas em desenvolvimento">Exemplo</span>;

function TestimonialCard({ t, big = false }: { t: Testimonial; big?: boolean }) {
  return (
    <figure className={`t-card ${big ? 'big' : ''}`}>
      <div className="t-top"><Stars5 n={t.rating} />{t.isDemo && <DemoTag />}</div>
      <blockquote>“{t.quote}”</blockquote>
      {big && (t.specialty || t.institutions) && (
        <div className="t-tags">{t.specialty && <span className="pill gold">{t.specialty}</span>}{t.institutions && <span className="pill">{t.institutions}</span>}</div>
      )}
      <figcaption>
        <Avatar t={t} size={big ? 46 : 38} />
        <span>
          <b>{t.name}</b>
          {!big && t.specialty && <small className="gold-txt">{t.specialty}</small>}
          <small>{t.highlight ?? t.school}</small>
        </span>
      </figcaption>
    </figure>
  );
}

function VideoCard({ t, onPlay }: { t: Testimonial; onPlay(): void }) {
  return (
    <article className="v-card">
      <button className="v-thumb" onClick={onPlay} aria-label={`Assistir depoimento de ${t.name}`}>
        {t.photoUrl ? <img src={t.photoUrl} alt="" loading="lazy" /> : <span className="v-ph"><Avatar t={t} size={64} /></span>}
        <span className="v-play"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg></span>
      </button>
      <h4>{t.name}{t.school && <>, <span>{t.school}</span></>}</h4>
      <p>“{t.quote}”</p>
    </article>
  );
}

export function Approvals({ items }: { items: Testimonial[] }) {
  const approved = items.filter((t) => t.approved);
  if (!approved.length) return null;
  const names = approved.map((t) => t.name);
  const row = (offset: number) => {
    const base = [...names.slice(offset), ...names.slice(0, offset)];
    const filled = Array.from({ length: Math.max(12, base.length) }, (_, i) => base[i % base.length]);
    return [...filled, ...filled];
  };
  return (
    <section className="lp-section approvals">
      <div className="lp-wrap center">
        <span className="chip" data-reveal>Aprovados</span>
        <div className="big-count" data-reveal><i>{approved.length >= 100 ? '+' : ''}</i><CountUp to={approved.length} /></div>
        <p className="big-count-label" data-reveal>{approved.length === 1 ? 'aluno aprovado' : 'alunos aprovados'} estudando com o MedTrouxa</p>
        {approved.some((t) => t.isDemo) && <p className="demo-note"><Icon name="spark" size={13} /> Nomes de exemplo — visíveis só em desenvolvimento</p>}
      </div>
      <div className="names" aria-label="Alunos aprovados">
        {[0, Math.floor(names.length / 2)].map((off, r) => (
          <div key={r} className={`names-track ${r ? 'rev' : ''}`}>
            {row(off).map((n, i) => <span key={i}>{n}</span>)}
          </div>
        ))}
      </div>
      <div className="center"><Link to="/login?mode=register" className="btn btn-foil btn-lg">Garantir minha aprovação <Icon name="arrow" size={16} /></Link></div>
    </section>
  );
}

export function Testimonials({ items }: { items: Testimonial[] }) {
  const [playing, setPlaying] = useState<Testimonial | null>(null);
  if (!items.length) return null;
  const featured = items.filter((t) => t.featured).slice(0, 3);
  const rest = items.filter((t) => !featured.includes(t));
  const videos = items.filter((t) => t.videoUrl);
  const loop = rest.length ? [...rest, ...rest] : [];

  return (
    <section className="lp-section testimonials">
      <div className="lp-wrap">
        <div className="section-head center" data-reveal>
          <span className="kicker">Depoimentos</span>
          <h2>Quem estuda, <em>conta</em>.</h2>
          <p className="lede">Histórias de quem transformou a rotina de estudos com o MedTrouxa.</p>
        </div>
        {featured.length > 0 && (
          <div className="t-featured">{featured.map((t) => <div key={t.id} data-reveal><TestimonialCard t={t} big /></div>)}</div>
        )}
      </div>
      {loop.length > 0 && (
        <div className="t-marquee" aria-label="Mais depoimentos">
          <div className="t-track">{loop.map((t, i) => <TestimonialCard key={`${t.id}-${i}`} t={t} />)}</div>
        </div>
      )}
      {videos.length > 0 && (
        <div className="lp-wrap">
          <h3 className="v-title" data-reveal>Depoimentos em vídeo</h3>
          <div className="v-row">{videos.map((t) => <VideoCard key={t.id} t={t} onPlay={() => setPlaying(t)} />)}</div>
        </div>
      )}
      <div className="center t-cta"><Link to="/login?mode=register" className="btn btn-dark btn-lg">Comece sua jornada <Icon name="arrow" size={16} /></Link></div>

      {playing && (
        <div className="modal" role="dialog" aria-modal="true" aria-label={`Depoimento de ${playing.name}`} onClick={() => setPlaying(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-x" onClick={() => setPlaying(null)} aria-label="Fechar">×</button>
            <video src={playing.videoUrl} controls autoPlay playsInline />
          </div>
        </div>
      )}
    </section>
  );
}
