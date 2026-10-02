import { Link } from 'react-router-dom';
import { HBars, LineChart } from '../components/charts';
import { Icon } from '../components/Icon';
import { Card, Meter, SaludBadge, Tile, saludLabel } from '../components/ui';
import { useStore } from '../data/store';
import { useMetricas, useProyectosVisibles } from '../data/useMetricas';
import { diasEntre, periodoIdx } from '../lib/calc';
import { fFecha, fMM, fNum, fPct0 } from '../lib/format';
import { ETAPAS, MESES, type Salud } from '../lib/types';

export function Resumen() {
  const { db, plantasVisibles, perfil, plantaDe } = useStore();
  const { map, cierre, anio, hoy } = useMetricas();
  const proyectos = useProyectosVisibles();
  const ms = proyectos.map((p) => map.get(p.id)!);
  const comprometidos = ms.filter((m) => m.p.etapa !== 'Idea');

  const meta = db.plantas.filter((p) => plantasVisibles.includes(p.id)).reduce((s, p) => s + p.meta_ahorro_anual, 0);
  const comprometido = comprometidos.reduce((s, m) => s + m.p.ahorro_comprometido_anual, 0);
  const pipeline = ms.reduce((s, m) => s + m.p.ahorro_comprometido_anual, 0);
  const planYtd = ms.reduce((s, m) => s + m.acum.plan, 0);
  const realYtd = ms.reduce((s, m) => s + m.acum.real, 0);
  const inversion = ms.reduce((s, m) => s + m.fin.inversion, 0);
  const activos = ms.filter((m) => m.p.etapa === 'Evaluación' || m.p.etapa === 'En ejecución');
  const cuenta = (s: Salud) => activos.filter((m) => m.salud === s).length;

  const ids = new Set(proyectos.map((p) => p.id));
  const accVencidas = db.acciones.filter((a) => a.estado !== 'Hecha' && a.fecha_vencimiento < hoy &&
    (a.proyecto_id ? ids.has(a.proyecto_id) : a.causa_id ? plantasVisibles.includes(db.causas_raiz.find((c) => c.id === a.causa_id)?.planta_id ?? '') : true));
  const hitosAtrasados = ms.reduce((s, m) => s + m.atrasados, 0);

  // Curva acumulada del año: plan, real (hasta el cierre) y meta lineal
  const bensAnio = db.beneficios_mensuales.filter((b) => b.anio === anio && ids.has(b.proyecto_id));
  let accP = 0, accR = 0;
  const plan: number[] = [], real: (number | null)[] = [], metaAcc: number[] = [];
  for (let m = 1; m <= 12; m++) {
    const delMes = bensAnio.filter((b) => b.mes === m);
    accP += delMes.reduce((s, b) => s + b.ahorro_plan, 0);
    accR += delMes.reduce((s, b) => s + (b.ahorro_real ?? 0), 0);
    plan.push(Math.round(accP));
    real.push(periodoIdx({ anio, mes: m }) <= periodoIdx(cierre) ? Math.round(accR) : null);
    metaAcc.push(Math.round((meta * m) / 12));
  }

  const atencion = activos
    .filter((m) => m.salud !== 'verde')
    .sort((a, b) => (a.salud === b.salud ? b.p.ahorro_comprometido_anual - a.p.ahorro_comprometido_anual : a.salud === 'rojo' ? -1 : 1));

  const proximosHitos = db.hitos
    .filter((h) => ids.has(h.proyecto_id) && !h.fecha_real && h.fecha_plan >= hoy && diasEntre(hoy, h.fecha_plan) <= 30)
    .sort((a, b) => a.fecha_plan.localeCompare(b.fecha_plan)).slice(0, 7);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Resumen ejecutivo</h1>
          <p>Portafolio de proyectos estratégicos · beneficios reales al cierre de {MESES[cierre.mes - 1]} {cierre.anio}</p>
        </div>
        <Link className="btn primary" to="/proyectos?nuevo=1"><Icon name="plus" /> Nuevo proyecto</Link>
      </div>

      <div className="grid g5">
        <Tile label="Ahorro real acumulado" value={fMM(realYtd)} unit="MM"
          sub={<>{planYtd ? fPct0((realYtd / planYtd) * 100) : '—'} del plan a la fecha ({fMM(planYtd)} MM)</>}>
          <div className="mt" style={{ marginTop: 10 }}><Meter value={realYtd} max={Math.max(planYtd, realYtd)} label="Real vs plan" /></div>
        </Tile>
        <Tile label="Ahorro comprometido anual" value={fMM(comprometido)} unit="MM"
          sub={<>Meta {fMM(meta)} MM · cobertura {meta ? fPct0((comprometido / meta) * 100) : '—'}</>}>
          <div style={{ marginTop: 10 }}><Meter value={comprometido} max={Math.max(meta, comprometido, pipeline)} soft={pipeline} mark={meta} label="Comprometido vs meta" /></div>
        </Tile>
        <Tile label="Proyectos activos" value={activos.length} sub={<>{proyectos.length} en el portafolio · {ms.filter((m) => m.p.etapa === 'Idea').length} ideas</>}>
          <div className="row" style={{ marginTop: 8, gap: 6 }}>
            {(['verde', 'amarillo', 'rojo'] as Salud[]).map((s) => <SaludBadge key={s} s={s} label={`${cuenta(s)} ${saludLabel(s).toLowerCase()}`} />)}
          </div>
        </Tile>
        <Tile label="Inversión del portafolio" value={fMM(inversion)} unit="MM"
          sub={<>ROI esperado {inversion ? fPct0((comprometido / inversion) * 100) : '—'} anual · payback {inversion && comprometido ? `${fNum(inversion / (comprometido / 12))} meses` : '—'}</>} />
        <Tile label="Alertas" value={hitosAtrasados + accVencidas.length}
          sub={<>{hitosAtrasados} hitos atrasados · <Link to="/acciones?vencidas=1">{accVencidas.length} acciones vencidas</Link></>} />
      </div>

      <div className="grid g3 mt">
        <Card className="span2" title={`Curva de ahorro acumulado ${anio}`} sub="Millones de CLP · real disponible hasta el último mes cerrado">
          <LineChart labels={MESES} series={[
            { nombre: 'Real', valores: real, color: 'var(--series)' },
            { nombre: 'Plan comprometido', valores: plan, color: 'var(--series-o)' },
            { nombre: 'Meta', valores: metaAcc, color: 'var(--series-2)', dashed: true },
          ]} />
        </Card>
        <Card title="Embudo por etapa" sub="Ahorro anual comprometido (MM) y nº de proyectos">
          <HBars labelWidth={110} items={ETAPAS.map((e, i) => {
            const del = ms.filter((m) => m.p.etapa === e);
            const v = del.reduce((s, m) => s + m.p.ahorro_comprometido_anual, 0);
            return { key: e, label: e, value: v, color: `var(--st${i + 1})`, texto: `${fMM(v)} · ${del.length}`, tip: <><b>{e}</b><div className="tr"><span>Proyectos</span><span>{del.length}</span></div><div className="tr"><span>Ahorro anual</span><span>{fMM(v)} MM</span></div></> };
          })} />
        </Card>
      </div>

      <div className="grid g3 mt">
        <Card className="span2" flush title="Proyectos que requieren atención" sub="Semáforo = peor entre plazo (hitos), beneficio real vs plan y lo reportado por el líder">
          {atencion.length ? (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Proyecto</th><th>Planta · Líder</th><th>Estado</th><th>Motivo</th><th className="num">Avance</th></tr></thead>
                <tbody>
                  {atencion.slice(0, 8).map((m) => {
                    const motivos: string[] = [];
                    if (m.atrasados) motivos.push(`${m.atrasados} hito${m.atrasados > 1 ? 's' : ''} atrasado${m.atrasados > 1 ? 's' : ''}`);
                    if (m.beneficio && m.beneficio !== 'verde') motivos.push(`beneficio ${fPct0((m.acum.real / m.acum.plan) * 100)} del plan`);
                    if (m.checkin && m.checkin.salud !== 'verde') motivos.push(`líder reporta ${saludLabel(m.checkin.salud).toLowerCase()}`);
                    return (
                      <tr key={m.p.id}>
                        <td><Link to={`/proyectos/${m.p.id}`} className="strong">{m.p.nombre}</Link><div className="xs muted">{m.p.codigo}</div></td>
                        <td className="small">{plantaDe(m.p.planta_id)?.nombre}<div className="xs muted">{perfil(m.p.lider_id)?.nombre}</div></td>
                        <td><SaludBadge s={m.salud} /></td>
                        <td className="small">{motivos.join(' · ') || '—'}</td>
                        <td className="num">{m.avance}%<div className="xs muted">plan {m.esperado}%</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <div className="empty">Todos los proyectos activos están en plan.</div>}
        </Card>
        <Card title="Próximos hitos (30 días)">
          {proximosHitos.length ? (
            <div className="timeline">
              {proximosHitos.map((h) => {
                const p = db.proyectos.find((x) => x.id === h.proyecto_id)!;
                return (
                  <div className="tl-item" key={h.id}>
                    <span className="tl-dot" style={{ background: 'var(--accent-soft)' }}><Icon name="flag" size={10} style={{ color: 'var(--accent-text)' }} /></span>
                    <div>
                      <div className="small strong">{h.nombre}</div>
                      <div className="xs muted"><Link to={`/proyectos/${p.id}`}>{p.nombre}</Link> · {fFecha(h.fecha_plan)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <div className="empty">Sin hitos en los próximos 30 días.</div>}
        </Card>
      </div>

      <div className="grid g2 mt">
        <Card title="Ahorro por planta vs meta" sub="Barra: real acumulado · clara: comprometido anual · marca: meta anual">
          <div className="stack" style={{ gap: 14 }}>
            {db.plantas.filter((p) => plantasVisibles.includes(p.id)).map((pl) => {
              const del = ms.filter((m) => m.p.planta_id === pl.id);
              const r = del.reduce((s, m) => s + m.acum.real, 0);
              const c = del.filter((m) => m.p.etapa !== 'Idea').reduce((s, m) => s + m.p.ahorro_comprometido_anual, 0);
              const max = Math.max(pl.meta_ahorro_anual, c, r) * 1.05;
              return (
                <div key={pl.id}>
                  <div className="row between small"><b>{pl.nombre}</b><span className="muted num">{fMM(r)} real · {fMM(c)} comprometido · meta {fMM(pl.meta_ahorro_anual)}</span></div>
                  <div style={{ marginTop: 6 }}><Meter value={r} soft={c} mark={pl.meta_ahorro_anual} max={max} label={`Ahorro ${pl.nombre}`} /></div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="Acciones vencidas" sub="Planes de acción con fecha comprometida ya pasada" actions={<Link className="btn sm" to="/acciones?vencidas=1">Ver todas</Link>}>
          {accVencidas.length ? (
            <div className="timeline">
              {accVencidas.sort((x, y) => x.fecha_vencimiento.localeCompare(y.fecha_vencimiento)).slice(0, 6).map((a) => (
                <div className="tl-item" key={a.id}>
                  <span className="tl-dot" style={{ background: 'var(--surface-2)' }}><Icon name="alert" size={11} style={{ color: 'var(--crit)' }} /></span>
                  <div>
                    <div className="small strong">{a.descripcion}</div>
                    <div className="xs muted">{perfil(a.responsable_id)?.nombre ?? 'Sin responsable'} · venció {fFecha(a.fecha_vencimiento)} ({diasEntre(a.fecha_vencimiento, hoy)} días)</div>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="empty">Sin acciones vencidas.</div>}
        </Card>
      </div>
    </>
  );
}
