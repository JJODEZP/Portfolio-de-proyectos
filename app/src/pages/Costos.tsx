import { useState } from 'react';
import { DeltaColumns, HBars } from '../components/charts';
import { Icon } from '../components/Icon';
import { Card, Empty, Field, Meter, Modal, NumInput, SaludBadge, Seg, Tile } from '../components/ui';
import { useStore } from '../data/store';
import { aggCostos, saludDesviacion, ultimoMesCerrado } from '../lib/calc';
import { fMM, fPct, fSigno, uid } from '../lib/format';
import { puedeEditarCostos } from '../lib/permissions';
import { MESES, TIPOS_CAUSA, type CausaRaiz, type CostoMensual } from '../lib/types';
import { AccionForm, nuevaAccion } from './Acciones';

const DESV_LABEL = { verde: 'En rango', amarillo: 'Alerta', rojo: 'Crítico' } as const;

export function Costos() {
  const { db, plantasVisibles } = useStore();
  const cierre = ultimoMesCerrado();
  const anios = [...new Set(db.costos_mensuales.map((c) => c.anio))].sort();
  const [anio, setAnio] = useState(anios.includes(cierre.anio) ? cierre.anio : anios[anios.length - 1] ?? cierre.anio);
  const conReal = db.costos_mensuales.filter((c) => c.anio === anio && c.costo_real != null).map((c) => c.mes);
  const ultimoConReal = conReal.length ? Math.max(...conReal) : 1;
  const [modo, setModo] = useState<'ytd' | 'mes'>('ytd');
  const [mes, setMes] = useState(ultimoConReal);
  const [tab, setTab] = useState<'analisis' | 'presupuesto'>('analisis');
  const desde = modo === 'ytd' ? 1 : mes;
  const filtro = { plantas: plantasVisibles, anio, desde, hasta: mes };
  const tot = aggCostos(db.costos_mensuales, filtro);
  const plantas = db.plantas.filter((p) => plantasVisibles.includes(p.id));

  const mensual = MESES.map((_, i) => {
    const a = aggCostos(db.costos_mensuales, { plantas: plantasVisibles, anio, desde: i + 1, hasta: i + 1 });
    return a.presupuesto && a.real ? a : null;
  });

  return (
    <>
      <div className="page-head">
        <div><h1>Desviaciones de costo</h1><p>Costo real vs presupuesto vs estándar por clase de costo y planta · MM CLP</p></div>
        <div className="row">
          <Seg value={tab} onChange={setTab} options={[['analisis', 'Análisis'], ['presupuesto', 'Presupuesto y real']]} />
        </div>
      </div>

      {tab === 'presupuesto' ? <Presupuesto anio={anio} /> : (
        <>
          <div className="filters">
            <select className="select" value={anio} onChange={(e) => setAnio(Number(e.target.value))} aria-label="Año">{anios.map((a) => <option key={a}>{a}</option>)}</select>
            <Seg value={modo} onChange={setModo} options={[['ytd', 'Acumulado año'], ['mes', 'Mes']]} />
            <select className="select" value={mes} onChange={(e) => setMes(Number(e.target.value))} aria-label="Mes">
              {MESES.map((m, i) => <option key={m} value={i + 1}>{modo === 'ytd' ? `Ene – ${m}` : m}</option>)}
            </select>
          </div>

          <div className="grid g4">
            <Tile label="Costo real" value={fMM(tot.real)} unit="MM" />
            <Tile label="Presupuesto" value={fMM(tot.presupuesto)} unit="MM" />
            <Tile label="Desviación vs presupuesto" value={fSigno(tot.desv)} unit="MM" sub={<span className="row" style={{ gap: 6 }}><SaludBadge s={saludDesviacion(tot.desvPct)} label={DESV_LABEL[saludDesviacion(tot.desvPct)]} /> {fPct(tot.desvPct, true)}</span>} />
            <Tile label="Desviación vs estándar" value={fSigno(tot.real - tot.estandar)} unit="MM" sub={tot.estandar ? fPct(((tot.real - tot.estandar) / tot.estandar) * 100, true) : '—'} />
          </div>

          <div className="grid g2 mt">
            <Card title={`Desviación mensual vs presupuesto ${anio}`} sub="Rojo = sobrecosto · azul = bajo presupuesto">
              <DeltaColumns labels={MESES} valores={mensual.map((a) => (a ? Math.round(a.desv) : null))} tooltip={(i) => {
                const a = mensual[i]!;
                return <><b>{MESES[i]} {anio}</b><div className="tr"><span>Real</span><span>{fMM(a.real)}</span></div><div className="tr"><span>Presupuesto</span><span>{fMM(a.presupuesto)}</span></div><div className="tr"><span>Desviación</span><span>{fSigno(a.desv)} ({fPct(a.desvPct, true)})</span></div></>;
              }} />
            </Card>
            <Card title="Desviación por clase de costo" sub={modo === 'ytd' ? `Acumulado Ene – ${MESES[mes - 1]}` : `${MESES[mes - 1]} ${anio}`}>
              <HBars divergente labelWidth={110} items={db.clases_costo.map((c) => {
                const a = aggCostos(db.costos_mensuales, { ...filtro, clase: c.id });
                return { key: c.id, label: c.nombre, value: Math.round(a.desv), color: a.desv > 0 ? 'var(--neg)' : 'var(--pos)', texto: `${fSigno(a.desv)} (${fPct(a.desvPct, true)})`,
                  tip: <><b>{c.nombre}</b><div className="tr"><span>Real</span><span>{fMM(a.real)}</span></div><div className="tr"><span>Presupuesto</span><span>{fMM(a.presupuesto)}</span></div><div className="tr"><span>Estándar</span><span>{fMM(a.estandar)}</span></div></> };
              })} />
            </Card>
          </div>

          <Card flush className="mt" title="Análisis por clase de costo">
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Clase</th><th className="num">Real</th><th className="num">Presupuesto</th><th className="num">Estándar</th><th className="num">Δ vs ppto</th><th className="num">Δ %</th><th className="num">Δ vs estándar</th><th>Estado</th><th className="num">Causas abiertas</th></tr></thead>
                <tbody>
                  {db.clases_costo.map((c) => {
                    const a = aggCostos(db.costos_mensuales, { ...filtro, clase: c.id });
                    const s = saludDesviacion(a.desvPct);
                    const abiertas = db.causas_raiz.filter((x) => x.clase_id === c.id && x.anio === anio && x.estado !== 'Cerrada' && plantasVisibles.includes(x.planta_id)).length;
                    return (
                      <tr key={c.id}>
                        <td className="strong">{c.nombre}<div className="xs muted" style={{ fontWeight: 400 }}>{c.descripcion}</div></td>
                        <td className="num">{fMM(a.real)}</td><td className="num">{fMM(a.presupuesto)}</td><td className="num">{fMM(a.estandar)}</td>
                        <td className="num strong">{fSigno(a.desv)}</td><td className="num">{fPct(a.desvPct, true)}</td><td className="num">{fSigno(a.real - a.estandar)}</td>
                        <td><SaludBadge s={s} label={DESV_LABEL[s]} /></td>
                        <td className="num">{abiertas}</td>
                      </tr>
                    );
                  })}
                  <tr className="total"><td>Total</td><td className="num">{fMM(tot.real)}</td><td className="num">{fMM(tot.presupuesto)}</td><td className="num">{fMM(tot.estandar)}</td><td className="num">{fSigno(tot.desv)}</td><td className="num">{fPct(tot.desvPct, true)}</td><td className="num">{fSigno(tot.real - tot.estandar)}</td><td /><td /></tr>
                </tbody>
              </table>
            </div>
          </Card>

          {plantas.length > 1 && (
            <Card flush className="mt" title="Mapa de calor: desviación % por planta y clase" sub="Rojo = sobre presupuesto · azul = bajo presupuesto · intensidad proporcional a la desviación">
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>Clase</th>{plantas.map((p) => <th key={p.id} className="num">{p.nombre}</th>)}</tr></thead>
                  <tbody>
                    {db.clases_costo.map((c) => (
                      <tr key={c.id}>
                        <td className="strong">{c.nombre}</td>
                        {plantas.map((p) => {
                          const a = aggCostos(db.costos_mensuales, { plantas: [p.id], clase: c.id, anio, desde, hasta: mes });
                          const alpha = Math.min(0.6, (Math.abs(a.desvPct) / 10) * 0.6);
                          return (
                            <td key={p.id} className="num" style={{ background: `rgba(var(${a.desvPct > 0 ? '--neg-rgb' : '--pos-rgb'}), ${alpha})` }} title={`${fSigno(a.desv)} MM`}>
                              <b>{fPct(a.desvPct, true)}</b><div className="xs">{fSigno(a.desv)} MM</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <CausasRaiz anio={anio} desvTotal={tot.desv} hasta={mes} />
        </>
      )}
    </>
  );
}

function CausasRaiz({ anio, desvTotal, hasta }: { anio: number; desvTotal: number; hasta: number }) {
  const { db, me, plantasVisibles, plantaDe, perfil, save, del } = useStore();
  const [form, setForm] = useState<CausaRaiz | null>(null);
  const [accion, setAccion] = useState<ReturnType<typeof nuevaAccion> | null>(null);
  const causas = db.causas_raiz.filter((c) => c.anio === anio && c.mes <= hasta && plantasVisibles.includes(c.planta_id)).sort((a, b) => b.impacto - a.impacto);
  const explicado = causas.reduce((s, c) => s + c.impacto, 0);
  const puedeCrear = db.plantas.some((p) => puedeEditarCostos(me, p.id));
  const clase = (id: string) => db.clases_costo.find((c) => c.id === id)?.nombre;

  return (
    <Card flush className="mt" title="Causas raíz y planes de acción"
      sub={desvTotal > 0 ? <>Causas cuantificadas: {fMM(explicado)} MM de {fMM(desvTotal)} MM de sobrecosto ({fPct((explicado / desvTotal) * 100)})</> : 'Sin sobrecosto en el período'}
      actions={puedeCrear && <button className="btn sm primary" onClick={() => setForm({ id: uid('ca-'), planta_id: me?.planta_id ?? plantasVisibles[0], clase_id: db.clases_costo[0]?.id, anio, mes: hasta, impacto: 0, causa: '', tipo_causa: TIPOS_CAUSA[0], estado: 'Abierta' })}><Icon name="plus" size={14} /> Causa raíz</button>}>
      {desvTotal > 0 && <div style={{ padding: '0 18px 12px' }}><Meter value={explicado} max={desvTotal} label="Sobrecosto explicado" /></div>}
      {causas.length ? (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Causa</th><th>Planta · Clase</th><th>Mes</th><th className="num">Impacto MM</th><th>Tipo</th><th>Estado</th><th>Acciones</th><th /></tr></thead>
            <tbody>
              {causas.map((c) => {
                const acc = db.acciones.filter((a) => a.causa_id === c.id);
                const puede = puedeEditarCostos(me, c.planta_id);
                return (
                  <tr key={c.id}>
                    <td style={{ minWidth: 240 }}>{c.causa}</td>
                    <td className="small nowrap">{plantaDe(c.planta_id)?.nombre}<div className="xs muted">{clase(c.clase_id)}</div></td>
                    <td className="small">{MESES[c.mes - 1]}</td>
                    <td className="num strong">{fMM(c.impacto)}</td>
                    <td className="small">{c.tipo_causa}</td>
                    <td>{puede ? <select className="select" style={{ width: 110 }} value={c.estado} onChange={(e) => save('causas_raiz', { ...c, estado: e.target.value as CausaRaiz['estado'] })}><option>Abierta</option><option>En plan</option><option>Cerrada</option></select> : <span className="badge">{c.estado}</span>}</td>
                    <td className="small" style={{ minWidth: 160 }}>
                      {acc.map((a) => <div key={a.id} className="xs">{a.estado === 'Hecha' ? '✓' : '•'} {a.descripcion} <span className="muted">({perfil(a.responsable_id)?.nombre})</span></div>)}
                      {puede && <button className="btn sm ghost" onClick={() => setAccion({ ...nuevaAccion(me), causa_id: c.id })}><Icon name="plus" size={12} /> Acción</button>}
                    </td>
                    <td className="right nowrap">
                      {puede && <button className="btn sm ghost icon" aria-label="Editar causa" onClick={() => setForm(c)}><Icon name="pencil" size={13} /></button>}
                      {puede && <button className="btn sm ghost icon" aria-label="Eliminar causa" onClick={() => confirm('¿Eliminar causa raíz y sus acciones?') && del('causas_raiz', c.id)}><Icon name="trash" size={13} /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty>Sin causas raíz registradas para el período.</Empty>}
      {form && <CausaForm inicial={form} onClose={() => setForm(null)} />}
      {accion && <AccionForm inicial={accion} onClose={() => setAccion(null)} />}
    </Card>
  );
}

function CausaForm({ inicial, onClose }: { inicial: CausaRaiz; onClose: () => void }) {
  const { db, me, save, toast } = useStore();
  const [f, setF] = useState(inicial);
  const plantas = db.plantas.filter((p) => puedeEditarCostos(me, p.id));
  return (
    <Modal title="Causa raíz de desviación" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={() => { if (!f.causa.trim()) return toast('Describe la causa'); save('causas_raiz', f); onClose(); }}>Guardar</button></>}>
      <div className="form-grid">
        <Field label="Causa raíz" full><textarea className="textarea" value={f.causa} onChange={(e) => setF({ ...f, causa: e.target.value })} autoFocus /></Field>
        <Field label="Planta"><select className="select" value={f.planta_id} onChange={(e) => setF({ ...f, planta_id: e.target.value })}>{plantas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
        <Field label="Clase de costo"><select className="select" value={f.clase_id} onChange={(e) => setF({ ...f, clase_id: e.target.value })}>{db.clases_costo.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>
        <Field label="Mes"><select className="select" value={f.mes} onChange={(e) => setF({ ...f, mes: Number(e.target.value) })}>{MESES.map((m, i) => <option key={m} value={i + 1}>{m} {f.anio}</option>)}</select></Field>
        <Field label="Impacto cuantificado" hint="(MM CLP)"><NumInput value={f.impacto} onChange={(v) => setF({ ...f, impacto: v ?? 0 })} /></Field>
        <Field label="Tipo de causa"><select className="select" value={f.tipo_causa} onChange={(e) => setF({ ...f, tipo_causa: e.target.value })}>{TIPOS_CAUSA.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Estado"><select className="select" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value as CausaRaiz['estado'] })}><option>Abierta</option><option>En plan</option><option>Cerrada</option></select></Field>
      </div>
    </Modal>
  );
}

type Metrica = 'presupuesto' | 'costo_real' | 'estandar';

function Presupuesto({ anio }: { anio: number }) {
  const { db, me, planta, save } = useStore();
  const [pl, setPl] = useState(planta !== 'todas' ? planta : me?.planta_id ?? db.plantas[0]?.id ?? '');
  const [met, setMet] = useState<Metrica>('presupuesto');
  const editable = puedeEditarCostos(me, pl);
  const get = (clase: string, mes: number) => db.costos_mensuales.find((c) => c.planta_id === pl && c.clase_id === clase && c.anio === anio && c.mes === mes);
  const setVal = (clase: string, mes: number, v: number | null) => {
    const prev = get(clase, mes);
    const row: CostoMensual = prev ?? { id: uid('co-'), planta_id: pl, clase_id: clase, anio, mes, presupuesto: 0, costo_real: null, estandar: 0 };
    save('costos_mensuales', { ...row, [met]: met === 'costo_real' ? v : v ?? 0 });
  };
  const val = (clase: string, mes: number) => { const r = get(clase, mes); return r ? r[met] : met === 'costo_real' ? null : 0; };
  const totMes = (mes: number) => db.clases_costo.reduce((s, c) => s + (val(c.id, mes) ?? 0), 0);
  const totClase = (clase: string) => MESES.reduce((s, _, i) => s + (val(clase, i + 1) ?? 0), 0);

  // Proyección de cierre: real de meses cerrados + presupuesto de los meses abiertos
  const proy = db.clases_costo.reduce((s, c) => s + MESES.reduce((t, _, i) => { const r = get(c.id, i + 1); return t + (r ? r.costo_real ?? r.presupuesto : 0); }, 0), 0);
  const pptoAnual = db.clases_costo.reduce((s, c) => s + MESES.reduce((t, _, i) => t + (get(c.id, i + 1)?.presupuesto ?? 0), 0), 0);

  return (
    <>
      <div className="filters">
        <select className="select" value={pl} onChange={(e) => setPl(e.target.value)} aria-label="Planta">{db.plantas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
        <Seg value={met} onChange={setMet} options={[['presupuesto', 'Presupuesto'], ['costo_real', 'Costo real'], ['estandar', 'Estándar']]} />
        <span className="small muted">{editable ? 'Edita las celdas; se guardan al salir de cada una.' : 'Solo lectura (edita Control de Gestión o el jefe de la planta).'}</span>
      </div>
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <Tile label={`Presupuesto anual ${anio}`} value={fMM(pptoAnual)} unit="MM" />
        <Tile label="Proyección de cierre" value={fMM(proy)} unit="MM" sub="Real de meses cerrados + presupuesto del resto" />
        <Tile label="Desviación proyectada" value={fSigno(proy - pptoAnual)} unit="MM" sub={pptoAnual ? fPct(((proy - pptoAnual) / pptoAnual) * 100, true) : '—'} />
      </div>
      <Card flush>
        <div className="table-wrap">
          <table className="tbl compact">
            <thead><tr><th>Clase de costo</th>{MESES.map((m) => <th key={m} className="num">{m}</th>)}<th className="num">Total</th></tr></thead>
            <tbody>
              {db.clases_costo.map((c) => (
                <tr key={c.id}>
                  <td className="strong nowrap">{c.nombre}</td>
                  {MESES.map((m, i) => (
                    <td key={m} className="num" style={{ minWidth: 76 }}>
                      {editable
                        ? <NumInput className="input cell" allowNull={met === 'costo_real'} value={val(c.id, i + 1)} onChange={(v) => setVal(c.id, i + 1, v)} aria-label={`${c.nombre} ${m}`} />
                        : val(c.id, i + 1) == null ? '—' : fMM(val(c.id, i + 1)!)}
                    </td>
                  ))}
                  <td className="num strong">{fMM(totClase(c.id))}</td>
                </tr>
              ))}
              <tr className="total"><td>Total</td>{MESES.map((m, i) => <td key={m} className="num">{fMM(totMes(i + 1))}</td>)}<td className="num">{fMM(MESES.reduce((s, _, i) => s + totMes(i + 1), 0))}</td></tr>
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
