import { ClipboardEvent, KeyboardEvent, useEffect, useRef } from 'react';

/** Campo de código de 6 dígitos: uma casa por dígito, colar o código inteiro, autocompletar do SMS/e-mail. */
export default function OtpInput({ value, onChange, onComplete, disabled, autoFocus = true }: {
  value: string; onChange(v: string): void; onComplete?(v: string): void; disabled?: boolean; autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  useEffect(() => { if (autoFocus) refs.current[0]?.focus(); }, [autoFocus]);

  const set = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
    refs.current[Math.min(clean.length, 5)]?.focus();
  };

  const onInput = (i: number, v: string) => {
    const d = v.replace(/\D/g, '');
    if (!d) return;
    if (d.length > 1) { set(value.slice(0, i) + d); return; } // autocompletar do celular
    set((value.slice(0, i) + d + value.slice(i + 1)).slice(0, 6));
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const idx = digits[i] ? i : Math.max(0, i - 1);
      onChange(value.slice(0, idx) + value.slice(idx + 1));
      refs.current[idx]?.focus();
    } else if (e.key === 'ArrowLeft') refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight') refs.current[i + 1]?.focus();
  };

  const onPaste = (e: ClipboardEvent) => { e.preventDefault(); set(e.clipboardData.getData('text')); };

  return (
    <div className="otp" role="group" aria-label="Código de 6 dígitos" onPaste={onPaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={d}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          pattern="[0-9]*"
          maxLength={6}
          disabled={disabled}
          aria-label={`Dígito ${i + 1}`}
          className={i === 2 ? 'gap-after' : ''}
        />
      ))}
    </div>
  );
}
