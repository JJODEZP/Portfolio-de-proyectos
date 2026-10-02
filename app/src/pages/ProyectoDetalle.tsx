import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AHORRO, AvanceAhorro, Concepto, PanelAhorro } from '../components/ahorro';
import { LineChart } from '../components/charts';
import { Icon } from '../components/Icon';
import { Card, Empty, EtapaBadge, Field, Meter, Modal, NumInput, SaludBadge, Tile, saludColor } from '../components/ui';
import { useStore } from '../data/store';
import { useMetricas, type MetricaProyecto } from '../data/useMetricas';
import { diasEntre, hoyISO, periodoIdx, progresoKpi } from '../lib/calc';
import { fFecha, fMes, fMM, fNum, fPct0, fSigno, uid } from '../lib/format';
import { puedeAprobar, puedeComentar, puedeEditarAccion, puedeEditarProyecto, puedeEliminarProyecto } from '../lib/permissions';
import { MESES, type BeneficioMensual, type Hito, type Kpi, type Proyecto, type Replicacion } from '../lib/types';
import { AccionForm, nuevaAccion } from './Acciones';
import { AhorroMesForm, CheckinForm, Comentarios, HitoForm, KpiForm } from './Colaboracion';
import { ProyectoForm } from './ProyectoForm';

type Tab = 'resumen' | 'comentarios' | 'hitos' | 'beneficios' | 'kpis' | 'checkins' | 'acciones' | 'replicas';
type Rapido = 'hito' | 'avance' | 'ahorro' | 'accion' | 'kpi' | null;

export function ProyectoDetalle() {
  const { id } = useParams();
  const { db, me, perfil, plantaDe, save, del, toast } = useStore();
  const { map } = useMetricas();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('resumen');
  const [editando, setEditando] = useState(false);
  const [rapido, setRapido] = useState<Rapido>(null);
  const comentarioRef = useRef<HTMLTextAreaElement>(null);
  const [enfocar, setEnfocar] = useState(0);
  useEffect(() => { if (enfocar) comentarioRef.current?.focus(); }, [enfocar]);
  const m = id ? map.get(id) : undefined;
  if (!m) return <Card><Empty>Proyecto no encontrado. <Link to="/proyectos">Volver a proyectos</Link></Empty></Card>;
  const p = m.p;
  const editable = puedeEditarProyecto(me, p);

  const aprobar = () => {
    save('proyectos', { ...p, aprobado: true, aprobado_por: me!.id, aprobado_en: hoyISO(), etapa: p.etapa === 'Idea' ? 'Evaluación' : p.etapa });
    toast('Proyecto aprobado');
  };
  const eliminar = () => {
    if (!confirm(`¿Eliminar "${p.nombre}" con sus hitos, beneficios, KPIs, check-ins y acciones?`)) return;
    del('proyectos', p.id);
    nav('/proyectos');
  };

  const tabs: [Tab, string, number?][] = [
    ['resumen', 'Resumen'], ['comentarios', 'Comentarios', db.comentarios.filter((c) => c.proyecto_id === p.id).length],
    ['hitos', 'Hitos', db.hitos.filter((h) => h.proyecto_id === p.id).length],
    ['beneficios', 'Beneficios y ROI'], ['kpis', 'KPIs operativos', db.kpis.filter((k) => k.proyecto_id === p.id).length],
    ['checkins', 'Avances (check-ins)', db.checkins.filter((c) => c.proyecto_id === p.id).length],
    ['acciones', 'Acciones', db.acciones.filter((a) => a.proyecto_id === p.id).length],
    ['replicas', 'Replicabilidad', db.replicaciones.filter((r) => r.proyecto_id === p.id).length],
  ];

  return (
    <>
      <div className="no-print" style={{ marginBottom: 10 }}><Link to="/proyectos" className="small"><Icon name="arrowLeft" size={12} /> Proyectos</Link></div>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 6, marginBottom: 6 }}>
            <span className="badge">{p.codigo}</span><EtapaBadge etapa={p.etapa} />
            {p.etapa !== 'Idea' && <SaludBadge s={m.salud} />}
            {!p.aprobado && <span className="badge"><Icon name="clock" size={12} /> Pendiente de aprobación</span>}
            {p.aprobado && <span className="badge"><Icon name="shield" size={12} style={{ color: 'var(--good)' }} /> Aprobado por {perfil(p.aprobado_por)?.nombre ?? '—'}</span>}
          </div>
          <h1>{p.nombre}</h1>
          <p>{plantaDe(p.planta_id)?.nombre} · Líder: {perfil(p.lider_id)?.nombre ?? '—'} · Sponsor: {p.sponsor || '—'} · {p.tipo}</p>
        </div>
        <div className="row no-print">
          {!p.aprobado && puedeAprobar(me, p) && <button className="btn primary" onClick={aprobar}><Icon name="shield" /> Aprobar</button>}
          {editable && <button className="btn" onClick={() => setEditando(true)}><Icon name="pencil" /> Editar ficha</button>}
          <button className="btn" onClick={() => window.print()}><Icon name="printer" /> Imprimir</button>
          {puedeEliminarProyecto(me, p) && <button className="btn danger" onClick={eliminar}><Icon name="trash" /> Eliminar</button>}
        </div>
      </div>

      {(editable || puedeComentar(me)) && (
        <div className="quick no-print" role="toolbar" aria-label="Acciones rápidas">
          <span className="lbl">Actualizar proyecto:</span>
          {puedeComentar(me) && <button className="btn sm" onClick={() => { setTab('comentarios'); setEnfocar((n) => n + 1); }}><Icon name="message" size={14} /> Comentar</button>}
          {editable && <>
            <button className="btn sm" onClick={() => setRapido('hito')}><Icon name="flag" size={14} /> Agregar hito</button>
            <button className="btn sm" onClick={() => setRapido('avance')}><Icon name="gauge" size={14} /> Registrar avance</button>
            <button className="btn sm" onClick={() => setRapido('ahorro')}><Icon name="coins" size={14} /> Registrar ahorro del mes</button>
            <button className="btn sm" onClick={() => setRapido('accion')}><Icon name="checkSquare" size={14} /> Nueva acción</button>
            <button className="btn sm" onClick={() => setRapido('kpi')}><Icon name="target" size={14} /> Agregar KPI</button>
          </>}
        </div>
      )}
      {!editable && <div className="banner no-print" style={{ marginBottom: 14 }}><Icon name="info" /> Puedes comentar, pero solo el líder del proyecto, el jefe de la planta y Control de Gestión pueden editar sus datos.</div>}

      <div className="tabs no-print" role="tablist">
        {tabs.map(([k, l, n]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{n != null ? ` (${n})` : ''}</button>)}
      </div>

      {tab === 'resumen' && <TabResumen m={m} onVerComentarios={() => setTab('comentarios')} />}
      {tab === 'comentarios' && <Card title="Comentarios del equipo" sub="Preguntas, acuerdos y bloqueos. Todos los usuarios pueden comentar."><Comentarios ref={comentarioRef} proyecto={p} /></Card>}
      {tab === 'hitos' && <TabHitos p={p} editable={editable} />}
      {tab === 'beneficios' && <TabBeneficios m={m} editable={editable} />}
      {tab === 'kpis' && <TabKpis p={p} editable={editable} />}
      {tab === 'checkins' && <TabCheckins m={m} editable={editable} />}
      {tab === 'acciones' && <TabAcciones p={p} editable={editable} />}
      {tab === 'replicas' && <TabReplicas p={p} editable={editable} />}

      {editando && <ProyectoForm inicial={p} onClose={() => setEditando(false)} />}
      {rapido === 'hito' && <HitoForm proyecto={p} onClose={() => setRapido(null)} />}
      {rapido === 'ahorro' && <AhorroMesForm proyecto={p} onClose={() => setRapido(null)} />}
      {rapido === 'kpi' && <KpiForm proyecto={p} onClose={() => setRapido(null)} />}
      {rapido === 'accion' && <AccionForm inicial={{ ...nuevaAccion(me), proyecto_id: p.id, responsable_id: p.lider_id }} onClose={() => setRapido(null)} />}
      {rapido === 'avance' && (
        <Modal title="Registrar avance" onClose={() => setRapido(null)}>
          <CheckinForm proyecto={p} avance={m.avance} saludInicial={m.salud} onDone={() => setRapido(null)} />
        </Modal>
      )}
    </>
  );
}

function TabResumen({ m, onVerComentarios }: { m: MetricaProyecto; onVerComentarios: () => void }) {
  const { db, perfil } = useStore();
  const p = m.p;
  const op = db.oportunidades.find((o) => o.id === p.oportunidad_id);
  const clase = db.clases_costo.find((c) => c.id === p.clase_id);
  const ultimos = db.comentarios.filter((c) => c.proyecto_id === p.id).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 2);
  const kpis = db.kpis.filter((k) => k.proyecto_id === p.id);
  return (
    <div className="stack">
      <div className="grid g4">
        <Tile label="Avance real" value={`${m.avance}%`} sub={<>Plan a la fecha: {m.esperado}% · {m.atrasados} hitos atrasados</>}>
          <div style={{ marginTop: 10 }}><Meter value={m.avance} mark={m.esperado} label="Avance" /></div>
        </Tile>
        <div className="card tile">
          <div className="label">Ahorro del proyecto</div>
          <div style={{ marginTop: 8 }}><AvanceAhorro logrado={m.acum.real} esperado={m.acum.plan} compacto /></div>
          <div className="sub"><Concepto c="comprometido">Compromete {fMM(p.ahorro_comprometido_anual)} MM/año</Concepto></div>
        </div>
        <Tile label="ROI esperado" value={m.fin.roiEsperado == null ? '—' : fPct0(m.fin.roiEsperado)} sub={<>Inversión {fMM(m.fin.inversion)} MM · payback {m.fin.paybackPlan == null ? '—' : `${fNum(m.fin.paybackPlan)} meses`}</>} />
        <div className="card tile">
          <div className="label">Salud del proyecto</div>
          <div className="stack" style={{ gap: 6, marginTop: 8 }}>
            <div className="row between small"><span className="muted">Plazo (hitos)</span><SaludBadge s={m.plazo} /></div>
            <div className="row between small"><span className="muted">Beneficio vs plan</span><SaludBadge s={m.beneficio} /></div>
            <div className="row between small"><span className="muted">Reporte del líder</span><SaludBadge s={m.checkin?.salud ?? null} /></div>
          </div>
        </div>
      </div>
      <div className="grid g2">
        <Card title="Ficha del proyecto">
          <dl className="kv">
            <dt>Objetivo</dt><dd style={{ fontWeight: 500 }}>{p.descripcion || '—'}</dd>
            <dt>Clase de costo</dt><dd>{clase?.nombre}</dd>
            <dt>Oportunidad</dt><dd>{op?.nombre ?? '—'}</dd>
            <dt>Línea base</dt><dd>{p.linea_base || '—'}</dd>
            <dt>Tipo de beneficio</dt><dd>{p.tipo_beneficio}</dd>
            <dt>{AHORRO.comprometido.label}</dt><dd>{fMM(p.ahorro_comprometido_anual)} MM/año</dd>
            <dt>Inversión</dt><dd>CAPEX {fMM(p.inversion_capex)} · OPEX {fMM(p.inversion_opex)} MM</dd>
            <dt>Fechas</dt><dd>{fFecha(p.fecha_inicio)} → {fFecha(p.fecha_fin_plan)}{p.fecha_fin_real ? ` (real ${fFecha(p.fecha_fin_real)})` : ''}</dd>
          </dl>
        </Card>
        <Card title="Último avance reportado" sub={m.checkin ? `${fFecha(m.checkin.fecha)} · hace ${diasEntre(m.checkin.fecha, hoyISO())} días` : undefined}>
          {m.checkin ? (
            <div className="stack" style={{ gap: 10 }}>
              <div className="row"><SaludBadge s={m.checkin.salud} /><span className="small muted">Avance reportado {m.checkin.avance}%</span></div>
              <div className="small">{m.checkin.comentario}</div>
              {m.checkin.riesgos && <div className="small"><b>Riesgos: </b>{m.checkin.riesgos}</div>}
              {m.checkin.proximos_pasos && <div className="small"><b>Próximos pasos: </b>{m.checkin.proximos_pasos}</div>}
            </div>
          ) : <Empty>Sin reportes de avance todavía.</Empty>}
          <div className="mt">
            <div className="row between" style={{ marginBottom: 4 }}><h3>Últimos comentarios</h3><button className="btn sm ghost" onClick={onVerComentarios}>Ver todos / comentar</button></div>
            {ultimos.length ? ultimos.map((c) => (
              <div key={c.id} className="small" style={{ padding: '6px 0', borderBottom: '1px solid var(--grid)' }}>
                <b>{perfil(c.autor_id)?.nombre}</b> <span className="xs muted">{fFecha(c.fecha)}</span>
                <div className="muted" style={{ overflowWrap: 'anywhere' }}>{c.texto}</div>
              </div>
            )) : <p className="small muted" style={{ margin: 0 }}>Nadie ha comentado aún.</p>}
          </div>
          {kpis.length > 0 && (
            <div className="mt">
              <h3 style={{ marginBottom: 8 }}>KPIs operativos</h3>
              {kpis.map((k) => {
                const pr = progresoKpi(k);
                return (
                  <div key={k.id} style={{ marginBottom: 8 }}>
                    <div className="row between small"><span>{k.nombre}</span><span className="muted num">{fNum(k.linea_base, 2)} → {k.actual == null ? '—' : fNum(k.actual, 2)} / meta {fNum(k.meta, 2)} {k.unidad}</span></div>
                    <div style={{ marginTop: 4 }}><Meter value={pr ?? 0} max={100} label={k.nombre} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- hitos
function TabHitos({ p, editable }: { p: Proyecto; editable: boolean }) {
  const { db, save, del } = useStore();
  const hitos = db.hitos.filter((h) => h.proyecto_id === p.id).sort((a, b) => a.fecha_plan.localeCompare(b.fecha_plan));
  const hoy = hoyISO();
  const fechas = [p.fecha_inicio, p.fecha_fin_plan, hoy, ...hitos.flatMap((h) => [h.fecha_plan, h.fecha_real ?? h.fecha_plan])].map((d) => Date.parse(d));
  const t0 = Math.min(...fechas), t1 = Math.max(...fechas);
  const pos = (d: string) => `${((Date.parse(d) - t0) / (t1 - t0 || 1)) * 100}%`;
  const upd = (h: Hito, c: Partial<Hito>) => save('hitos', { ...h, ...c });
  const [nuevo, setNuevo] = useState(false);
  const agregar = () => setNuevo(true);
  const pesoTotal = hitos.reduce((s, h) => s + h.peso, 0);

  return (
    <div className="stack">
      <Card title="Cronograma" sub="Rombo = fecha plan · círculo = fecha real · línea índigo = hoy">
        {hitos.length ? (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 560 }}>
              {hitos.map((h) => {
                const atrasado = !h.fecha_real && h.fecha_plan < hoy;
                return (
                  <div className="gantt-row" key={h.id}>
                    <div className="small clip" title={h.nombre}>{h.nombre}</div>
                    <div className="gantt-track">
                      <span className="gantt-today" style={{ left: pos(hoy) }} />
                      {h.fecha_real && <span style={{ position: 'absolute', top: 16, height: 2, left: `min(${pos(h.fecha_plan)}, ${pos(h.fecha_real)})`, width: `${Math.abs(Date.parse(h.fecha_real) - Date.parse(h.fecha_plan)) / (t1 - t0 || 1) * 100}%`, background: 'var(--line)' }} />}
                      <span className="diamond" title={`Plan ${fFecha(h.fecha_plan)}`} style={{ left: pos(h.fecha_plan), background: h.fecha_real ? 'var(--line)' : atrasado ? 'var(--crit)' : 'var(--series-soft)', border: '1px solid var(--surface)' }} />
                      {h.fecha_real && <span title={`Real ${fFecha(h.fecha_real)}`} style={{ position: 'absolute', top: 10, left: pos(h.fecha_real), width: 14, height: 14, transform: 'translateX(-7px)', borderRadius: 99, background: 'var(--series)', border: '2px solid var(--surface)' }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : <Empty>Sin hitos. Agrega hitos para medir el avance real vs el plan.</Empty>}
      </Card>
      <Card flush title="Hitos" sub={`El avance del proyecto se calcula con el peso de los hitos completados (peso total ${pesoTotal})`}
        actions={editable && <button className="btn sm primary" onClick={agregar}><Icon name="plus" size={14} /> Hito</button>}>
        <div className="table-wrap">
          <table className="tbl compact">
            <thead><tr><th>Hito</th><th>Fecha plan</th><th>Fecha real</th><th className="num">Peso</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {hitos.map((h) => {
                const atraso = !h.fecha_real && h.fecha_plan < hoy ? diasEntre(h.fecha_plan, hoy) : 0;
                const desfase = h.fecha_real ? diasEntre(h.fecha_plan, h.fecha_real) : 0;
                return (
                  <tr key={h.id}>
                    <td style={{ minWidth: 220 }}>{editable ? <input className="input" defaultValue={h.nombre} onBlur={(e) => e.target.value !== h.nombre && upd(h, { nombre: e.target.value })} /> : h.nombre}</td>
                    <td>{editable ? <input className="input" type="date" value={h.fecha_plan} onChange={(e) => upd(h, { fecha_plan: e.target.value })} /> : fFecha(h.fecha_plan)}</td>
                    <td>{editable ? <input className="input" type="date" value={h.fecha_real ?? ''} onChange={(e) => upd(h, { fecha_real: e.target.value || null })} /> : fFecha(h.fecha_real)}</td>
                    <td className="num" style={{ width: 80 }}>{editable ? <NumInput className="input cell" value={h.peso} onChange={(v) => upd(h, { peso: Math.max(0, v ?? 0) })} aria-label="Peso" /> : h.peso}</td>
                    <td className="small nowrap">
                      {h.fecha_real
                        ? <span className="row" style={{ gap: 4 }}><Icon name="checkCircle" size={13} style={{ color: 'var(--good)' }} /> Completado{desfase > 0 ? ` (+${desfase} d)` : ''}</span>
                        : atraso ? <span className="row" style={{ gap: 4 }}><Icon name="alert" size={13} style={{ color: 'var(--crit)' }} /> Atrasado {atraso} d</span>
                          : <span className="row muted" style={{ gap: 4 }}><Icon name="clock" size={13} /> Pendiente</span>}
                    </td>
                    <td className="right nowrap">
                      {editable && !h.fecha_real && <button className="btn sm" onClick={() => upd(h, { fecha_real: hoy })}><Icon name="check" size={13} /> Completar</button>}
                      {editable && <button className="btn sm ghost icon" aria-label="Eliminar hito" onClick={() => confirm('¿Eliminar hito?') && del('hitos', h.id)}><Icon name="trash" size={13} /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {nuevo && <HitoForm proyecto={p} onClose={() => setNuevo(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------- beneficios
function TabBeneficios({ m, editable }: { m: MetricaProyecto; editable: boolean }) {
  const { db, save, del } = useStore();
  const { cierre } = useMetricas();
  const p = m.p;
  const [generar, setGenerar] = useState(false);
  const [registrar, setRegistrar] = useState(false);
  const bens = db.beneficios_mensuales.filter((b) => b.proyecto_id === p.id).sort((a, b) => periodoIdx(a) - periodoIdx(b));
  const fin = m.fin;
  let accP = 0, accR = 0;
  const filas = bens.map((b) => {
    accP += b.ahorro_plan;
    if (b.ahorro_real != null) accR += b.ahorro_real;
    return { b, accP, accR: b.ahorro_real != null ? accR : null };
  });
  const upd = (b: BeneficioMensual, c: Partial<BeneficioMensual>) => save('beneficios_mensuales', { ...b, ...c });
  const agregarMes = () => {
    const ult = bens[bens.length - 1];
    const d = ult ? new Date(ult.anio, ult.mes, 1) : new Date();
    save('beneficios_mensuales', { id: uid('be-'), proyecto_id: p.id, anio: d.getFullYear(), mes: d.getMonth() + 1, ahorro_plan: Math.round((p.ahorro_comprometido_anual / 12) * 10) / 10, ahorro_real: null });
  };

  return (
    <div className="stack">
      <Card title="Ahorro del proyecto" sub={`Línea base: ${p.linea_base || 'sin definir'} · ${p.tipo_beneficio}`}
        actions={editable && <button className="btn sm primary" onClick={() => setRegistrar(true)}><Icon name="coins" size={14} /> Registrar ahorro del mes</button>}>
        <PanelAhorro logrado={m.acum.real} esperado={m.acum.plan} comprometido={p.ahorro_comprometido_anual} />
      </Card>
      <div className="grid g3">
        <Tile label="Inversión total" value={fMM(fin.inversion)} unit="MM" sub={<>CAPEX {fMM(p.inversion_capex)} · OPEX {fMM(p.inversion_opex)}</>} />
        <Tile label="ROI esperado (anual)" value={fin.roiEsperado == null ? '—' : fPct0(fin.roiEsperado)} sub={<>Payback plan {fin.paybackPlan == null ? '—' : `${fNum(fin.paybackPlan)} meses`}</>} />
        <Tile label="ROI realizado" value={fin.roiReal == null ? '—' : fPct0(fin.roiReal)}
          sub={fin.inversion ? (fin.paybackReal ? <>Inversión recuperada en {fin.paybackReal} meses</> : <>Falta recuperar {fMM(Math.max(0, fin.inversion - fin.realTotal))} MM</>) : 'Sin inversión registrada'} />
      </div>
      <Card title="Curva de ahorro acumulado" sub="Millones de CLP · si la línea verde queda bajo la naranja, el proyecto va atrasado">
        {bens.length ? (
          <LineChart labels={bens.map((b) => fMes(b.anio, b.mes))} series={[
            { nombre: AHORRO.logrado.label, valores: filas.map((f) => (f.accR == null ? null : Math.round(f.accR * 10) / 10)), color: AHORRO.logrado.color },
            { nombre: 'Esperado (plan)', valores: filas.map((f) => Math.round(f.accP * 10) / 10), color: AHORRO.esperado.color },
            ...(fin.inversion ? [{ nombre: 'Inversión a recuperar', valores: filas.map(() => fin.inversion), color: 'var(--c-meta)', dashed: true }] : []),
          ]} />
        ) : <Empty>Sin curva de beneficios. {editable && 'Genera la curva plan a partir del ahorro comprometido.'}</Empty>}
      </Card>
      <Card flush title="Registro mensual de ahorro" sub={`Ahorro = diferencia vs línea base, en MM CLP. Meses cerrados hasta ${MESES[cierre.mes - 1]} ${cierre.anio}.`}
        actions={editable && <>
          <button className="btn sm" onClick={() => setGenerar(true)}><Icon name="trend" size={14} /> Generar curva plan</button>
          <button className="btn sm" onClick={agregarMes}><Icon name="plus" size={14} /> Agregar mes</button>
        </>}>
        <div className="table-wrap">
          <table className="tbl compact">
            <thead><tr><th>Mes</th><th className="num"><Concepto c="esperado">Esperado</Concepto></th><th className="num"><Concepto c="logrado">Logrado</Concepto></th><th className="num">Diferencia</th><th className="num">Esperado acum.</th><th className="num">Logrado acum.</th><th /></tr></thead>
            <tbody>
              {filas.map(({ b, accP: ap, accR: ar }) => {
                const d = b.ahorro_real == null ? null : b.ahorro_real - b.ahorro_plan;
                return (
                  <tr key={b.id}>
                    <td className="nowrap">{fMes(b.anio, b.mes)}{periodoIdx(b) > periodoIdx(cierre) && <span className="xs muted"> · abierto</span>}</td>
                    <td className="num" style={{ width: 110 }}>{editable ? <NumInput className="input cell" value={b.ahorro_plan} onChange={(v) => upd(b, { ahorro_plan: v ?? 0 })} aria-label="Plan" /> : fNum(b.ahorro_plan)}</td>
                    <td className="num" style={{ width: 110 }}>{editable ? <NumInput className="input cell" allowNull value={b.ahorro_real} onChange={(v) => upd(b, { ahorro_real: v })} aria-label="Real" /> : b.ahorro_real == null ? '—' : fNum(b.ahorro_real)}</td>
                    <td className={`num strong ${d == null ? '' : d < 0 ? 'txt-crit' : 'txt-good'}`}>{d == null ? '—' : `${fSigno(d)} ${d < 0 ? '▼' : '▲'}`}</td>
                    <td className="num muted">{fMM(ap)}</td>
                    <td className="num">{ar == null ? '—' : fMM(ar)}</td>
                    <td className="right">{editable && <button className="btn sm ghost icon" aria-label="Eliminar mes" onClick={() => del('beneficios_mensuales', b.id)}><Icon name="trash" size={13} /></button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {generar && <GenerarCurva p={p} onClose={() => setGenerar(false)} existentes={bens} />}
      {registrar && <AhorroMesForm proyecto={p} onClose={() => setRegistrar(false)} />}
    </div>
  );
}

function GenerarCurva({ p, onClose, existentes }: { p: Proyecto; onClose: () => void; existentes: BeneficioMensual[] }) {
  const { save, toast } = useStore();
  const d0 = new Date(p.fecha_fin_plan);
  const [inicio, setInicio] = useState(`${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}`);
  const [meses, setMeses] = useState(12);
  const [rampa, setRampa] = useState(true);
  const generar = () => {
    const [y, mo] = inicio.split('-').map(Number);
    const mensual = p.ahorro_comprometido_anual / 12;
    const rows: BeneficioMensual[] = [];
    for (let k = 0; k < meses; k++) {
      const d = new Date(y, mo - 1 + k, 1);
      const anio = d.getFullYear(), mes = d.getMonth() + 1;
      const prev = existentes.find((b) => b.anio === anio && b.mes === mes);
      const factor = rampa ? ([0.4, 0.7][k] ?? 1) : 1;
      rows.push({ id: prev?.id ?? uid('be-'), proyecto_id: p.id, anio, mes, ahorro_plan: Math.round(mensual * factor * 10) / 10, ahorro_real: prev?.ahorro_real ?? null });
    }
    save('beneficios_mensuales', rows);
    toast(`Curva plan generada (${meses} meses)`);
    onClose();
  };
  return (
    <Modal title="Generar curva plan de ahorro" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={generar}>Generar</button></>}>
      <p className="small muted" style={{ marginTop: 0 }}>Distribuye el ahorro comprometido ({fMM(p.ahorro_comprometido_anual)} MM/año) en meses. Los valores reales ya cargados se conservan.</p>
      <div className="form-grid">
        <Field label="Mes de inicio del beneficio"><input className="input" type="month" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Field>
        <Field label="Número de meses"><NumInput value={meses} onChange={(v) => setMeses(Math.max(1, Math.min(36, Math.round(v ?? 12))))} /></Field>
        <label className="check full"><input type="checkbox" checked={rampa} onChange={(e) => setRampa(e.target.checked)} /> Rampa de estabilización (40 % → 70 % → 100 %)</label>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- KPIs
function TabKpis({ p, editable }: { p: Proyecto; editable: boolean }) {
  const { db, save, del } = useStore();
  const kpis = db.kpis.filter((k) => k.proyecto_id === p.id);
  const upd = (k: Kpi, c: Partial<Kpi>) => save('kpis', { ...k, ...c });
  return (
    <Card flush title="KPIs operativos (beneficios no financieros)" sub="Progreso = avance desde la línea base hacia la meta"
      actions={editable && <button className="btn sm primary" onClick={() => save('kpis', { id: uid('kp-'), proyecto_id: p.id, nombre: 'Nuevo KPI', unidad: '%', linea_base: 0, meta: 0, actual: null, sentido: 'menor' })}><Icon name="plus" size={14} /> KPI</button>}>
      {kpis.length ? (
        <div className="table-wrap">
          <table className="tbl compact">
            <thead><tr><th>Indicador</th><th>Unidad</th><th>Mejor si</th><th className="num">Línea base</th><th className="num">Meta</th><th className="num">Actual</th><th style={{ minWidth: 140 }}>Progreso</th><th /></tr></thead>
            <tbody>
              {kpis.map((k) => {
                const pr = progresoKpi(k);
                return (
                  <tr key={k.id}>
                    <td style={{ minWidth: 200 }}>{editable ? <input className="input" defaultValue={k.nombre} onBlur={(e) => e.target.value !== k.nombre && upd(k, { nombre: e.target.value })} /> : k.nombre}</td>
                    <td style={{ width: 110 }}>{editable ? <input className="input" defaultValue={k.unidad} onBlur={(e) => e.target.value !== k.unidad && upd(k, { unidad: e.target.value })} /> : k.unidad}</td>
                    <td style={{ width: 120 }}>{editable ? <select className="select" value={k.sentido} onChange={(e) => upd(k, { sentido: e.target.value as Kpi['sentido'] })}><option value="menor">Menor</option><option value="mayor">Mayor</option></select> : k.sentido}</td>
                    <td className="num" style={{ width: 110 }}>{editable ? <NumInput className="input cell" value={k.linea_base} onChange={(v) => upd(k, { linea_base: v ?? 0 })} aria-label="Línea base" /> : fNum(k.linea_base, 2)}</td>
                    <td className="num" style={{ width: 110 }}>{editable ? <NumInput className="input cell" value={k.meta} onChange={(v) => upd(k, { meta: v ?? 0 })} aria-label="Meta" /> : fNum(k.meta, 2)}</td>
                    <td className="num" style={{ width: 110 }}>{editable ? <NumInput className="input cell" allowNull value={k.actual} onChange={(v) => upd(k, { actual: v })} aria-label="Actual" /> : k.actual == null ? '—' : fNum(k.actual, 2)}</td>
                    <td><Meter value={pr ?? 0} label={k.nombre} /><div className="xs muted num" style={{ marginTop: 3 }}>{pr == null ? 'sin medición' : `${pr}% hacia la meta`}</div></td>
                    <td className="right">{editable && <button className="btn sm ghost icon" aria-label="Eliminar KPI" onClick={() => confirm('¿Eliminar KPI?') && del('kpis', k.id)}><Icon name="trash" size={13} /></button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty>Sin KPIs. Ejemplos: rendimiento %, HH/cabeza, kWh/t, merma %.</Empty>}
    </Card>
  );
}

// ---------------------------------------------------------------- check-ins
function TabCheckins({ m, editable }: { m: MetricaProyecto; editable: boolean }) {
  const { db, perfil } = useStore();
  const p = m.p;
  const lista = db.checkins.filter((c) => c.proyecto_id === p.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  return (
    <div className="grid g3">
      {editable && (
        <Card title="Registrar avance" sub={`Avance calculado: ${m.avance}% (plan ${m.esperado}%)`}>
          <CheckinForm proyecto={p} avance={m.avance} saludInicial={m.salud} />
        </Card>
      )}
      <Card className={editable ? 'span2' : ''} title="Historial de avances">
        {lista.length ? (
          <div className="timeline">
            {lista.map((c) => (
              <div className="tl-item" key={c.id}>
                <span className="tl-dot" style={{ background: saludColor(c.salud) }} />
                <div>
                  <div className="row small" style={{ gap: 8 }}><b>{fFecha(c.fecha)}</b><SaludBadge s={c.salud} /><span className="muted">{perfil(c.autor_id)?.nombre} · avance {c.avance}%</span></div>
                  <div className="small" style={{ marginTop: 4 }}>{c.comentario}</div>
                  {c.riesgos && <div className="small muted" style={{ marginTop: 2 }}><b>Riesgos:</b> {c.riesgos}</div>}
                  {c.proximos_pasos && <div className="small muted" style={{ marginTop: 2 }}><b>Próximos pasos:</b> {c.proximos_pasos}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : <Empty>Sin reportes. El líder debería reportar avance al menos cada 2 semanas.</Empty>}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- acciones
function TabAcciones({ p, editable }: { p: Proyecto; editable: boolean }) {
  const { db, me, perfil, save } = useStore();
  const [form, setForm] = useState<ReturnType<typeof nuevaAccion> | null>(null);
  const lista = db.acciones.filter((a) => a.proyecto_id === p.id).sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
  const hoy = hoyISO();
  return (
    <Card flush title="Plan de acción del proyecto" actions={editable && <button className="btn sm primary" onClick={() => setForm({ ...nuevaAccion(me), proyecto_id: p.id, responsable_id: p.lider_id })}><Icon name="plus" size={14} /> Acción</button>}>
      {lista.length ? (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Acción</th><th>Responsable</th><th>Vence</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {lista.map((a) => {
                const puede = puedeEditarAccion(me, a, db);
                const vencida = a.estado !== 'Hecha' && a.fecha_vencimiento < hoy;
                return (
                  <tr key={a.id}>
                    <td>{a.descripcion}</td>
                    <td className="small">{perfil(a.responsable_id)?.nombre ?? '—'}</td>
                    <td className="small nowrap">{vencida && <Icon name="alert" size={12} style={{ color: 'var(--crit)', marginRight: 4 }} />}{fFecha(a.fecha_vencimiento)}{vencida ? ' · vencida' : ''}</td>
                    <td>{puede ? <select className="select" style={{ width: 120 }} value={a.estado} onChange={(e) => save('acciones', { ...a, estado: e.target.value as typeof a.estado })}><option>Pendiente</option><option>En curso</option><option>Hecha</option></select> : a.estado}</td>
                    <td className="right">{puede && <button className="btn sm ghost icon" aria-label="Editar" onClick={() => setForm(a)}><Icon name="pencil" size={13} /></button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty>Sin acciones vinculadas.</Empty>}
      {form && <AccionForm inicial={form} onClose={() => setForm(null)} />}
    </Card>
  );
}

// ---------------------------------------------------------------- replicabilidad
function TabReplicas({ p, editable }: { p: Proyecto; editable: boolean }) {
  const { db, save, del } = useStore();
  const otras = db.plantas.filter((x) => x.id !== p.planta_id);
  const set = (plantaId: string, estado: Replicacion['estado'] | '') => {
    const actual = db.replicaciones.find((r) => r.proyecto_id === p.id && r.planta_id === plantaId);
    if (!estado) { if (actual) del('replicaciones', actual.id); return; }
    save('replicaciones', { id: actual?.id ?? uid('re-'), proyecto_id: p.id, planta_id: plantaId, estado });
  };
  return (
    <Card title="Replicabilidad entre plantas" sub="Potencial de replicar la iniciativa y estado de la réplica en cada planta">
      <div className="stack" style={{ gap: 10 }}>
        {otras.map((pl) => {
          const r = db.replicaciones.find((x) => x.proyecto_id === p.id && x.planta_id === pl.id);
          return (
            <div key={pl.id} className="row between" style={{ borderBottom: '1px solid var(--grid)', paddingBottom: 10 }}>
              <span className="row"><Icon name="factory" size={14} /><b>{pl.nombre}</b></span>
              {editable ? (
                <select className="select" style={{ width: 180 }} value={r?.estado ?? ''} onChange={(e) => set(pl.id, e.target.value as Replicacion['estado'] | '')}>
                  <option value="">No aplica</option><option>Potencial</option><option>En curso</option><option>Replicado</option>
                </select>
              ) : <span className="badge">{r?.estado ?? 'No aplica'}</span>}
            </div>
          );
        })}
        {!otras.length && <Empty>No hay otras plantas registradas.</Empty>}
      </div>
    </Card>
  );
}
