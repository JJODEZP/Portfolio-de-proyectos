import { Link } from 'react-router-dom';
import { AHORRO, Concepto, Cumplimiento, PanelAhorro } from '../components/ahorro';
import { HBars, LineChart } from '../components/charts';
import { Icon } from '../components/Icon';
import { Card, SaludBadge, Tile, saludLabel } from '../components/ui';
import { ActividadReciente } from './Colaboracion';
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

      <div className="grid g3">
        <Card className="span2" title="Ahorro del portafolio" actions={<Link className="btn sm ghost" to="/metodologia?s=ahorro"><Icon name="info" size={13} /> Cómo se calcula</Link>} sub={`Millones de CLP · lo logrado se mide hasta el cierre de ${MESES[cierre.mes - 1]} ${cierre.anio}. Pasa el mouse sobre cada concepto para ver su definición.`}>
          <PanelAhorro logrado={realYtd} esperado={planYtd} comprometido={comprometido} meta={meta} />
        </Card>
        <div className="stack">
          <Tile label="Proyectos activos" value={activos.length} sub={<>{proyectos.length} en el portafolio · {ms.filter((m) => m.p.etapa === 'Idea').length} ideas</>}>
            <div className="row" style={{ marginTop: 8, gap: 6 }}>
              {(['verde', 'amarillo', 'rojo'] as Salud[]).map((s) => <SaludBadge key={s} s={s} label={`${cuenta(s)} ${saludLabel(s).toLowerCase()}`} />)}
            </div>
          </Tile>
          <Tile label="Alertas" value={hitosAtrasados + accVencidas.length}
            sub={<>{hitosAtrasados} hitos atrasados · <Link to="/acciones?vencidas=1">{accVencidas.length} acciones vencidas</Link></>} />
          <Tile label="Inversión del portafolio" value={fMM(inversion)} unit="MM"
            sub={<>ROI esperado {inversion ? fPct0((comprometido / inversion) * 100) : '—'} anual · se recupera en {inversion && comprometido ? `${fNum(inversion / (comprometido / 12))} meses` : '—'}</>} />
        </div>
      </div>

      <div className="grid g3 mt">
        <Card className="span2" title={`Curva de ahorro acumulado ${anio}`} sub="Millones de CLP · si la línea verde (logrado) queda bajo la naranja (esperado), vamos atrasados">
          <LineChart labels={MESES} series={[
            { nombre: AHORRO.logrado.label, valores: real, color: AHORRO.logrado.color },
            { nombre: 'Esperado (plan de los proyectos)', valores: plan, color: AHORRO.esperado.color },
            { nombre: 'Meta (lineal)', valores: metaAcc, color: AHORRO.meta.color, dashed: true },
          ]} />
        </Card>
        <Card title="Embudo por etapa" sub="Ahorro anual que promete cada etapa (MM) · nº de proyectos">
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
        <Card title="Actividad reciente" sub="Comentarios, avances e hitos del equipo">
          <ActividadReciente limite={6} />
        </Card>
      </div>

      <div className="grid g3 mt">
        <Card className="span2" flush title="Ahorro por planta" sub="Pasa el mouse sobre cada columna para ver qué significa">
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Planta</th>
                  <th className="num"><Concepto c="logrado" /></th>
                  <th className="num"><Concepto c="esperado">Esperado</Concepto></th>
                  <th>¿Al día?</th>
                  <th className="num"><Concepto c="comprometido" /></th>
                  <th className="num"><Concepto c="meta" /></th>
                  <th>Cobertura meta</th>
                </tr>
              </thead>
              <tbody>
                {db.plantas.filter((p) => plantasVisibles.includes(p.id)).map((pl) => {
                  const del = ms.filter((m) => m.p.planta_id === pl.id);
                  const r = del.reduce((s, m) => s + m.acum.real, 0);
                  const e = del.reduce((s, m) => s + m.acum.plan, 0);
                  const c = del.filter((m) => m.p.etapa !== 'Idea').reduce((s, m) => s + m.p.ahorro_comprometido_anual, 0);
                  const cob = pl.meta_ahorro_anual ? (c / pl.meta_ahorro_anual) * 100 : null;
                  return (
                    <tr key={pl.id}>
                      <td className="strong nowrap"><Link to="/plantas">{pl.nombre}</Link></td>
                      <td className="num strong">{fMM(r)}</td>
                      <td className="num">{fMM(e)}</td>
                      <td><Cumplimiento logrado={r} esperado={e} /></td>
                      <td className="num">{fMM(c)}</td>
                      <td className="num">{fMM(pl.meta_ahorro_anual)}</td>
                      <td className="small">{cob == null ? '—' : cob >= 100
                        ? <span className="txt-good strong">{fPct0(cob)} cubierta</span>
                        : <span className="txt-crit strong">{fPct0(cob)} · faltan {fMM(pl.meta_ahorro_anual - c)}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Pendientes" sub="Acciones vencidas y próximos hitos (30 días)" actions={<Link className="btn sm" to="/acciones?vencidas=1">Ver acciones</Link>}>
          <div className="timeline">
            {accVencidas.sort((x, y) => x.fecha_vencimiento.localeCompare(y.fecha_vencimiento)).slice(0, 4).map((a) => (
              <div className="tl-item" key={a.id}>
                <span className="tl-dot" style={{ background: 'var(--crit-bg)' }}><Icon name="alert" size={11} style={{ color: 'var(--crit)' }} /></span>
                <div>
                  <div className="small strong">{a.descripcion}</div>
                  <div className="xs muted">{perfil(a.responsable_id)?.nombre ?? 'Sin responsable'} · <span className="txt-crit">venció hace {diasEntre(a.fecha_vencimiento, hoy)} días</span></div>
                </div>
              </div>
            ))}
            {proximosHitos.slice(0, 4).map((h) => {
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
            {!accVencidas.length && !proximosHitos.length && <div className="empty">Nada pendiente.</div>}
          </div>
        </Card>
      </div>
    </>
  );
}
