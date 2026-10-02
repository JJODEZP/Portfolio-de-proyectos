import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AHORRO, Concepto } from '../components/ahorro';
import { Icon } from '../components/Icon';
import { Card, EtapaBadge, Seg, useTip } from '../components/ui';
import { useStore } from '../data/store';
import { useMetricas, useProyectosVisibles } from '../data/useMetricas';
import {
  ahorroPonderado, COMPLEJIDAD_LABEL, cuadrante, CUADRANTES, mediana, PROB_ETAPA, probabilidad, puntaje, type Cuadrante,
} from '../lib/calc';
import { fMM, fNum, fPct0 } from '../lib/format';
import { ETAPAS, type Proyecto } from '../lib/types';

const PILL: Record<Cuadrante, string> = { quick: 'good', estrategico: 'accent', kaizen: 'neutral', reconsiderar: 'crit' };

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

/** Matriz valor (ahorro ponderado) vs esfuerzo (complejidad 1–5). */
function Matriz({ ps, umbral, rank }: { ps: Proyecto[]; umbral: number; rank: Map<string, number> }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const tip = useTip();
  const nav = useNavigate();
  const H = 380, m = { l: 52, r: 16, t: 16, b: 40 };
  const iw = Math.max(10, w - m.l - m.r), ih = H - m.t - m.b;
  const vmax = Math.max(1, ...ps.map(ahorroPonderado)) * 1.12;
  const x = (c: number) => m.l + ((c - 0.5) / 5) * iw;
  const y = (v: number) => m.t + ih - (v / vmax) * ih;
  // separa horizontalmente los puntos con la misma complejidad
  const porC = new Map<number, Proyecto[]>();
  for (const p of ps) porC.set(p.complejidad, [...(porC.get(p.complejidad) ?? []), p]);
  const dx = (p: Proyecto) => {
    const g = porC.get(p.complejidad)!;
    const i = g.indexOf(p);
    return ((i - (g.length - 1) / 2) * Math.min(26, (iw / 5 - 24) / Math.max(1, g.length - 1)));
  };
  const xc = x(3.5), yc = y(umbral);
  const quad = (q: Cuadrante, cx: number, cy: number, anchor: 'start' | 'end') => (
    <text x={cx} y={cy} textAnchor={anchor} style={{ fontWeight: 700, fill: 'var(--ink2)', fontSize: 12 }}>{CUADRANTES[q].titulo}</text>
  );
  return (
    <div className="chart" ref={ref}>
      {w > 0 && (
        <svg width={w} height={H} role="img" aria-label="Matriz valor esfuerzo">
          <rect x={m.l} y={m.t} width={xc - m.l} height={yc - m.t} fill="var(--good-bg)" />
          <rect x={xc} y={m.t} width={m.l + iw - xc} height={yc - m.t} fill="var(--accent-soft)" />
          <rect x={m.l} y={yc} width={xc - m.l} height={m.t + ih - yc} fill="var(--surface-2)" />
          <rect x={xc} y={yc} width={m.l + iw - xc} height={m.t + ih - yc} fill="var(--crit-bg)" />
          {quad('quick', m.l + 8, m.t + 16, 'start')}
          {quad('estrategico', m.l + iw - 8, m.t + 16, 'end')}
          {quad('kaizen', m.l + 8, yc + 18, 'start')}
          {quad('reconsiderar', m.l + iw - 8, yc + 18, 'end')}
          <line x1={m.l} x2={m.l + iw} y1={yc} y2={yc} stroke="var(--line)" strokeDasharray="4 4" />
          <line x1={xc} x2={xc} y1={m.t} y2={m.t + ih} stroke="var(--line)" strokeDasharray="4 4" />
          <text x={xc - 6} y={yc - 5} textAnchor="end">mediana {fMM(umbral)} MM</text>
          {[0, vmax / 2, vmax].map((v) => <text key={v} x={m.l - 8} y={y(v) + 4} textAnchor="end" className="num">{fMM(v)}</text>)}
          {[1, 2, 3, 4, 5].map((c) => <text key={c} x={x(c)} y={H - 22} textAnchor="middle">{c} · {COMPLEJIDAD_LABEL[c]}</text>)}
          <text x={m.l + iw / 2} y={H - 4} textAnchor="middle" style={{ fontWeight: 700 }}>Esfuerzo (complejidad) →</text>
          <text transform={`translate(12 ${m.t + ih / 2}) rotate(-90)`} textAnchor="middle" style={{ fontWeight: 700 }}>Valor: ahorro ponderado (MM/año) →</text>
          {ps.map((p) => {
            const cx = x(p.complejidad) + dx(p), cy = y(ahorroPonderado(p));
            return (
              <g key={p.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/proyectos/${p.id}`)}
                onMouseMove={(e) => tip.show(e, <><b>#{rank.get(p.id)} {p.nombre}</b>
                  <div className="tr"><span>Ponderado</span><span>{fMM(ahorroPonderado(p))} MM</span></div>
                  <div className="tr"><span>Comprometido × prob.</span><span>{fMM(p.ahorro_comprometido_anual)} × {probabilidad(p)} %</span></div>
                  <div className="tr"><span>Complejidad</span><span>{p.complejidad} · {COMPLEJIDAD_LABEL[p.complejidad]}</span></div>
                  <div className="tr"><span>Etapa</span><span>{p.etapa}</span></div></>)}
                onMouseLeave={tip.hide}>
                <circle cx={cx} cy={cy} r={11} fill="var(--c-comp)" stroke="var(--surface)" strokeWidth={2} />
                <text x={cx} y={cy + 4} textAnchor="middle" style={{ fill: '#fff', fontWeight: 800, fontSize: 10 }}>{rank.get(p.id)}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export function Priorizacion() {
  const { db, plantasVisibles, plantaDe, perfil } = useStore();
  const { map } = useMetricas();
  const visibles = useProyectosVisibles();
  const [alcance, setAlcance] = useState<'activos' | 'nuevos'>('activos');
  const ps = visibles.filter((p) => (alcance === 'nuevos' ? p.etapa === 'Idea' || p.etapa === 'Evaluación' : p.etapa !== 'Implementado' && p.etapa !== 'Cerrado'));
  const umbral = mediana(ps.map(ahorroPonderado));
  const ranking = [...ps].sort((a, b) => puntaje(b) - puntaje(a));
  const rank = new Map(ranking.map((p, i) => [p.id, i + 1]));

  // Pipeline ponderado por etapa (todo el portafolio visible)
  const meta = db.plantas.filter((p) => plantasVisibles.includes(p.id)).reduce((s, p) => s + p.meta_ahorro_anual, 0);
  const porEtapa = ETAPAS.map((e) => {
    const del = visibles.filter((p) => p.etapa === e);
    return { e, n: del.length, comp: del.reduce((s, p) => s + p.ahorro_comprometido_anual, 0), pond: del.reduce((s, p) => s + ahorroPonderado(p), 0) };
  });
  const totComp = porEtapa.reduce((s, x) => s + x.comp, 0), totPond = porEtapa.reduce((s, x) => s + x.pond, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Priorización</h1>
          <p>¿En qué invertir primero? Compara el valor de cada proyecto, ajustado por su riesgo, con el esfuerzo que exige.</p>
        </div>
        <Link className="btn" to="/metodologia?s=priorizacion"><Icon name="info" /> Cómo se calcula</Link>
      </div>

      <Card title="Ahorro ponderado por riesgo" sub="No todo lo comprometido se va a lograr: una idea tiene menos probabilidad de concretarse que un proyecto en ejecución.">
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Etapa</th><th className="num">Proyectos</th><th className="num"><Concepto c="comprometido">Comprometido</Concepto></th><th className="num">Probabilidad estándar</th><th className="num">Ponderado</th></tr></thead>
            <tbody>
              {porEtapa.map((x) => (
                <tr key={x.e}>
                  <td><EtapaBadge etapa={x.e} /></td><td className="num">{x.n}</td><td className="num">{fMM(x.comp)}</td>
                  <td className="num">{PROB_ETAPA[x.e]} %</td><td className="num strong">{fMM(x.pond)}</td>
                </tr>
              ))}
              <tr className="total"><td>Total</td><td className="num">{visibles.length}</td><td className="num">{fMM(totComp)}</td><td className="num">{totComp ? fPct0((totPond / totComp) * 100) : '—'}</td><td className="num">{fMM(totPond)}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="ah-txt mt">
          Si se cumple la probabilidad típica de cada etapa, esperamos capturar <b>{fMM(totPond)} MM/año</b> de los {fMM(totComp)} prometidos.
          {meta > 0 && (totPond >= meta
            ? <> Eso <b className="txt-good">cubre la meta de {fMM(meta)} MM</b> con riesgo incluido.</>
            : <> Frente a la <Concepto c="meta">meta de {fMM(meta)} MM</Concepto>, <b className="txt-crit">faltan {fMM(meta - totPond)} MM ponderados</b>: hay que sumar ideas o acelerar las que están en evaluación.</>)}
        </p>
      </Card>

      <div className="row between mt" style={{ marginBottom: 10 }}>
        <h2>Matriz valor – esfuerzo</h2>
        <Seg value={alcance} onChange={setAlcance} options={[['activos', 'Proyectos no terminados'], ['nuevos', 'Solo ideas y evaluación']]} />
      </div>
      <div className="grid g3">
        <Card className="span2" title={`${ps.length} proyectos`} sub="Cada círculo es un proyecto; el número es su lugar en el ranking. Clic para abrirlo.">
          {ps.length ? <Matriz ps={ps} umbral={umbral} rank={rank} /> : <div className="empty">No hay proyectos en este alcance.</div>}
        </Card>
        <Card title="Cómo leer la matriz">
          <div className="stack" style={{ gap: 12 }}>
            {(Object.keys(CUADRANTES) as Cuadrante[]).map((q) => (
              <div key={q}>
                <span className={`pill ${PILL[q]}`}>{CUADRANTES[q].titulo} · {ps.filter((p) => cuadrante(p, umbral) === q).length}</span>
                <div className="small muted" style={{ marginTop: 4 }}>{CUADRANTES[q].accion}.</div>
              </div>
            ))}
            <p className="xs muted" style={{ margin: 0 }}>
              Valor alto = ahorro ponderado sobre la mediana del grupo ({fMM(umbral)} MM). Esfuerzo alto = complejidad 4 o 5.
              La complejidad la define el líder en la ficha del proyecto.
            </p>
          </div>
        </Card>
      </div>

      <Card flush className="mt" title="Ranking de priorización" sub="Puntaje = ahorro ponderado ÷ complejidad: cuánto ahorro esperado aporta cada punto de esfuerzo">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>#</th><th>Proyecto</th><th>Cuadrante</th><th>Etapa</th><th className="num">Comprometido</th><th className="num">Prob.</th><th className="num">Ponderado</th><th className="num">Complejidad</th><th className="num">Puntaje</th><th className="num">ROI esp.</th></tr>
            </thead>
            <tbody>
              {ranking.map((p) => {
                const q = cuadrante(p, umbral);
                const fin = map.get(p.id)?.fin;
                return (
                  <tr key={p.id}>
                    <td className="strong">{rank.get(p.id)}</td>
                    <td style={{ maxWidth: 280 }}><Link to={`/proyectos/${p.id}`} className="strong">{p.nombre}</Link><div className="xs muted">{plantaDe(p.planta_id)?.nombre} · {perfil(p.lider_id)?.nombre}</div></td>
                    <td><span className={`pill ${PILL[q]}`}>{CUADRANTES[q].titulo}</span></td>
                    <td><EtapaBadge etapa={p.etapa} /></td>
                    <td className="num">{fMM(p.ahorro_comprometido_anual)}</td>
                    <td className="num">{probabilidad(p)} %{p.probabilidad != null && <span className="xs muted"> (ajust.)</span>}</td>
                    <td className="num strong">{fMM(ahorroPonderado(p))}</td>
                    <td className="num">{p.complejidad}</td>
                    <td className="num strong" style={{ color: AHORRO.comprometido.color }}>{fNum(puntaje(p), 1)}</td>
                    <td className="num">{fin?.roiEsperado == null ? '—' : fPct0(fin.roiEsperado)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
