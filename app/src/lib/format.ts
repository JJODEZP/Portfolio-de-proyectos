import { MESES } from './types';

const nf0 = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fMM = (v: number) => nf0.format(Math.round(v));
export const fNum = (v: number, dec = 1) =>
  new Intl.NumberFormat('es-CL', { maximumFractionDigits: dec }).format(v);
export const fSigno = (v: number) => (Math.round(v) > 0 ? '+' : Math.round(v) < 0 ? '−' : '') + nf0.format(Math.abs(Math.round(v)));
export const fPct = (v: number, signo = false) =>
  (signo ? (v > 0.05 ? '+' : v < -0.05 ? '−' : '') : v < 0 ? '−' : '') + nf1.format(Math.abs(v)) + '%';
export const fPct0 = (v: number) => nf0.format(Math.round(v)) + '%';

export function fFecha(iso: string | null | undefined) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${String(y).slice(2)}`;
}

export const fMes = (anio: number, mes: number) => `${MESES[mes - 1]} ${String(anio).slice(2)}`;

export const uid = (prefijo = '') =>
  prefijo + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

/** "hace 5 min", "hace 3 h", "hace 2 d" o la fecha si es más antiguo. */
export function fHace(iso: string, now = Date.now()) {
  const min = Math.round((now - Date.parse(iso)) / 60_000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d <= 14) return `hace ${d} d`;
  return fFecha(iso);
}

export const iniciales = (nombre = '') =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';
