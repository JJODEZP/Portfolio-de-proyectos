import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Etapa, Salud } from '../lib/types';
import { ETAPAS } from '../lib/types';
import { Icon, type IconName } from './Icon';

export function Card({ title, sub, actions, children, className = '', flush }: {
  title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; flush?: boolean;
}) {
  return (
    <section className={`card ${flush ? 'flush' : ''} ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <div>{title && <h2>{title}</h2>}{sub && <p>{sub}</p>}</div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Tile({ label, value, unit, sub, children, hero }: {
  label: ReactNode; value: ReactNode; unit?: string; sub?: ReactNode; children?: ReactNode; hero?: boolean;
}) {
  return (
    <div className={`card tile ${hero ? 'hero' : ''}`}>
      <div className="label">{label}</div>
      <div className="value num">{value}{unit && <small>{unit}</small>}</div>
      {children}
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

// Semáforo: color + ícono + texto (nunca solo color)
const SALUD: Record<Salud, { label: string; color: string; icon: IconName }> = {
  verde: { label: 'En plan', color: 'var(--good)', icon: 'checkCircle' },
  amarillo: { label: 'En riesgo', color: 'var(--warn)', icon: 'alertCircle' },
  rojo: { label: 'Crítico', color: 'var(--crit)', icon: 'xCircle' },
};
export const saludLabel = (s: Salud) => SALUD[s].label;
export const saludColor = (s: Salud) => SALUD[s].color;

export function SaludBadge({ s, label, compact }: { s: Salud | null; label?: string; compact?: boolean }) {
  if (!s) return <span className="badge"><span className="muted">s/d</span></span>;
  const c = SALUD[s];
  return (
    <span className="badge" title={c.label}>
      <Icon name={c.icon} size={13} style={{ color: c.color }} />
      {!compact && (label ?? c.label)}
    </span>
  );
}

export function EtapaBadge({ etapa }: { etapa: Etapa }) {
  const i = ETAPAS.indexOf(etapa);
  return (
    <span className="badge">
      <span className="dot" style={{ background: `var(--st${i + 1})` }} />
      {etapa}
    </span>
  );
}

export function Meter({ value, max = 100, soft, mark, label }: { value: number; max?: number; soft?: number; mark?: number; label?: string }) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / (max || 1)) * 100))}%`;
  return (
    <div className="meter" role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      {soft != null && <i className="soft" style={{ width: pct(soft) }} />}
      <i style={{ width: pct(value) }} />
      {mark != null && <span className="mark" style={{ left: pct(mark) }} />}
    </div>
  );
}

export function Field({ label, hint, children, full }: { label: string; hint?: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={`field ${full ? 'full' : ''}`}>
      <span>{label} {hint && <em className="hint">{hint}</em>}</span>
      {children}
    </label>
  );
}

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Cerrar"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map(([v, l]) => (
        <button key={v} role="tab" aria-selected={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Input numérico que permite vacío (→ null) y no pierde el foco al editar. */
export function NumInput({ value, onChange, allowNull, className = 'input', step = 'any', disabled, ...rest }: {
  value: number | null; onChange: (v: number | null) => void; allowNull?: boolean; className?: string; step?: string; disabled?: boolean; 'aria-label'?: string;
}) {
  const [txt, setTxt] = useState(value == null ? '' : String(value));
  useEffect(() => { setTxt(value == null ? '' : String(value)); }, [value]);
  return (
    <input
      {...rest} className={className} type="number" inputMode="decimal" step={step} disabled={disabled} value={txt}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => {
        const v = txt.trim() === '' ? (allowNull ? null : 0) : Number(txt.replace(',', '.'));
        if (v !== null && Number.isNaN(v)) { setTxt(value == null ? '' : String(value)); return; }
        if (v !== value) onChange(v);
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}

// ---------- tooltip global ----------
interface Tip { x: number; y: number; content: ReactNode }
const TipCtx = createContext<{ show: (e: React.MouseEvent, c: ReactNode) => void; hide: () => void } | null>(null);

export function TipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const show = useCallback((e: React.MouseEvent, content: ReactNode) => setTip({ x: e.clientX, y: e.clientY, content }), []);
  const hide = useCallback(() => setTip(null), []);
  const api = useMemo(() => ({ show, hide }), [show, hide]);
  return (
    <TipCtx.Provider value={api}>
      {children}
      {tip && (
        <div className="tip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 290), top: Math.min(tip.y + 14, window.innerHeight - 140) }}>
          {tip.content}
        </div>
      )}
    </TipCtx.Provider>
  );
}

export function useTip() {
  const t = useContext(TipCtx);
  if (!t) throw new Error('useTip fuera de TipProvider');
  return t;
}
