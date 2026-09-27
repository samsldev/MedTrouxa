import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface Row { position: number; name: string; university: string | null; xp: number; me: boolean }

export default function Ranking() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => { api<Row[]>('/stats/ranking').then(setRows); }, []);
  const medal = (p: number) => <span className={`medal m${p}`}>{p}</span>;
  return (
    <>
      <div className="page-head"><span className="kicker">Comunidade</span><h1>Ranking de XP</h1></div>
      <p className="muted">Acerto = 10 XP · questão respondida = 2 XP · card revisado = 2 XP · tarefa do cronograma = 5 XP</p>
      <table className="table">
        <thead><tr><th>#</th><th>Estudante</th><th>Faculdade</th><th>XP</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.position} className={r.me ? 'me-row' : ''}>
              <td>{medal(r.position)}</td><td>{r.name}</td><td>{r.university ?? '—'}</td><td><b>{r.xp}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
