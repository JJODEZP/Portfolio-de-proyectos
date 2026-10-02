import { Fragment, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AHORRO, Concepto } from '../components/ahorro';
import { Icon } from '../components/Icon';
import { Card, EtapaBadge, Field, Modal, NumInput } from '../components/ui';
import { useStore } from '../data/store';
import { useMetricas } from '../data/useMetricas';
import { brechaAnualizada, potencialOportunidad } from '../lib/calc';
import { fMM, fNum, fPct0, uid } from '../lib/format';
import { puedeCrearProyecto, puedeEditarOportunidades } from '../lib/permissions';
import type { Oportunidad, Proyecto } from '../lib/types';
import { nuevoProyecto, ProyectoForm } from './ProyectoForm';

/** Barra de cobertura sobre el potencial: violeta claro = potencial · azul = en proyectos · verde = logrado. */
function Cobertura({ potencial, enProyectos, logrado }: { potencial: number; enProyectos: number; logrado: number }) {
  const max = Math.max(potencial, enProyectos, 1);
  return (
    <div style={{ width: '100%' }}>
      <div className="cob" role="img" aria-label={`En proyectos ${fMM(enProyectos)} de ${fMM(potencial)} de potencial`}>
        <i style={{ width: `${(enProyectos / max) * 100}%`, background: AHORRO.comprometido.color }} />
        <i style={{ width: `${(logrado / max) * 100}%`, background: AHORRO.logrado.color }} />
      </div>
      <span className="xs muted num">{potencial ? `${fPct0((enProyectos / potencial) * 100)} cubierto` : '—'}</span>
    </div>
  );
}

export function Oportunidades() {
  const { db, me, planta, plantasVisibles } = useStore();
  const { map, anio } = useMetricas();
  const nav = useNavigate();
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set(db.clases_costo.map((c) => c.id)));
  const [form, setForm] = useState<Oportunidad | null>(null);
  const [nuevo, setNuevo] = useState<Proyecto | null>(null);
  const editable = puedeEditarOportunidades(me);
  // En proyectos solo cuentan los proyectos vigentes (no ideas), igual que el «comprometido» del resto de la app
  const proyectos = db.proyectos.filter((p) => plantasVisibles.includes(p.planta_id));
  const toggle = (id: string) => setAbiertos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const datosOp = (o: Oportunidad) => {
    const ps = proyectos.filter((p) => p.oportunidad_id === o.id);
    const vigentes = ps.filter((p) => p.etapa !== 'Idea');
    const enProy = vigentes.reduce((s, p) => s + p.ahorro_comprometido_anual, 0);
    return { ps, enProy, ideas: ps.filter((p) => p.etapa === 'Idea').reduce((s, p) => s + p.ahorro_comprometido_anual, 0), logrado: ps.reduce((s, p) => s + (map.get(p.id)?.acum.real ?? 0), 0), sin: Math.max(0, o.potencial - enProy) };
  };
  const brechaTotal = brechaAnualizada(db.costos_mensuales, { plantas: plantasVisibles, anio });
  const tot = db.oportunidades.reduce((a, o) => { const d = datosOp(o); return { pot: a.pot + o.potencial, en: a.en + d.enProy, log: a.log + d.logrado, sin: a.sin + d.sin }; }, { pot: 0, en: 0, log: 0, sin: 0 });
  const sinOp = proyectos.filter((p) => !p.oportunidad_id);
  const pendientes = db.oportunidades.map((o) => ({ o, d: datosOp(o) })).filter((x) => x.d.sin > 0).sort((a, b) => b.d.sin - a.d.sin);

  const crearProyecto = (o: Oportunidad, sin: number) => setNuevo({
    ...nuevoProyecto(db, me, planta), clase_id: o.clase_id, oportunidad_id: o.id,
    nombre: o.nombre, ahorro_comprometido_anual: Math.round(sin), descripcion: `Capturar el potencial de «${o.nombre}». Referencia: ${o.referencia}`,
  });

  const pasos = [
    { c: 'brecha' as const, n: '1 · Brecha medida', v: brechaTotal.anual, r: `${brechaTotal.meses} meses cerrados`, d: 'Sobrecosto vs costo estándar, llevado a un año. Dice cuánto «sobra» hoy en los costos.' },
    { c: 'potencial' as const, n: '2 · Potencial', v: tot.pot, r: brechaTotal.anual > 0 ? `${fPct0((tot.pot / brechaTotal.anual) * 100)} de la brecha` : '', d: 'Suma de las oportunidades identificadas: costo base × % de mejora alcanzable.' },
    { c: 'comprometido' as const, n: '3 · En proyectos', v: tot.en, r: tot.pot ? `${fPct0((tot.en / tot.pot) * 100)} del potencial` : '', d: 'Ahorro anual comprometido por los proyectos que atacan cada oportunidad (sin contar ideas).' },
    { c: 'logrado' as const, n: '4 · Logrado', v: tot.log, u: 'MM a la fecha', r: tot.en ? `${fPct0((tot.log / tot.en) * 100)} del comprometido anual` : '', d: 'Ahorro real medido de esos proyectos en el año, hasta el último mes cerrado.' },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Árbol de oportunidades</h1>
          <p>De dónde puede salir el ahorro: clase de costo → oportunidad → proyectos. Responde «¿qué parte del ahorro posible ya estamos atacando?»</p>
        </div>
        <Link className="btn" to="/metodologia?s=oportunidades"><Icon name="info" /> Cómo se calcula</Link>
      </div>

      <div className="cascada">
        {pasos.map((p, i) => (
          <div key={p.c} className="cas-paso" style={{ ['--cas-color' as string]: AHORRO[p.c].color }}>
            <span className="n">{p.n}</span>
            <span className="v num">{fMM(p.v)}<small>{'u' in p ? p.u : 'MM/año'}</small></span>
            {p.r && <span className="r">{p.r}</span>}
            <span className="d">{p.d}</span>
            {i < pasos.length - 1 && <span className="flecha" aria-hidden="true"><Icon name="chevronRight" size={13} /></span>}
          </div>
        ))}
      </div>
      <div className="banner mt">
        <Icon name="info" />
        <span>
          <b>Sin proyecto: {fMM(tot.sin)} MM/año</b> de potencial que ningún proyecto ataca todavía. Es la cartera para nuevas iniciativas (ver lista al final).
          {planta !== 'todas' && ' El potencial de cada oportunidad es corporativo; brecha, proyectos y logrado se filtran por la planta seleccionada.'}
        </span>
      </div>

      <Card flush className="mt" title="Árbol" sub="Haz clic en una clase u oportunidad para abrirla. Bajo cada oportunidad se muestra cómo se calculó su potencial.">
        <div className="legend" style={{ padding: '0 18px' }}>
          <Concepto c="potencial">Potencial (fondo violeta)</Concepto>
          <Concepto c="comprometido">En proyectos</Concepto>
          <Concepto c="logrado" />
        </div>
        <div className="table-wrap">
          <div className="tree2" style={{ minWidth: 860 }}>
            <div className="h">Clase / oportunidad / proyecto</div>
            <div className="h r"><Concepto c="brecha">Brecha</Concepto></div>
            <div className="h r"><Concepto c="potencial" /></div>
            <div className="h r"><Concepto c="comprometido">En proyectos</Concepto></div>
            <div className="h r"><Concepto c="logrado" /></div>
            <div className="h r"><Concepto c="sinProyecto" /></div>
            <div className="h">Cobertura</div>

            {db.clases_costo.map((c) => {
              const ops = db.oportunidades.filter((o) => o.clase_id === c.id);
              const ds = ops.map(datosOp);
              const pot = ops.reduce((s, o) => s + o.potencial, 0);
              const en = ds.reduce((s, d) => s + d.enProy, 0), log = ds.reduce((s, d) => s + d.logrado, 0), sin = ds.reduce((s, d) => s + d.sin, 0);
              const br = brechaAnualizada(db.costos_mensuales, { plantas: plantasVisibles, clase: c.id, anio });
              const abierto = abiertos.has(c.id);
              return (
                <Fragment key={c.id}>
                  <div className="l1">
                    <span className="row" style={{ flexWrap: 'nowrap' }}>
                      <button className="btn sm ghost icon" onClick={() => toggle(c.id)} aria-label={abierto ? 'Contraer' : 'Expandir'}><Icon name={abierto ? 'chevronDown' : 'chevronRight'} size={14} /></button>
                      {c.nombre} <span className="xs muted" style={{ fontWeight: 500 }}>({ops.length})</span>
                      {editable && <button className="btn sm ghost" onClick={() => setForm({ id: uid('op-'), clase_id: c.id, nombre: '', costo_base: 0, mejora_pct: 0, referencia: '', potencial: 0 })}><Icon name="plus" size={12} /> Oportunidad</button>}
                    </span>
                  </div>
                  <div className="l1 r" title="Brecha vs estándar anualizada">
                    <span className={br.anual > 0 ? 'txt-crit' : 'txt-good'}>{br.anual > 0 ? '+' : ''}{fMM(br.anual)}</span>
                  </div>
                  <div className="l1 r">{fMM(pot)}</div><div className="l1 r">{fMM(en)}</div><div className="l1 r">{fMM(log)}</div>
                  <div className="l1 r">{fMM(sin)}</div>
                  <div className="l1"><Cobertura potencial={pot} enProyectos={en} logrado={log} /></div>

                  {abierto && ops.map((o, i) => {
                    const d = ds[i];
                    const ab = abiertos.has(o.id);
                    return (
                      <Fragment key={o.id}>
                        <div>
                          <span className="row" style={{ paddingLeft: 26, flexWrap: 'nowrap', minWidth: 0 }}>
                            <button className="btn sm ghost icon" onClick={() => toggle(o.id)} aria-label={ab ? 'Contraer' : 'Expandir'} disabled={!d.ps.length}><Icon name={ab ? 'chevronDown' : 'chevronRight'} size={14} /></button>
                            <span className="clip strong">{o.nombre}</span><span className="xs muted nowrap">({d.ps.length} proy.)</span>
                            {editable && <button className="btn sm ghost icon" aria-label="Editar oportunidad" onClick={() => setForm(o)}><Icon name="pencil" size={12} /></button>}
                          </span>
                          <span className="formula" style={{ paddingLeft: 56 }}>
                            {o.costo_base > 0
                              ? <><b>{fMM(o.costo_base)} MM</b> de costo × <b>{fNum(o.mejora_pct)} %</b> de mejora = <b>{fMM(o.potencial)} MM/año</b>{o.referencia && <> · {o.referencia}</>}</>
                              : <>Potencial ingresado directamente{o.referencia && <> · {o.referencia}</>}</>}
                          </span>
                        </div>
                        <div className="r muted">—</div>
                        <div className="r">{fMM(o.potencial)}</div><div className="r">{fMM(d.enProy)}{d.ideas > 0 && <span className="xs muted">+{fMM(d.ideas)} en ideas</span>}</div>
                        <div className="r">{fMM(d.logrado)}</div>
                        <div className="r">{d.sin > 0 ? <b>{fMM(d.sin)}</b> : <span className="txt-good">0</span>}</div>
                        <div><Cobertura potencial={o.potencial} enProyectos={d.enProy} logrado={d.logrado} /></div>
                        {ab && d.ps.map((p) => (
                          <Fragment key={p.id}>
                            <div><span className="row" style={{ paddingLeft: 66, flexWrap: 'nowrap', minWidth: 0 }}><Link to={`/proyectos/${p.id}`} className="clip small">{p.nombre}</Link><EtapaBadge etapa={p.etapa} /></span></div>
                            <div /><div />
                            <div className="r small">{p.etapa === 'Idea' ? <span className="muted">({fMM(p.ahorro_comprometido_anual)})</span> : fMM(p.ahorro_comprometido_anual)}</div>
                            <div className="r small">{fMM(map.get(p.id)?.acum.real ?? 0)}</div>
                            <div /><div />
                          </Fragment>
                        ))}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="grid g3 mt">
        <Card flush className="span2" title="Oportunidades sin proyecto (priorizadas)" sub="Potencial que nadie ataca todavía, de mayor a menor. Conviértelo en un proyecto con un clic.">
          {pendientes.length ? (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Oportunidad</th><th className="num"><Concepto c="sinProyecto" /></th><th /></tr></thead>
                <tbody>
                  {pendientes.map(({ o, d }) => (
                    <tr key={o.id}>
                      <td><b>{o.nombre}</b><div className="xs muted">{db.clases_costo.find((c) => c.id === o.clase_id)?.nombre} · {o.referencia}</div></td>
                      <td className="num strong">{fMM(d.sin)} MM</td>
                      <td className="right">{puedeCrearProyecto(me) && <button className="btn sm" onClick={() => crearProyecto(o, d.sin)}><Icon name="plus" size={12} /> Crear proyecto</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty">Todo el potencial identificado ya tiene proyectos.</div>}
        </Card>
        <Card title="Proyectos sin oportunidad asignada" sub="Asígnales una oportunidad en su ficha para que sumen en el árbol">
          {sinOp.length ? <div className="row">{sinOp.map((p) => <Link key={p.id} className="badge" to={`/proyectos/${p.id}`}>{p.codigo} · {p.nombre}</Link>)}</div>
            : <p className="small muted" style={{ margin: 0 }}>Todos los proyectos están conectados a una oportunidad.</p>}
        </Card>
      </div>

      {form && <OportunidadForm inicial={form} onClose={() => setForm(null)} />}
      {nuevo && <ProyectoForm inicial={nuevo} onClose={() => setNuevo(null)} onSaved={(p) => nav(`/proyectos/${p.id}`)} />}
    </>
  );
}

function OportunidadForm({ inicial, onClose }: { inicial: Oportunidad; onClose: () => void }) {
  const { db, save, del, toast } = useStore();
  const [f, setF] = useState(inicial);
  const existe = db.oportunidades.some((o) => o.id === f.id);
  const pot = potencialOportunidad(f.costo_base, f.mejora_pct);
  const guardar = () => {
    if (!f.nombre.trim()) return toast('Ponle un nombre a la oportunidad.');
    if (f.costo_base <= 0 || f.mejora_pct <= 0) return toast('Ingresa el costo base y el % de mejora para calcular el potencial.');
    save('oportunidades', { ...f, potencial: pot });
    toast(existe ? 'Oportunidad actualizada' : 'Oportunidad creada');
    onClose();
  };
  return (
    <Modal title={existe ? 'Editar oportunidad' : 'Nueva oportunidad'} onClose={onClose}
      footer={<>
        {existe && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => { if (confirm('¿Eliminar oportunidad? Sus proyectos quedarán sin asignar.')) { del('oportunidades', f.id); onClose(); } }}><Icon name="trash" /> Eliminar</button>}
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" onClick={guardar}>Guardar</button>
      </>}>
      <div className="form-grid">
        <Field label="Oportunidad" full><input id="op-nombre" className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej: Merma de proceso y reproceso" autoFocus /></Field>
        <Field label="Clase de costo"><select className="select" value={f.clase_id} onChange={(e) => setF({ ...f, clase_id: e.target.value })}>{db.clases_costo.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>
        <div />
        <Field label="Costo base anual" hint="(MM CLP que hoy se gastan en esto)"><NumInput value={f.costo_base} onChange={(v) => setF({ ...f, costo_base: Math.max(0, v ?? 0) })} /></Field>
        <Field label="% de mejora alcanzable" hint="(según la referencia)"><NumInput value={f.mejora_pct} onChange={(v) => setF({ ...f, mejora_pct: Math.max(0, Math.min(100, v ?? 0)) })} /></Field>
        <Field label="Referencia" hint="(de dónde sale el %: estándar, mejor planta, benchmark, cotización)" full>
          <input id="op-ref" className="input" value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} placeholder="Ej: Merma 1,9 % vs estándar 1,2 % → 37 % de reducción posible" />
        </Field>
        <div className="full banner" style={{ background: 'var(--surface-2)' }}>
          <Icon name="info" />
          <span>Potencial = <b>{fMM(f.costo_base)} MM</b> × <b>{fNum(f.mejora_pct)} %</b> = <b style={{ color: 'var(--c-pot)' }}>{fMM(pot)} MM/año</b></span>
        </div>
      </div>
    </Modal>
  );
}
