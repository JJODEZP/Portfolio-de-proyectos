import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Card, Empty, Field, Modal } from '../components/ui';
import { useStore } from '../data/store';
import { diasEntre, hoyISO } from '../lib/calc';
import { fFecha, uid } from '../lib/format';
import { esAdmin, puedeCrearAccion, puedeEditarAccion, puedeEditarCostos, puedeEditarProyecto } from '../lib/permissions';
import type { Accion, Perfil } from '../lib/types';

export function nuevaAccion(me: Perfil | null): Accion {
  const d = new Date(); d.setDate(d.getDate() + 14);
  return { id: uid('ac-'), descripcion: '', responsable_id: me?.id ?? null, fecha_vencimiento: d.toISOString().slice(0, 10), estado: 'Pendiente', proyecto_id: null, causa_id: null };
}

export function AccionForm({ inicial, onClose }: { inicial: Accion; onClose: () => void }) {
  const { db, me, save, del, toast } = useStore();
  const [f, setF] = useState(inicial);
  const existe = db.acciones.some((a) => a.id === f.id);
  const vinculo = f.proyecto_id ? 'proyecto' : f.causa_id ? 'causa' : '';
  // Solo se ofrecen vínculos que el usuario puede editar (coherente con RLS)
  const proyectos = db.proyectos.filter((p) => puedeEditarProyecto(me, p));
  const causas = db.causas_raiz.filter((c) => puedeEditarCostos(me, c.planta_id));
  // Una acción suelta de un no-admin debe quedar a su nombre (si no, RLS no le permitiría editarla)
  const responsableFijo = !esAdmin(me) && !f.proyecto_id && !f.causa_id;

  const guardar = () => {
    if (!f.descripcion.trim()) return toast('Describe la acción.');
    save('acciones', responsableFijo ? { ...f, responsable_id: me!.id } : f);
    toast(existe ? 'Acción actualizada' : 'Acción creada');
    onClose();
  };
  return (
    <Modal title={existe ? 'Editar acción' : 'Nueva acción'} onClose={onClose}
      footer={<>
        {existe && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => { if (confirm('¿Eliminar acción?')) { del('acciones', f.id); onClose(); } }}><Icon name="trash" /> Eliminar</button>}
        <button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={guardar}>Guardar</button>
      </>}>
      <div className="form-grid">
        <Field label="Acción" full><textarea className="textarea" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} autoFocus /></Field>
        <Field label="Vinculada a">
          <select className="select" value={vinculo} onChange={(e) => setF({ ...f, proyecto_id: e.target.value === 'proyecto' ? proyectos[0]?.id ?? null : null, causa_id: e.target.value === 'causa' ? causas[0]?.id ?? null : null })}>
            <option value="">Sin vínculo</option>
            {proyectos.length > 0 && <option value="proyecto">Proyecto</option>}
            {causas.length > 0 && <option value="causa">Causa raíz de desviación</option>}
          </select>
        </Field>
        {vinculo === 'proyecto' && (
          <Field label="Proyecto"><select className="select" value={f.proyecto_id ?? ''} onChange={(e) => setF({ ...f, proyecto_id: e.target.value })}>{proyectos.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}</select></Field>
        )}
        {vinculo === 'causa' && (
          <Field label="Causa raíz"><select className="select" value={f.causa_id ?? ''} onChange={(e) => setF({ ...f, causa_id: e.target.value })}>{causas.map((c) => <option key={c.id} value={c.id}>{c.causa.slice(0, 70)}</option>)}</select></Field>
        )}
        {vinculo === '' && <div />}
        <Field label="Responsable">
          <select className="select" value={responsableFijo ? me?.id : f.responsable_id ?? ''} disabled={responsableFijo} onChange={(e) => setF({ ...f, responsable_id: e.target.value || null })}>
            <option value="">—</option>
            {db.perfiles.filter((p) => p.rol !== 'gerencia').map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Field>
        <Field label="Fecha comprometida"><input className="input" type="date" value={f.fecha_vencimiento} onChange={(e) => setF({ ...f, fecha_vencimiento: e.target.value })} /></Field>
        <Field label="Estado"><select className="select" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value as Accion['estado'] })}><option>Pendiente</option><option>En curso</option><option>Hecha</option></select></Field>
      </div>
    </Modal>
  );
}

export function Acciones() {
  const { db, me, perfil, plantasVisibles, save } = useStore();
  const [params] = useSearchParams();
  const [estado, setEstado] = useState(params.get('vencidas') ? 'vencidas' : 'abiertas');
  const [resp, setResp] = useState('');
  const [form, setForm] = useState<Accion | null>(null);
  const hoy = hoyISO();

  const lista = useMemo(() => db.acciones
    .filter((a) => {
      const pl = a.proyecto_id ? db.proyectos.find((p) => p.id === a.proyecto_id)?.planta_id
        : a.causa_id ? db.causas_raiz.find((c) => c.id === a.causa_id)?.planta_id
          : db.perfiles.find((p) => p.id === a.responsable_id)?.planta_id;
      return !pl || plantasVisibles.includes(pl);
    })
    .filter((a) => estado === 'todas' ? true : estado === 'abiertas' ? a.estado !== 'Hecha' : estado === 'vencidas' ? a.estado !== 'Hecha' && a.fecha_vencimiento < hoy : a.estado === 'Hecha')
    .filter((a) => !resp || a.responsable_id === resp)
    .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento)),
  [db, plantasVisibles, estado, resp, hoy]);

  const responsables = [...new Set(db.acciones.map((a) => a.responsable_id).filter(Boolean))].map((id) => perfil(id)).filter(Boolean) as Perfil[];

  return (
    <>
      <div className="page-head">
        <div><h1>Planes de acción</h1><p>Acciones de proyectos y de causas raíz de desviaciones de costo</p></div>
        {puedeCrearAccion(me) && <button className="btn primary" onClick={() => setForm(nuevaAccion(me))}><Icon name="plus" /> Nueva acción</button>}
      </div>
      <div className="filters">
        <select className="select" value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="abiertas">Abiertas</option><option value="vencidas">Vencidas</option><option value="hechas">Hechas</option><option value="todas">Todas</option>
        </select>
        <select className="select" value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsable">
          <option value="">Todos los responsables</option>{responsables.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        {me && me.rol !== 'gerencia' && <button className="btn sm" onClick={() => setResp(resp === me.id ? '' : me.id)}>{resp === me.id ? 'Ver todas' : 'Mis acciones'}</button>}
      </div>
      <Card flush>
        {lista.length ? (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Acción</th><th>Vínculo</th><th>Responsable</th><th>Vence</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {lista.map((a) => {
                  const p = a.proyecto_id ? db.proyectos.find((x) => x.id === a.proyecto_id) : undefined;
                  const c = a.causa_id ? db.causas_raiz.find((x) => x.id === a.causa_id) : undefined;
                  const vencida = a.estado !== 'Hecha' && a.fecha_vencimiento < hoy;
                  const puede = puedeEditarAccion(me, a, db);
                  return (
                    <tr key={a.id}>
                      <td style={{ minWidth: 240 }}>{a.descripcion}</td>
                      <td className="small" style={{ maxWidth: 260 }}>
                        {p ? <Link to={`/proyectos/${p.id}`}>{p.codigo} · {p.nombre}</Link> : c ? <Link to="/costos">Causa: {c.causa}</Link> : <span className="muted">—</span>}
                      </td>
                      <td className="small nowrap">{perfil(a.responsable_id)?.nombre ?? '—'}</td>
                      <td className="small nowrap">
                        {vencida ? <span className="row" style={{ gap: 4 }}><Icon name="alert" size={13} style={{ color: 'var(--crit)' }} />{fFecha(a.fecha_vencimiento)} · {diasEntre(a.fecha_vencimiento, hoy)} d vencida</span> : fFecha(a.fecha_vencimiento)}
                      </td>
                      <td>{puede ? <select className="select" style={{ width: 120 }} value={a.estado} onChange={(e) => save('acciones', { ...a, estado: e.target.value as Accion['estado'] })}><option>Pendiente</option><option>En curso</option><option>Hecha</option></select> : <span className="badge">{a.estado}</span>}</td>
                      <td className="right">{puede && <button className="btn sm ghost icon" aria-label="Editar acción" onClick={() => setForm(a)}><Icon name="pencil" size={13} /></button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty>No hay acciones con estos filtros.</Empty>}
      </Card>
      {form && <AccionForm inicial={form} onClose={() => setForm(null)} />}
    </>
  );
}
