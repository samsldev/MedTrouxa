import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

interface Deck { id: number; name: string; description?: string; ownerId: string | null; cardCount: number; due: number; topic?: { name: string } }

export default function Flashcards() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [name, setName] = useState('');
  const load = () => api<Deck[]>('/flashcards/decks').then(setDecks);
  useEffect(() => { load(); }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api('/flashcards/decks', { body: { name } });
    setName(''); load();
  }

  return (
    <>
      <div className="page-head"><span className="kicker">Memória</span><h1>Flashcards</h1></div>
      <p className="muted">Repetição espaçada (SM-2): cada card volta no momento certo para fixar de vez.</p>
      <form className="row" onSubmit={create}>
        <input placeholder="Nome do novo baralho" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="primary">Criar baralho</button>
      </form>
      <div className="deck-grid">
        {decks.map((d) => (
          <Link key={d.id} to={`/flashcards/${d.id}`} className="card deck">
            <h3>{d.name}</h3>
            <small className="muted">{d.topic?.name ?? (d.ownerId ? 'Meu baralho' : 'Geral')}</small>
            <div className="deck-foot">
              <span>{d.cardCount} cards</span>
              <span className={d.due ? 'due' : ''}>{d.due} para revisar</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
