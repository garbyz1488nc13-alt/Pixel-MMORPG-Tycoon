import { useEffect, useState, type ReactNode } from 'react';

/** Small controlled form fields that commit on change (numbers are clamped). */

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function NumberInput({ value, onChange, min = 0, max = 1e9, step = 1, id }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; id?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (t: string) => {
    const n = parseFloat(t);
    if (Number.isFinite(n)) {
      const c = Math.max(min, Math.min(max, step >= 1 ? Math.round(n) : n));
      if (c !== value) onChange(c);
      setText(String(c));
    } else setText(String(value));
  };
  return (
    <input
      id={id}
      className="input"
      type="number"
      value={text}
      min={min}
      max={max}
      step={step}
      onChange={(e) => { setText(e.target.value); const n = parseFloat(e.target.value); if (Number.isFinite(n) && n >= min && n <= max) onChange(step >= 1 ? Math.round(n) : n); }}
      onBlur={(e) => commit(e.target.value)}
    />
  );
}

export function TextInput({ value, onChange, maxLength = 48, id }: { value: string; onChange: (v: string) => void; maxLength?: number; id?: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      id={id}
      className="input"
      value={text}
      maxLength={maxLength}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text.trim() && text !== value && onChange(text.trim())}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function Select<T extends string>({ value, options, onChange, id }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void; id?: string }) {
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
    </select>
  );
}

/** Generic editable table of rows (inventory, shop, loot). */
export function RowEditor<T extends object>({
  rows, columns, make, onChange, empty,
}: {
  rows: T[];
  columns: { key: keyof T; label: string; type: 'text' | 'number'; min?: number; max?: number; step?: number; width?: number }[];
  make: () => T;
  onChange: (rows: T[]) => void;
  empty: string;
}) {
  const set = (i: number, key: keyof T, v: unknown) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  return (
    <div className="row-editor">
      {rows.length === 0 && <div className="hint">{empty}</div>}
      {rows.length > 0 && (
        <div className="re-row re-head" style={{ gridTemplateColumns: `${columns.map((c) => (c.width ? `${c.width}px` : '1fr')).join(' ')} 28px` }}>
          {columns.map((c) => <span key={String(c.key)}>{c.label}</span>)}
          <span />
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} className="re-row" style={{ gridTemplateColumns: `${columns.map((c) => (c.width ? `${c.width}px` : '1fr')).join(' ')} 28px` }}>
          {columns.map((c) =>
            c.type === 'number' ? (
              <NumberInput key={String(c.key)} value={r[c.key] as number} min={c.min} max={c.max} step={c.step} onChange={(v) => set(i, c.key, v)} />
            ) : (
              <TextInput key={String(c.key)} value={r[c.key] as string} onChange={(v) => set(i, c.key, v)} />
            ),
          )}
          <button className="btn small icon" title="Remove" onClick={() => onChange(rows.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...rows, make()])}>+ Add</button>
    </div>
  );
}
