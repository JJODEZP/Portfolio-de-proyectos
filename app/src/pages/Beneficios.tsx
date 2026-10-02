import { Link } from 'react-router-dom';
import { AHORRO, Concepto, Cumplimiento, PanelAhorro } from '../components/ahorro';
import { HBars } from '../components/charts';
import { Card, Meter, Tile } from '../components/ui';
import { useStore } from '../data/store';
import { useMetricas, useProyectosVisibles } from '../data/useMetricas';
import { progresoKpi } from '../lib/calc';
import { fMM, fNum, fPct0 } from '../lib/format';
import { MESES, TIPOS_BENEFICIO } from '../lib/types';

export function Beneficios() {
  const { db, plantaDe, plantasVisibles } = useStore();
  const { map, cierre } = useMetricas();
  const ms = useProyectosVisibles().map((p) => map.get(p.id)!).filter((m) => m.p.etapa !== 'Idea');
  const tot = {
    comp: ms.reduce((s, m) => s + m.p.ahorro_comprometido_anual, 0),
    plan: ms.reduce((s, m) => s + m.acum.plan, 0),
    real: ms.reduce((s, m) => s + m.acum.real, 0),
    inv: ms.reduce((s, m) => s + m.fin.inversion, 0),
    realTotal: ms.reduce((s, m) => s + m.fin.realTotal, 0),
  };
  const ids = new Set(ms.map((m) => m.p.id));
  const kpis = db.kpis.filter((k) => ids.has(k.proyecto_id));

  const porClase = db.clases_costo.map((c) => {
    const del = ms.filter((m) => m.p.clase_id === c.id);
    return { c, real: del.reduce((s, m) => s + m.acum.real, 0), plan: del.reduce((s, m) => s + m.acum.plan, 0) };
  });

  return (
    <>
      <div className="page-head"><div><h1>Beneficios y ROI</h1><p>Ahorro vs línea base, retorno de la inversión y KPIs operativos · real al cierre de {MESES[cierre.mes - 1]} {cierre.anio}</p></div></div>
      <Card title="Ahorro del portafolio" sub="Pasa el mouse sobre cada concepto para ver su definición">
        <PanelAhorro logrado={tot.real} esperado={tot.plan} comprometido={tot.comp}
          meta={db.plantas.filter((p) => plantasVisibles.includes(p.id)).reduce((s, p) => s + p.meta_ahorro_anual, 0)} />
      </Card>
      <div className="grid g2 mt">
        <Tile label="Inversión total" value={fMM(tot.inv)} unit="MM" sub={<>ROI esperado {tot.inv ? fPct0((tot.comp / tot.inv) * 100) : '—'} anual</>} />
        <Tile label="Payback del portafolio" value={tot.inv && tot.comp ? fNum(tot.inv / (tot.comp / 12)) : '—'} unit="meses" sub={<>Recuperado {tot.inv ? fPct0(Math.min(100, (tot.realTotal / tot.inv) * 100)) : '—'} de la inversión</>} />
      </div>

      <div className="grid g2 mt">
        <Card title="Ahorro logrado por clase de costo" sub="MM logrados · etiqueta: % de lo esperado a la fecha">
          <HBars items={porClase.map(({ c, real, plan }) => ({
            key: c.id, label: c.nombre, value: real, color: AHORRO.logrado.color, texto: `${fMM(real)} · ${plan ? fPct0((real / plan) * 100) : '—'}`,
            tip: <><b>{c.nombre}</b><div className="tr"><span>{AHORRO.logrado.label}</span><span>{fMM(real)} MM</span></div><div className="tr"><span>{AHORRO.esperado.label}</span><span>{fMM(plan)} MM</span></div></>,
          }))} />
        </Card>
        <Card title="Por tipo de beneficio" sub="Ahorro comprometido para el año (MM)">
          <HBars items={TIPOS_BENEFICIO.map((t, i) => {
            const v = ms.filter((m) => m.p.tipo_beneficio === t).reduce((s, m) => s + m.p.ahorro_comprometido_anual, 0);
            return { key: t, label: t, value: v, color: `var(--st${[5, 3, 1][i]})` };
          })} />
          <p className="xs muted" style={{ marginBottom: 0 }}>Ahorro duro: reduce el costo real vs línea base. Blando: mejora de productividad sin reducción directa. Costo evitado: gasto que habría ocurrido sin el proyecto.</p>
        </Card>
      </div>

      <Card flush className="mt" title="Detalle financiero por proyecto">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Proyecto</th><th>Planta</th><th>Tipo</th><th className="num"><Concepto c="comprometido" /></th><th className="num"><Concepto c="esperado">Esperado</Concepto></th><th className="num"><Concepto c="logrado" /></th><th>¿Al día?</th><th className="num">Inversión</th><th className="num">ROI esp.</th><th className="num">ROI real</th><th className="num">Payback plan / real</th></tr>
            </thead>
            <tbody>
              {ms.sort((a, b) => b.p.ahorro_comprometido_anual - a.p.ahorro_comprometido_anual).map((m) => (
                <tr key={m.p.id}>
                  <td style={{ maxWidth: 280 }}><Link to={`/proyectos/${m.p.id}`} className="strong">{m.p.nombre}</Link><div className="xs muted">{m.p.codigo}</div></td>
                  <td className="small">{plantaDe(m.p.planta_id)?.nombre}</td>
                  <td className="small nowrap">{m.p.tipo_beneficio}</td>
                  <td className="num">{fMM(m.p.ahorro_comprometido_anual)}</td>
                  <td className="num">{fMM(m.acum.plan)}</td>
                  <td className="num strong">{fMM(m.acum.real)}</td>
                  <td><Cumplimiento logrado={m.acum.real} esperado={m.acum.plan} /></td>
                  <td className="num">{fMM(m.fin.inversion)}</td>
                  <td className="num">{m.fin.roiEsperado == null ? '—' : fPct0(m.fin.roiEsperado)}</td>
                  <td className="num">{m.fin.roiReal == null ? '—' : fPct0(m.fin.roiReal)}</td>
                  <td className="num nowrap">{m.fin.paybackPlan == null ? '—' : fNum(m.fin.paybackPlan)} / {m.fin.paybackReal ?? (m.fin.inversion ? 'pend.' : '—')}</td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={3}>Total</td>
                <td className="num">{fMM(tot.comp)}</td><td className="num">{fMM(tot.plan)}</td><td className="num">{fMM(tot.real)}</td>
                <td><Cumplimiento logrado={tot.real} esperado={tot.plan} /></td><td className="num">{fMM(tot.inv)}</td>
                <td className="num">{tot.inv ? fPct0((tot.comp / tot.inv) * 100) : '—'}</td><td className="num">{tot.inv ? fPct0(((tot.realTotal - tot.inv) / tot.inv) * 100) : '—'}</td><td />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card flush className="mt" title="KPIs operativos del portafolio" sub="Beneficios no financieros: progreso desde la línea base hacia la meta">
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Indicador</th><th>Proyecto</th><th className="num">Línea base</th><th className="num">Actual</th><th className="num">Meta</th><th style={{ minWidth: 160 }}>Progreso</th></tr></thead>
            <tbody>
              {kpis.map((k) => {
                const p = map.get(k.proyecto_id)!.p;
                const pr = progresoKpi(k);
                return (
                  <tr key={k.id}>
                    <td className="strong">{k.nombre} <span className="xs muted">({k.unidad})</span></td>
                    <td className="small"><Link to={`/proyectos/${p.id}`}>{p.nombre}</Link></td>
                    <td className="num">{fNum(k.linea_base, 2)}</td>
                    <td className="num">{k.actual == null ? '—' : fNum(k.actual, 2)}</td>
                    <td className="num">{fNum(k.meta, 2)}</td>
                    <td><Meter value={pr ?? 0} label={k.nombre} /><div className="xs muted num">{pr == null ? 'sin medición' : `${pr}%`}</div></td>
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
