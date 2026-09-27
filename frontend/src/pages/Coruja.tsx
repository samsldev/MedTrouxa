import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

interface Msg { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Resuma o manejo da cetoacidose diabética',
  'Diferença entre sensibilidade e especificidade com exemplo',
  'Quais as pegadinhas de prova sobre pré-eclâmpsia?',
];

export default function Coruja() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs]);

  async function send(content: string) {
    if (!content.trim() || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content }];
    setMsgs(next); setText(''); setBusy(true);
    try {
      const { reply } = await api<{ reply: string }>('/ai/chat', { body: { messages: next.slice(-20) } });
      setMsgs([...next, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMsgs([...next, { role: 'assistant', content: `${(e as Error).message}` }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="chat">
      <div className="page-head"><span className="kicker">Coruja IA</span><h1>Sua tutora de <em>medicina</em></h1></div>
      <div className="chat-log card">
        {msgs.length === 0 && (
          <div className="center">
            <p className="muted">Pergunte qualquer coisa: resumos, condutas, pegadinhas de prova...</p>
            {SUGGESTIONS.map((s) => <button key={s} className="ghost" onClick={() => send(s)}>{s}</button>)}
          </div>
        )}
        {msgs.map((m, i) => <div key={i} className={`bubble ${m.role}`}>{m.content}</div>)}
        {busy && <div className="bubble assistant muted">pensando...</div>}
        <div ref={end} />
      </div>
      <form className="row" onSubmit={(e: FormEvent) => { e.preventDefault(); send(text); }}>
        <input placeholder="Digite sua dúvida..." value={text} onChange={(e) => setText(e.target.value)} />
        <button className="primary" disabled={busy}>Enviar</button>
      </form>
      <small className="muted">Conteúdo educacional. Não substitui avaliação médica.</small>
    </div>
  );
}
