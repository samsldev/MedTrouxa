import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, isPlanError } from '../api/client';
import Upsell from '../components/Upsell';
import { Icon } from '../components/Brand';

interface Card { id: number; front: string; back: string }
interface Deck { id: number; name: string; ownerId: string | null; cards: Card[] }

const GRADES = [[0, 'Errei', 'bad'], [3, 'Difícil', 'mid'], [4, 'Bom', 'good'], [5, 'Fácil', 'easy']] as const;

export default function DeckReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [queue, setQueue] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [form, setForm] = useState({ front: '', back: '' });
  const [aiText, setAiText] = useState('');
  const [aiMsg, setAiMsg] = useState('');

  const load = () => {
    api<Deck>(`/flashcards/decks/${id}`).then(setDeck);
    api<Card[]>(`/flashcards/decks/${id}/due`).then(setQueue);
  };
  useEffect(load, [id]);

  async function grade(g: number) {
    const card = queue[0];
    await api(`/flashcards/cards/${card.id}/review`, { body: { grade: g } });
    setFlipped(false);
    setReviewed((n) => n + 1);
    setQueue((q) => (g < 3 ? [...q.slice(1), card] : q.slice(1)));
  }

  async function addCard(e: FormEvent) {
    e.preventDefault();
    await api(`/flashcards/decks/${id}/cards`, { body: form });
    setForm({ front: '', back: '' }); load();
  }

  async function removeCard(c: Card) {
    if (!confirm('Apagar este card? O histórico de revisão dele também será apagado.')) return;
    try {
      await api(`/flashcards/cards/${c.id}`, { method: 'DELETE' });
      setDeck((d) => d && { ...d, cards: d.cards.filter((x) => x.id !== c.id) });
      setQueue((q) => q.filter((x) => x.id !== c.id));
      if (queue[0]?.id === c.id) setFlipped(false);
    } catch (e) { alert((e as Error).message); }
  }

  async function removeDeck() {
    if (!deck || !confirm(`Apagar o baralho "${deck.name}" e seus ${deck.cards.length} cards? Esta ação não pode ser desfeita.`)) return;
    try { await api(`/flashcards/decks/${deck.id}`, { method: 'DELETE' }); navigate('/flashcards'); }
    catch (e) { alert((e as Error).message); }
  }

  async function generate() {
    setAiMsg('Gerando...');
    try {
      const { cards } = await api<{ cards: { front: string; back: string }[] }>('/ai/flashcards', { body: { text: aiText } });
      for (const c of cards) await api(`/flashcards/decks/${id}/cards`, { body: c });
      setAiMsg(`${cards.length} cards criados pela Coruja`); setAiText(''); load();
    } catch (e) { setAiMsg(isPlanError(e) ? `PLAN:${e.message}` : `${(e as Error).message}`); }
  }

  if (!deck) return <div className="center">Carregando...</div>;
  const card = queue[0];
  const mine = deck.ownerId !== null;

  return (
    <>
      <Link to="/flashcards" className="link">← Baralhos</Link>
      <div className="deck-title mt">
        <h1>{deck.name}</h1>
        {mine && <button type="button" className="btn btn-danger" onClick={removeDeck}><Icon name="trash" size={16} /> Apagar baralho</button>}
      </div>
      <p className="muted">{deck.cards.length} cards · {reviewed} revisados nesta sessão</p>

      {card ? (
        <div className="flash" onClick={() => setFlipped(true)}>
          <div className="flash-face">{flipped ? card.back : card.front}</div>
          {!flipped && <small className="muted">clique para ver a resposta</small>}
        </div>
      ) : (
        <div className="card center">Nenhum card pendente neste baralho. Volte mais tarde!</div>
      )}
      {card && flipped && (
        <div className="grades">
          {GRADES.map(([g, label, cls]) => <button key={g} className={`grade ${cls}`} onClick={() => grade(g)}>{label}</button>)}
        </div>
      )}

      {mine && (
        <div className="grid2">
          <form className="card" onSubmit={addCard}>
            <h3>Novo card</h3>
            <textarea placeholder="Frente (pergunta)" value={form.front} onChange={(e) => setForm({ ...form, front: e.target.value })} required />
            <textarea placeholder="Verso (resposta)" value={form.back} onChange={(e) => setForm({ ...form, back: e.target.value })} required />
            <button className="primary">Adicionar</button>
          </form>
          <div className="card">
            <h3>Gerar cards com a Coruja</h3>
            <textarea rows={6} placeholder="Cole um resumo ou trecho de aula..." value={aiText} onChange={(e) => setAiText(e.target.value)} />
            <button className="primary" disabled={!aiText.trim()} onClick={generate}>Gerar flashcards</button>
            {aiMsg && (aiMsg.startsWith('PLAN:') ? <Upsell message={aiMsg.slice(5)} compact /> : <p className="muted">{aiMsg}</p>)}
          </div>
        </div>
      )}

      {mine && deck.cards.length > 0 && (
        <section className="card card-list">
          <h3>Cards do baralho</h3>
          <ul>
            {deck.cards.map((c) => (
              <li key={c.id}>
                <div><strong>{c.front}</strong><span className="muted">{c.back}</span></div>
                <button type="button" className="icon-btn danger" title="Apagar card" aria-label="Apagar card" onClick={() => removeCard(c)}>
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
