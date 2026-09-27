import { FormEvent, useEffect, useState } from 'react';
import { api, Subject } from '../../api/client';
import { Testimonial } from '../SocialProof';

const emptyQ = { statement: '', A: '', B: '', C: '', D: '', E: '', correctKey: 'A', commentary: '', topicId: '', institution: '', year: '', difficulty: 'medium' };
const emptyT = { name: '', school: '', quote: '', specialty: '', institutions: '', highlight: '', photoUrl: '', videoUrl: '', featured: false, approved: true };

/** Conteúdo: questões e depoimentos. */
export default function Content() {
  const [tab, setTab] = useState<'q' | 't'>('q');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [q, setQ] = useState(emptyQ);
  const [t, setT] = useState(emptyT);
  const [list, setList] = useState<Testimonial[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => { api<Subject[]>('/subjects').then(setSubjects); }, []);
  const loadT = () => api<Testimonial[]>('/public/testimonials/all').then(setList);
  useEffect(() => { if (tab === 't') loadT(); }, [tab]);

  async function saveQ(e: FormEvent) {
    e.preventDefault(); setMsg('');
    const alternatives = (['A', 'B', 'C', 'D', 'E'] as const).filter((k) => q[k].trim()).map((k) => ({ key: k, text: q[k].trim() }));
    try {
      await api('/questions', { body: {
        statement: q.statement, alternatives, correctKey: q.correctKey, commentary: q.commentary, topicId: Number(q.topicId),
        institution: q.institution || undefined, year: q.year ? Number(q.year) : undefined, difficulty: q.difficulty,
      } });
      setQ({ ...emptyQ, topicId: q.topicId, institution: q.institution, year: q.year }); setMsg('Questão cadastrada.');
    } catch (err) { setMsg((err as Error).message); }
  }

  async function saveT(e: FormEvent) {
    e.preventDefault(); setMsg('');
    const body = Object.fromEntries(Object.entries(t).filter(([, v]) => v !== ''));
    try { await api('/public/testimonials', { body }); setT(emptyT); setMsg('Depoimento publicado.'); loadT(); }
    catch (err) { setMsg((err as Error).message); }
  }

  const set = <T extends object>(obj: T, fn: (v: T) => void) => (k: keyof T) => (e: { target: { value: string } }) => fn({ ...obj, [k]: e.target.value });
  const sq = set(q, setQ); const st = set(t, setT);

  return (
    <>
      <div className="tabs-inline">
        <button className={tab === 'q' ? 'on' : ''} onClick={() => setTab('q')}>Questões</button>
        <button className={tab === 't' ? 'on' : ''} onClick={() => setTab('t')}>Depoimentos</button>
      </div>
      {msg && <div className="notice">{msg}</div>}

      {tab === 'q' ? (
        <form className="card stack" onSubmit={saveQ}>
          <h3>Nova questão</h3>
          <div className="row">
            <label>Tema<select value={q.topicId} onChange={sq('topicId')} required>
              <option value="">Selecione</option>
              {subjects.map((s) => <optgroup key={s.id} label={s.name}>{s.topics.map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}</optgroup>)}
            </select></label>
            <label>Banca<input value={q.institution} onChange={sq('institution')} maxLength={80} /></label>
            <label className="narrow">Ano<input type="number" min={1900} max={2100} value={q.year} onChange={sq('year')} /></label>
            <label className="narrow">Dificuldade<select value={q.difficulty} onChange={sq('difficulty')}><option value="easy">Fácil</option><option value="medium">Média</option><option value="hard">Difícil</option></select></label>
          </div>
          <label>Enunciado<textarea rows={5} value={q.statement} onChange={sq('statement')} required minLength={10} /></label>
          {(['A', 'B', 'C', 'D', 'E'] as const).map((k) => (
            <label key={k}>Alternativa {k}{k < 'C' ? ' *' : ''}<input value={q[k]} onChange={sq(k)} required={k < 'C'} /></label>
          ))}
          <div className="row">
            <label className="narrow">Gabarito<select value={q.correctKey} onChange={sq('correctKey')}>{['A', 'B', 'C', 'D', 'E'].map((k) => <option key={k}>{k}</option>)}</select></label>
          </div>
          <label>Comentário<textarea rows={4} value={q.commentary} onChange={sq('commentary')} required /></label>
          <button className="btn btn-dark">Cadastrar questão</button>
        </form>
      ) : (
        <div className="grid2">
          <form className="card stack" onSubmit={saveT}>
            <h3>Novo depoimento</h3>
            <p className="fine">Publique apenas depoimentos reais, com autorização de uso de nome e imagem.</p>
            <div className="row"><label>Nome<input value={t.name} onChange={st('name')} required /></label><label>Faculdade<input value={t.school} onChange={st('school')} /></label></div>
            <label>Depoimento<textarea rows={4} value={t.quote} onChange={st('quote')} required maxLength={600} /></label>
            <div className="row"><label>Especialidade<input value={t.specialty} onChange={st('specialty')} /></label><label>Instituições<input value={t.institutions} onChange={st('institutions')} /></label></div>
            <label>Destaque (ex.: 93 pontos no ENAMED)<input value={t.highlight} onChange={st('highlight')} /></label>
            <div className="row"><label>URL da foto (https)<input type="url" value={t.photoUrl} onChange={st('photoUrl')} /></label><label>URL do vídeo (https)<input type="url" value={t.videoUrl} onChange={st('videoUrl')} /></label></div>
            <label className="check"><input type="checkbox" checked={t.featured} onChange={(e) => setT({ ...t, featured: e.target.checked })} /><span>Destaque (cards grandes)</span></label>
            <label className="check"><input type="checkbox" checked={t.approved} onChange={(e) => setT({ ...t, approved: e.target.checked })} /><span>Conta como aprovado(a) no mural</span></label>
            <button className="btn btn-dark">Publicar</button>
          </form>
          <div className="card">
            <h3>Publicados ({list.length})</h3>
            {list.length === 0 && <p className="muted">Nenhum depoimento real ainda.</p>}
            <ul className="admin-list">
              {list.map((x) => (
                <li key={x.id}>
                  <div><b>{x.name}</b><small>{x.school}{x.videoUrl ? ' · vídeo' : ''}{x.featured ? ' · destaque' : ''}</small></div>
                  <button className="btn btn-text" onClick={async () => { if (confirm(`Remover o depoimento de ${x.name}?`)) { await api(`/public/testimonials/${x.id}`, { method: 'DELETE' }); loadT(); } }}>Remover</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
