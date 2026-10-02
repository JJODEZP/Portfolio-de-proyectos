import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AHORRO, Concepto, Cumplimiento } from '../components/ahorro';
import { Icon } from '../components/Icon';
import { Card, Empty, EtapaBadge, Meter, SaludBadge, Seg } from '../components/ui';
import { useStore } from '../data/store';
import { useMetricas, useProyectosVisibles, type MetricaProyecto } from '../data/useMetricas';
import { hoyISO } from '../lib/calc';
import { fFecha, fMM } from '../lib/format';
import { esAdmin, puedeAprobar, puedeCrearProyecto, puedeEditarProyecto } from '../lib/permissions';
import { ETAPAS, TIPOS, type Etapa, type Salud } from '../lib/types';
import { ETAPAS_CON_APROBACION, faltantesGate, nuevoProyecto, ProyectoForm } from './ProyectoForm';

export function Proyectos() {
  const { db, me, planta, perfil, plantaDe, save, toast } = useStore();
  const { map } = useMetricas();
  const visibles = useProyectosVisibles();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const [vista, setVista] = useState<'tabla' | 'kanban'>(() => {
    try { return localStorage.getItem('ct-vista') === 'kanban' ? 'kanban' : 'tabla'; } catch { return 'tabla'; }
  });
  const [q, setQ] = useState('');
  const [etapa, setEtapa] = useState('');
  const [tipo, setTipo] = useState('');
  const [lider, setLider] = useState(params.get('lider') ?? '');
  const [salud, setSalud] = useState('');
  const [mios, setMios] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const creando = params.get('nuevo') === '1';

  const filtrados = useMemo(() => visibles
    .map((p) => map.get(p.id)!)
    .filter((m) => !q || `${m.p.nombre} ${m.p.codigo} ${m.p.descripcion}`.toLowerCase().includes(q.toLowerCase()))
    .filter((m) => !etapa || m.p.etapa === etapa)
    .filter((m) => !tipo || m.p.tipo === tipo)
    .filter((m) => !lider || m.p.lider_id === lider)
    .filter((m) => !salud || m.salud === salud)
    .filter((m) => !mios || m.p.lider_id === me?.id)
    .sort((a, b) => ETAPAS.indexOf(a.p.etapa) - ETAPAS.indexOf(b.p.etapa) || a.p.codigo.localeCompare(b.p.codigo)),
  [visibles, map, q, etapa, tipo, lider, salud, mios, me]);

  const lideres = [...new Set(visibles.map((p) => p.lider_id))].map((id) => perfil(id)).filter(Boolean);

  const mover = (id: string, destino: Etapa) => {
    const p = db.proyectos.find((x) => x.id === id);
    if (!p || p.etapa === destino) return;
    if (!puedeEditarProyecto(me, p)) return toast('No tienes permiso para mover este proyecto.');
    const faltan = faltantesGate(p, destino, db);
    if (faltan.length && !esAdmin(me)) return toast(`No cumple el gate hacia «${destino}»: ${faltan.join(' · ')}`);
    if (faltan.length) toast(`Avanzado por excepción (Control de Gestión). Pendiente: ${faltan.join(' · ')}`);
    let n = { ...p, etapa: destino };
    if (ETAPAS_CON_APROBACION.includes(destino) && !p.aprobado) {
      if (!puedeAprobar(me, p)) return toast('Requiere aprobación del jefe de planta antes de pasar a ejecución.');
      n = { ...n, aprobado: true, aprobado_por: me!.id, aprobado_en: hoyISO() };
    }
    if ((destino === 'Implementado' || destino === 'Cerrado') && !n.fecha_fin_real) n.fecha_fin_real = hoyISO();
    save('proyectos', n);
    if (!faltan.length) toast(`${p.codigo} → ${destino}`);
  };

  const setVistaP = (v: 'tabla' | 'kanban') => { setVista(v); try { localStorage.setItem('ct-vista', v); } catch { /* */ } };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Proyectos</h1>
          <p>{filtrados.length} de {visibles.length} proyectos{planta !== 'todas' ? ` en ${plantaDe(planta)?.nombre}` : ''}</p>
        </div>
        <div className="row">
          <Seg value={vista} onChange={setVistaP} options={[['tabla', 'Tabla'], ['kanban', 'Kanban']]} />
          {puedeCrearProyecto(me) && <button className="btn primary" onClick={() => setParams({ nuevo: '1' })}><Icon name="plus" /> Nuevo proyecto</button>}
        </div>
      </div>

      <div className="filters">
        <div className="row" style={{ position: 'relative' }}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: 10, color: 'var(--ink2)' }} />
          <input className="input" style={{ paddingLeft: 30, width: 220 }} placeholder="Buscar proyecto o código" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="select" value={etapa} onChange={(e) => setEtapa(e.target.value)} aria-label="Etapa"><option value="">Todas las etapas</option>{ETAPAS.map((e) => <option key={e}>{e}</option>)}</select>
        <select className="select" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo"><option value="">Todos los tipos</option>{TIPOS.map((e) => <option key={e}>{e}</option>)}</select>
        <select className="select" value={lider} onChange={(e) => setLider(e.target.value)} aria-label="Líder"><option value="">Todos los líderes</option>{lideres.map((p) => <option key={p!.id} value={p!.id}>{p!.nombre}</option>)}</select>
        <select className="select" value={salud} onChange={(e) => setSalud(e.target.value)} aria-label="Salud"><option value="">Toda salud</option><option value="verde">En plan</option><option value="amarillo">En riesgo</option><option value="rojo">Crítico</option></select>
        {me?.rol === 'lider' && <label className="check"><input type="checkbox" checked={mios} onChange={(e) => setMios(e.target.checked)} /> Solo mis proyectos</label>}
      </div>

      {vista === 'tabla' ? (
        <Card flush>
          {filtrados.length ? (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Proyecto</th><th>Planta · Líder</th><th>Etapa</th><th>Salud</th><th style={{ minWidth: 130 }}>Avance real / plan</th>
                    <th className="num"><Concepto c="comprometido" /></th><th className="num"><Concepto c="logrado" /></th><th>¿Al día?</th><th className="num" title="Comentarios"><Icon name="message" size={13} /></th><th>Término</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((m) => (
                    <tr key={m.p.id} className="click" onClick={() => nav(`/proyectos/${m.p.id}`)}>
                      <td style={{ maxWidth: 300 }}>
                        <Link to={`/proyectos/${m.p.id}`} className="strong" onClick={(e) => e.stopPropagation()}>{m.p.nombre}</Link>
                        <div className="xs muted">{m.p.codigo} · {m.p.tipo}{!m.p.aprobado && m.p.etapa !== 'Idea' ? ' · pendiente aprobación' : ''}</div>
                      </td>
                      <td className="small nowrap">{plantaDe(m.p.planta_id)?.nombre}<div className="xs muted">{perfil(m.p.lider_id)?.nombre}</div></td>
                      <td><EtapaBadge etapa={m.p.etapa} /></td>
                      <td><SaludBadge s={m.p.etapa === 'Idea' ? null : m.salud} /></td>
                      <td>
                        <Meter value={m.avance} mark={m.esperado} label="Avance" />
                        <div className="xs muted num" style={{ marginTop: 3 }}>{m.avance}% · plan {m.esperado}%</div>
                      </td>
                      <td className="num">{fMM(m.p.ahorro_comprometido_anual)}</td>
                      <td className="num strong">{fMM(m.acum.real)}</td>
                      <td><Cumplimiento logrado={m.acum.real} esperado={m.acum.plan} /></td>
                      <td className="num muted">{db.comentarios.filter((c) => c.proyecto_id === m.p.id).length || ''}</td>
                      <td className="small nowrap">{fFecha(m.p.fecha_fin_plan)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty>No hay proyectos con estos filtros.</Empty>}
        </Card>
      ) : (
        <div className="kanban">
          {ETAPAS.map((e, i) => {
            const col = filtrados.filter((m) => m.p.etapa === e);
            return (
              <div key={e} className={`kcol ${dragOver === e ? 'over' : ''}`}
                onDragOver={(ev) => { ev.preventDefault(); setDragOver(e); }} onDragLeave={() => setDragOver(null)}
                onDrop={(ev) => { ev.preventDefault(); setDragOver(null); mover(ev.dataTransfer.getData('text/plain'), e); }}>
                <div className="kcol-head">
                  <span className="row small strong" style={{ gap: 6 }}><span className="dot" style={{ background: `var(--st${i + 1})` }} />{e}</span>
                  <span className="xs muted num">{col.length} · {fMM(col.reduce((s, m) => s + m.p.ahorro_comprometido_anual, 0))} MM</span>
                </div>
                {col.map((m) => <KCard key={m.p.id} m={m} onMove={mover} />)}
              </div>
            );
          })}
        </div>
      )}

      {creando && <ProyectoForm inicial={nuevoProyecto(db, me, planta)} onClose={() => setParams({})} onSaved={(p) => nav(`/proyectos/${p.id}`)} />}
    </>
  );
}

function KCard({ m, onMove }: { m: MetricaProyecto; onMove: (id: string, e: Etapa) => void }) {
  const { me, perfil, plantaDe } = useStore();
  const nav = useNavigate();
  const editable = puedeEditarProyecto(me, m.p);
  const idx = ETAPAS.indexOf(m.p.etapa);
  const { db } = useStore();
  const reps = db.replicaciones.filter((r) => r.proyecto_id === m.p.id);
  const nCom = db.comentarios.filter((c) => c.proyecto_id === m.p.id).length;
  return (
    <div className="kcard" draggable={editable} onDragStart={(e) => e.dataTransfer.setData('text/plain', m.p.id)} onClick={() => nav(`/proyectos/${m.p.id}`)}>
      <div className="row between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <span className="t">{m.p.nombre}</span>
        {m.p.etapa !== 'Idea' && <SaludBadge s={m.salud as Salud} compact />}
      </div>
      <div className="xs muted">{m.p.codigo} · {plantaDe(m.p.planta_id)?.nombre} · {perfil(m.p.lider_id)?.nombre}</div>
      <Meter value={m.avance} mark={m.esperado} label="Avance" />
      <div className="row between xs">
        <span className="muted">{m.avance}% avance</span>
        <span className="num" title={AHORRO.comprometido.def}><span className="sw-dot" style={{ background: AHORRO.comprometido.color, marginRight: 4 }} /><b>{fMM(m.p.ahorro_comprometido_anual)}</b> MM/año</span>
      </div>
      {(reps.length > 0 || nCom > 0 || editable) && (
        <div className="row between xs">
          <span className="muted">
            {reps.length ? <><Icon name="repeat" size={11} /> {reps.filter((r) => r.estado === 'Replicado').length}/{reps.length} réplicas</> : ''}
            {nCom > 0 && <span style={{ marginLeft: 8 }}><Icon name="message" size={11} /> {nCom}</span>}
          </span>
          {editable && (
            <span className="row" style={{ gap: 2 }} onClick={(e) => e.stopPropagation()}>
              <button className="btn sm ghost icon" disabled={idx === 0} onClick={() => onMove(m.p.id, ETAPAS[idx - 1])} aria-label="Etapa anterior" title="Etapa anterior"><Icon name="arrowLeft" size={13} /></button>
              <button className="btn sm ghost icon" disabled={idx === ETAPAS.length - 1} onClick={() => onMove(m.p.id, ETAPAS[idx + 1])} aria-label="Etapa siguiente" title="Etapa siguiente"><Icon name="chevronRight" size={13} /></button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
