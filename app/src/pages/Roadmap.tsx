import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Card, Empty, SaludBadge, Seg, saludColor, useTip } from '../components/ui';
import { useStore } from '../data/store';
import { useMetricas, useProyectosVisibles } from '../data/useMetricas';
import { fFecha } from '../lib/format';
import { MESES } from '../lib/types';

const FONDO = { verde: 'var(--good-bg)', amarillo: 'var(--warn-bg)', rojo: 'var(--crit-bg)' } as const;

export function Roadmap() {
  const { db, plantasVisibles, perfil } = useStore();
  const { map, hoy } = useMetricas();
  const tip = useTip();
  const [alcance, setAlcance] = useState<'activos' | 'todos'>('activos');
  const ps = useProyectosVisibles()
    .filter((p) => alcance === 'todos' || (p.etapa !== 'Cerrado' && p.etapa !== 'Idea'))
    .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
  if (!ps.length) return <Card><Empty>No hay proyectos para mostrar.</Empty></Card>;

  // Rango: desde el mes del inicio más temprano hasta el mes del término más tardío
  const fechas = ps.flatMap((p) => [p.fecha_inicio, p.fecha_fin_real ?? p.fecha_fin_plan, p.fecha_fin_plan]).concat(hoy);
  const d0 = new Date(fechas.reduce((a, b) => (a < b ? a : b)).slice(0, 7) + '-01T00:00:00');
  const fin = new Date(fechas.reduce((a, b) => (a > b ? a : b)).slice(0, 10) + 'T00:00:00');
  const d1 = new Date(fin.getFullYear(), fin.getMonth() + 1, 1);
  const t0 = d0.getTime(), span = d1.getTime() - t0;
  const pos = (iso: string) => `${((Date.parse(iso.slice(0, 10) + 'T00:00:00') - t0) / span) * 100}%`;
  const meses: Date[] = [];
  for (let d = new Date(d0); d < d1; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) meses.push(d);

  return (
    <>
      <div className="page-head">
        <div><h1>Hoja de ruta</h1><p>Calendario del portafolio por planta: duración planificada, avance real e hitos. La línea índigo marca hoy.</p></div>
        <Seg value={alcance} onChange={setAlcance} options={[['activos', 'En evaluación, ejecución e implementados'], ['todos', 'Todos']]} />
      </div>
      <Card flush>
        <div className="legend" style={{ padding: '14px 18px 4px' }}>
          <span><i className="sw box" style={{ background: 'var(--good)' }} />Avance real (relleno), color = salud del proyecto</span>
          <span><span className="diamond-mini done" />Hito completado</span>
          <span><span className="diamond-mini" />Hito pendiente</span>
          <span><span className="diamond-mini late" />Hito atrasado</span>
        </div>
        <div className="table-wrap">
          <div style={{ minWidth: 900, padding: '0 0 8px' }}>
            <div className="rm-row rm-head">
              <div />
              <div className="rm-track">
                {meses.map((m) => (
                  <span key={m.toISOString()} className="rm-mes" style={{ left: pos(m.toISOString()), width: `${(1 / meses.length) * 100}%` }}>
                    {MESES[m.getMonth()]}{m.getMonth() === 0 || m === meses[0] ? ` ${String(m.getFullYear()).slice(2)}` : ''}
                  </span>
                ))}
              </div>
            </div>
            {db.plantas.filter((pl) => plantasVisibles.includes(pl.id)).map((pl) => {
              const delPl = ps.filter((p) => p.planta_id === pl.id);
              if (!delPl.length) return null;
              return (
                <div key={pl.id}>
                  <div className="rm-planta"><Icon name="factory" size={13} /> {pl.nombre} <span className="muted">({delPl.length})</span></div>
                  {delPl.map((p) => {
                    const m = map.get(p.id)!;
                    const finP = p.fecha_fin_real ?? p.fecha_fin_plan;
                    const hs = db.hitos.filter((h) => h.proyecto_id === p.id);
                    return (
                      <div className="rm-row" key={p.id}>
                        <div className="rm-nombre">
                          <SaludBadge s={p.etapa === 'Idea' ? null : m.salud} compact />
                          <span style={{ minWidth: 0 }}>
                            <Link to={`/proyectos/${p.id}`} className="clip strong" style={{ display: 'block' }} title={p.nombre}>{p.nombre}</Link>
                            <span className="xs muted">{perfil(p.lider_id)?.nombre} · {p.etapa}</span>
                          </span>
                        </div>
                        <div className="rm-track">
                          {meses.map((mm) => <span key={mm.toISOString()} className="rm-grid" style={{ left: pos(mm.toISOString()) }} />)}
                          <span className="gantt-today" style={{ left: pos(hoy) }} />
                          <div className="rm-bar" style={{ left: pos(p.fecha_inicio), right: `calc(100% - ${pos(finP)})`, background: FONDO[m.salud], borderColor: saludColor(m.salud) }}
                            onMouseMove={(e) => tip.show(e, <><b>{p.nombre}</b>
                              <div className="tr"><span>Inicio</span><span>{fFecha(p.fecha_inicio)}</span></div>
                              <div className="tr"><span>Término plan</span><span>{fFecha(p.fecha_fin_plan)}</span></div>
                              <div className="tr"><span>Avance real / plan</span><span>{m.avance}% / {m.esperado}%</span></div></>)}
                            onMouseLeave={tip.hide}>
                            <i style={{ width: `${m.avance}%`, background: saludColor(m.salud) }} />
                            <span className="rm-pct">{m.avance}%</span>
                          </div>
                          {hs.map((h) => {
                            const late = !h.fecha_real && h.fecha_plan < hoy;
                            return (
                              <span key={h.id} className={`diamond-mini abs ${h.fecha_real ? 'done' : ''} ${late ? 'late' : ''}`} style={{ left: pos(h.fecha_real ?? h.fecha_plan) }}
                                onMouseMove={(e) => tip.show(e, <><b>{h.nombre}</b><div className="tr"><span>Plan</span><span>{fFecha(h.fecha_plan)}</span></div><div className="tr"><span>Real</span><span>{fFecha(h.fecha_real)}</span></div></>)}
                                onMouseLeave={tip.hide} />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </>
  );
}
