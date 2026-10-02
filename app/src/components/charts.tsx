import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fMM } from '../lib/format';
import { useTip } from './ui';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

export interface LineSerie { nombre: string; valores: (number | null)[]; color: string; dashed?: boolean }

/** Línea multi-serie (≤ 3) con eje en cero, crosshair + tooltip y etiquetas directas al final. */
export function LineChart({ labels, series, height = 240, fmt = fMM, unidad = 'MM' }: {
  labels: string[]; series: LineSerie[]; height?: number; fmt?: (v: number) => string; unidad?: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const tip = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const m = { l: 44, r: 64, t: 10, b: 24 };
  const iw = Math.max(10, w - m.l - m.r), ih = height - m.t - m.b;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.valores.filter((v): v is number => v != null))));
  const x = (i: number) => m.l + (labels.length <= 1 ? iw / 2 : (iw * i) / (labels.length - 1));
  const y = (v: number) => m.t + ih - (v / max) * ih;
  const ticks = [0, max / 2, max];

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    const i = Math.max(0, Math.min(labels.length - 1, Math.round(rel * (labels.length - 1))));
    setHover(i);
    tip.show(e, (
      <>
        <b>{labels[i]}</b>
        {series.map((s) => (
          <div className="tr" key={s.nombre}><span><span className="dot" style={{ background: s.color, marginRight: 6 }} />{s.nombre}</span><span>{s.valores[i] == null ? '—' : `${fmt(s.valores[i]!)} ${unidad}`}</span></div>
        ))}
      </>
    ));
  };

  return (
    <div className="chart" ref={ref}>
      <div className="legend">
        {series.map((s) => <span key={s.nombre}><i className={`sw ${s.dashed ? 'dash' : ''}`} style={{ background: s.color }} />{s.nombre}</span>)}
      </div>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={`Gráfico de líneas: ${series.map((s) => s.nombre).join(', ')}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={m.l + iw} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--line)' : 'var(--grid)'} />
              <text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="num">{fmt(t)}</text>
            </g>
          ))}
          {labels.map((l, i) => (labels.length <= 12 || i % 2 === 0) && (
            <text key={l + i} x={x(i)} y={height - 6} textAnchor="middle">{l}</text>
          ))}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ih} stroke="var(--line)" />}
          {/* La primera serie se dibuja al final para quedar encima */}
          {[...series].reverse().map((s) => {
            const pts = s.valores.map((v, i) => (v == null ? null : [x(i), y(v)] as const));
            const segs: string[] = [];
            let cur = '';
            pts.forEach((p) => { if (p) cur += `${cur ? 'L' : 'M'}${p[0]},${p[1]}`; else if (cur) { segs.push(cur); cur = ''; } });
            if (cur) segs.push(cur);
            let last = -1;
            s.valores.forEach((v, i) => { if (v != null) last = i; });
            return (
              <g key={s.nombre}>
                {segs.map((d, k) => <path key={k} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" />)}
                {hover != null && s.valores[hover] != null && (
                  <circle cx={x(hover)} cy={y(s.valores[hover]!)} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                )}
                {last >= 0 && <circle cx={x(last)} cy={y(s.valores[last]!)} r={3.5} fill={s.color} stroke="var(--surface)" strokeWidth={1.5} />}
                {last >= 0 && (
                  <text x={x(last) + 8} y={y(s.valores[last]!) + 4} style={{ fill: 'var(--ink)', fontWeight: 700 }}>{fmt(s.valores[last]!)}</text>
                )}
              </g>
            );
          })}
          <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" onMouseMove={onMove} onMouseLeave={() => { setHover(null); tip.hide(); }} />
        </svg>
      )}
    </div>
  );
}

/** Columnas con eje en cero y colores divergentes (positivo = desfavorable en costos). */
export function DeltaColumns({ labels, valores, height = 200, tooltip, positivoMalo = true }: {
  labels: string[]; valores: (number | null)[]; height?: number; tooltip: (i: number) => ReactNode; positivoMalo?: boolean;
}) {
  const tip = useTip();
  const vals = valores.filter((v): v is number => v != null);
  const hi = niceMax(Math.max(0, ...vals)), lo = -niceMax(Math.max(0, ...vals.map((v) => -v)));
  const top = vals.some((v) => v > 0) ? hi : 0, bot = vals.some((v) => v < 0) ? lo : 0;
  const span = top - bot || 1;
  const ph = height - 22;
  const y = (v: number) => ((top - v) / span) * ph;
  const color = (v: number) => ((v > 0) === positivoMalo ? 'var(--neg)' : 'var(--pos)');
  return (
    <div className="chart" style={{ height, paddingLeft: 44 }}>
      {[top, 0, bot].filter((v, i, a) => a.indexOf(v) === i).map((t) => (
        <div key={t} style={{ position: 'absolute', left: 44, right: 0, top: y(t), borderTop: `1px solid ${t === 0 ? 'var(--line)' : 'var(--grid)'}` }}>
          <span className="xs muted num" style={{ position: 'absolute', right: '100%', marginRight: 8, top: -9 }}>{fMM(t)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', height: '100%', position: 'relative' }}>
        {labels.map((l, i) => {
          const v = valores[i];
          return (
            <div key={l + i} style={{ flex: 1, position: 'relative', cursor: v == null ? 'default' : 'crosshair' }}
              onMouseMove={(e) => v != null && tip.show(e, tooltip(i))} onMouseLeave={tip.hide}>
              {v != null && v !== 0 && (
                <div style={{
                  position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: 'min(60%, 28px)',
                  top: y(Math.max(v, 0)), height: Math.max(1, (Math.abs(v) / span) * ph), background: color(v),
                  borderRadius: v > 0 ? '4px 4px 0 0' : '0 0 4px 4px',
                }} />
              )}
              <span className="xs muted" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center' }}>{l}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface HBarItem { key: string; label: ReactNode; value: number; color: string; texto?: string; tip?: ReactNode }

/** Barras horizontales (secuenciales o divergentes) con valor al final de cada barra. */
export function HBars({ items, divergente, labelWidth = 132 }: { items: HBarItem[]; divergente?: boolean; labelWidth?: number }) {
  const tip = useTip();
  const max = Math.max(0, ...items.map((i) => i.value));
  const min = divergente ? Math.min(0, ...items.map((i) => i.value)) : 0;
  const span = max - min || 1;
  const zero = (-min / span) * 100;
  return (
    <div className="hb">
      {items.map((it) => {
        const w = (Math.abs(it.value) / span) * 100;
        const left = it.value >= 0 ? zero : zero - w;
        return (
          <div className="hb-row" key={it.key} style={{ gridTemplateColumns: `${labelWidth}px minmax(0,1fr)` }}
            onMouseMove={(e) => it.tip && tip.show(e, it.tip)} onMouseLeave={tip.hide}>
            <div className="hb-label">{it.label}</div>
            <div className="hb-track">
              <div className="hb-plot" style={{ left: divergente ? 92 : 0, right: 100 }}>
                {divergente && <div className="hb-zero" style={{ left: `${zero}%` }} />}
                <div className="hb-bar" style={{
                  left: `${left}%`, width: `${Math.max(w, it.value ? 0.5 : 0)}%`, background: it.color,
                  borderRadius: it.value >= 0 ? '0 4px 4px 0' : '4px 0 0 4px',
                }} />
                <span className="hb-val" style={it.value >= 0 ? { left: `calc(${left + w}% + 6px)` } : { right: `calc(${100 - left}% + 6px)` }}>
                  {it.texto ?? fMM(it.value)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
