/**
 * @fileoverview Labeled input for 6-digit one-time codes and backup codes.
 * @author Samuel S. L.
 * @version 1.0.0
 * @since 2026-09-23
 * @copyright (c) 2026 Samuel S. L. All rights reserved.
 * All information contained herein is, and remains, the property of
 * Samuel S. L. and its suppliers, if any.
 *
 * The intellectual, technical, creative, and software concepts contained
 * herein are proprietary to Samuel S. L. and its suppliers and
 * are protected by copyright law, trade secret law, and other applicable
 * intellectual property laws in the Netherlands, the European Union, and
 * other foreign jurisdictions.
 *
 * Where applicable, such rights may be registered, recorded, or protected
 * with the competent authorities of the Government of the Netherlands,
 * the European Union, and/or other relevant jurisdictions.
 *
 * Dissemination of this information, reproduction of this material,
 * modification, distribution, disclosure, or commercial use is strictly
 * forbidden unless prior written permission is obtained from
 * Samuel S. L.
 *
 * @commercialUse Commercial use permitted only with prior written permission from Samuel S. L.
 *
 * DETAILED_DESCRIPTION:
 * - Numeric mode keeps digits only and caps at 6, with one-time-code autofill hints
 * - Backup mode accepts the XXXXX-XXXXX recovery format in upper case
 * - Stateless: the parent owns the value
 */

interface CodeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** `numeric` for emailed/app codes, `backup` for recovery codes. Defaults to numeric. */
  kind?: 'numeric' | 'backup';
  autoFocus?: boolean;
}

/**
 * Filters raw input to the characters a code of `kind` may contain.
 */
function sanitize(raw: string, kind: 'numeric' | 'backup'): string {
  if (kind === 'numeric') {
    return raw.replace(/\D/g, '').slice(0, 6);
  }
  return raw.toUpperCase().replace(/[^0-9A-Z-]/g, '').slice(0, 11);
}

/**
 * Renders a single input tuned for code entry (mobile keyboards, SMS/email autofill).
 */
export function CodeField({ label, value, onChange, kind = 'numeric', autoFocus = false }: CodeFieldProps) {
  const numeric = kind === 'numeric';
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="code-input"
        value={value}
        onChange={(event) => onChange(sanitize(event.target.value, kind))}
        inputMode={numeric ? 'numeric' : 'text'}
        autoComplete={numeric ? 'one-time-code' : 'off'}
        autoCapitalize="characters"
        spellCheck={false}
        placeholder={numeric ? '000000' : 'XXXXX-XXXXX'}
        autoFocus={autoFocus}
        required
      />
    </label>
  );
}
