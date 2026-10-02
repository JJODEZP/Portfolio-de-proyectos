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
