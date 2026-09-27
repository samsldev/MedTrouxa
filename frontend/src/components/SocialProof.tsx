import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Icon } from './Brand';
import { retrying } from '../lib/retry';

export interface Testimonial {
  id: number; name: string; school?: string; quote: string; specialty?: string; institutions?: string; highlight?: string;
  rating: number; photoUrl?: string; videoUrl?: string; featured: boolean; approved: boolean; isDemo: boolean;
}
export interface Stats { questions: number; flashcards: number; students: number; answers: number; approved: number; approvedNames: string[] }

export function useSocial() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<Testimonial[]>([]);
  // Números e depoimentos reais vêm da API; se ela falhar, tenta de novo em vez de sumir com a seção
  useEffect(() => retrying(() => api<Stats>('/public/stats'), setStats), []);
  useEffect(() => retrying(() => api<Testimonial[]>('/public/testimonials'), setItems), []);
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

function TestimonialCard({ t, big = false }: { t: Testimonial; big?: boolean }) {
  return (
    <figure className={`t-card ${big ? 'big' : ''}`}>
      <div className="t-top"><Stars5 n={t.rating} /></div>
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
        {t.photoUrl ? <img src={t.photoUrl} alt="" loading="lazy" /> : <span className={`v-ph hue${t.id % 4}`}><Avatar t={t} size={58} /></span>}
        <span className="v-dur">1:{String(10 + (t.id * 7) % 50).padStart(2, '0')}</span>
        <span className="v-play"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg></span>
      </button>
      <h4>{t.name}{t.school && <>, <span>{t.school}</span></>}</h4>
      <p>“{t.quote}”</p>
    </article>
  );
}

export function Approvals({ stats }: { stats: Stats | null }) {
  if (!stats || !stats.approved || !stats.approvedNames.length) return null;
  const names = stats.approvedNames;
  const row = (offset: number) => {
    const base = [...names.slice(offset), ...names.slice(0, offset)];
    const filled = Array.from({ length: Math.max(16, base.length) }, (_, i) => base[i % base.length]);
    return [...filled, ...filled];
  };
  return (
    <section className="lp-section approvals">
      <div className="lp-wrap center">
        <span className="chip" data-reveal>Aprovados ENAMED e residência</span>
        <div className="big-count" data-reveal><i>{stats.approved >= 100 ? '+' : ''}</i><CountUp to={stats.approved} /></div>
        <p className="big-count-label" data-reveal>{stats.approved === 1 ? 'aluno aprovado' : 'alunos aprovados'} estudando com o MedTrouxa</p>
        <p className="big-count-sub" data-reveal>Nossos alunos já conquistaram a vaga usando a plataforma.</p>
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
  const featured = items.filter((t) => t.featured && !t.videoUrl).slice(0, 3);
  const rest = items.filter((t) => !featured.includes(t) && !t.videoUrl);
  const videos = items.filter((t) => t.videoUrl);
  const videoLoop = videos.length ? Array.from({ length: Math.max(2, Math.ceil(8 / videos.length)) * 2 }, () => videos).flat() : [];
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
        <>
          <div className="lp-wrap center v-head" data-reveal>
            <span className="chip">Depoimentos em vídeo</span>
            <h3 className="v-title">O que nossos alunos <em>dizem</em></h3>
          </div>
          <div className="t-marquee v-marquee" aria-label="Depoimentos em vídeo">
            <div className="t-track v-track">{videoLoop.map((t, i) => <VideoCard key={`${t.id}-${i}`} t={t} onPlay={() => setPlaying(t)} />)}</div>
          </div>
        </>
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
