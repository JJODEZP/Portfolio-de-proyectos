import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Card, EtapaBadge, Field, Modal, NumInput, Tile } from '../components/ui';
import { useStore } from '../data/store';
import { useMetricas } from '../data/useMetricas';
import { fMM, fPct0, uid } from '../lib/format';
import { puedeEditarOportunidades } from '../lib/permissions';
import type { Oportunidad } from '../lib/types';

/** Barra de cobertura: clara = identificado (proyectos) · oscura = realizado, sobre el potencial. */
function Cobertura({ potencial, identificado, realizado }: { potencial: number; identificado: number; realizado: number }) {
  const max = Math.max(potencial, identificado, 1);
  return (
    <div>
      <div className="meter" aria-label="Cobertura">
        <i className="soft" style={{ width: `${(identificado / max) * 100}%` }} />
        <i style={{ width: `${(realizado / max) * 100}%` }} />
      </div>
      <div className="xs muted num" style={{ marginTop: 2 }}>{potencial ? fPct0((identificado / potencial) * 100) : '—'} cubierto</div>
    </div>
  );
}

export function Oportunidades() {
  const { db, me, plantasVisibles, del } = useStore();
  const { map } = useMetricas();
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set(db.clases_costo.map((c) => c.id)));
  const [form, setForm] = useState<Oportunidad | null>(null);
  const editable = puedeEditarOportunidades(me);
  const proyectos = db.proyectos.filter((p) => plantasVisibles.includes(p.planta_id));
  const toggle = (id: string) => setAbiertos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const datosOp = (o: Oportunidad) => {
    const ps = proyectos.filter((p) => p.oportunidad_id === o.id);
    return { ps, ident: ps.reduce((s, p) => s + p.ahorro_comprometido_anual, 0), real: ps.reduce((s, p) => s + (map.get(p.id)?.acum.real ?? 0), 0) };
  };
  const tot = db.oportunidades.reduce((a, o) => { const d = datosOp(o); return { pot: a.pot + o.potencial, ident: a.ident + d.ident, real: a.real + d.real }; }, { pot: 0, ident: 0, real: 0 });
  const sinOp = proyectos.filter((p) => !p.oportunidad_id);

  return (
    <>
      <div className="page-head">
        <div><h1>Árbol de oportunidades</h1><p>Clase de costo → oportunidad → proyectos. Muestra la brecha entre el potencial de ahorro y lo que cubren los proyectos.</p></div>
      </div>
      <div className="grid g4">
        <Tile label="Potencial identificado" value={fMM(tot.pot)} unit="MM/año" />
        <Tile label="Cubierto por proyectos" value={fMM(tot.ident)} unit="MM/año" sub={`${tot.pot ? fPct0((tot.ident / tot.pot) * 100) : '—'} del potencial`} />
        <Tile label="Realizado a la fecha" value={fMM(tot.real)} unit="MM" />
        <Tile label="Brecha sin proyecto" value={fMM(Math.max(0, tot.pot - tot.ident))} unit="MM/año" sub="Oportunidades a convertir en iniciativas" />
      </div>

      <Card flush className="mt">
        <div className="legend" style={{ padding: '14px 18px 0' }}>
          <span><i className="sw box" style={{ background: 'var(--series)' }} />Realizado</span>
          <span><i className="sw box" style={{ background: 'var(--series-soft)' }} />Identificado en proyectos</span>
          <span><i className="sw box" style={{ background: 'var(--grid)' }} />Potencial sin cubrir</span>
        </div>
        <div className="tree-row head"><span>Nodo</span><span className="right">Potencial</span><span className="right">Identificado</span><span className="right">Realizado</span><span>Cobertura</span></div>
        {db.clases_costo.map((c) => {
          const ops = db.oportunidades.filter((o) => o.clase_id === c.id);
          const ds = ops.map(datosOp);
          const pot = ops.reduce((s, o) => s + o.potencial, 0);
          const ident = ds.reduce((s, d) => s + d.ident, 0), real = ds.reduce((s, d) => s + d.real, 0);
          const abierto = abiertos.has(c.id);
          return (
            <Fragment key={c.id}>
              <div className="tree-row l1">
                <span className="row" style={{ flexWrap: 'nowrap' }}>
                  <button className="btn sm ghost icon" onClick={() => toggle(c.id)} aria-label={abierto ? 'Contraer' : 'Expandir'}><Icon name={abierto ? 'chevronDown' : 'chevronRight'} size={14} /></button>
                  {c.nombre}
                  {editable && <button className="btn sm ghost" onClick={() => setForm({ id: uid('op-'), clase_id: c.id, nombre: '', potencial: 0 })}><Icon name="plus" size={12} /> Oportunidad</button>}
                </span>
                <span className="right num">{fMM(pot)}</span><span className="right num">{fMM(ident)}</span><span className="right num">{fMM(real)}</span>
                <Cobertura potencial={pot} identificado={ident} realizado={real} />
              </div>
              {abierto && ops.map((o, i) => {
                const d = ds[i];
                const ab = abiertos.has(o.id);
                return (
                  <Fragment key={o.id}>
                    <div className="tree-row">
                      <span className="row" style={{ paddingLeft: 28, flexWrap: 'nowrap', minWidth: 0 }}>
                        <button className="btn sm ghost icon" onClick={() => toggle(o.id)} aria-label={ab ? 'Contraer' : 'Expandir'} disabled={!d.ps.length}><Icon name={ab ? 'chevronDown' : 'chevronRight'} size={14} /></button>
                        <span className="clip">{o.nombre}</span><span className="xs muted nowrap">({d.ps.length})</span>
                        {editable && <button className="btn sm ghost icon" aria-label="Editar oportunidad" onClick={() => setForm(o)}><Icon name="pencil" size={12} /></button>}
                      </span>
                      <span className="right num">{fMM(o.potencial)}</span><span className="right num">{fMM(d.ident)}</span><span className="right num">{fMM(d.real)}</span>
                      <Cobertura potencial={o.potencial} identificado={d.ident} realizado={d.real} />
                    </div>
                    {ab && d.ps.map((p) => (
                      <div className="tree-row" key={p.id} style={{ background: 'var(--surface)' }}>
                        <span className="row" style={{ paddingLeft: 68, flexWrap: 'nowrap', minWidth: 0 }}>
                          <Link to={`/proyectos/${p.id}`} className="clip small">{p.nombre}</Link><EtapaBadge etapa={p.etapa} />
                        </span>
                        <span /><span className="right num small">{fMM(p.ahorro_comprometido_anual)}</span><span className="right num small">{fMM(map.get(p.id)?.acum.real ?? 0)}</span><span />
                      </div>
                    ))}
                  </Fragment>
                );
              })}
            </Fragment>
          );
        })}
      </Card>

      {sinOp.length > 0 && (
        <Card className="mt" title="Proyectos sin oportunidad asignada" sub="Asígnalos desde la ficha del proyecto para que sumen en el árbol">
          <div className="row">{sinOp.map((p) => <Link key={p.id} className="badge" to={`/proyectos/${p.id}`}>{p.codigo} · {p.nombre}</Link>)}</div>
        </Card>
      )}

      {form && <OportunidadForm inicial={form} onClose={() => setForm(null)} onDelete={(id) => { del('oportunidades', id); setForm(null); }} />}
    </>
  );
}

function OportunidadForm({ inicial, onClose, onDelete }: { inicial: Oportunidad; onClose: () => void; onDelete: (id: string) => void }) {
  const { db, save, toast } = useStore();
  const [f, setF] = useState(inicial);
  const existe = db.oportunidades.some((o) => o.id === f.id);
  return (
    <Modal title={existe ? 'Editar oportunidad' : 'Nueva oportunidad'} onClose={onClose}
      footer={<>
        {existe && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => confirm('¿Eliminar oportunidad? Los proyectos quedarán sin asignar.') && onDelete(f.id)}><Icon name="trash" /> Eliminar</button>}
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" onClick={() => { if (!f.nombre.trim()) return toast('Nombre requerido'); save('oportunidades', f); onClose(); }}>Guardar</button>
      </>}>
      <div className="form-grid">
        <Field label="Oportunidad" full><input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoFocus /></Field>
        <Field label="Clase de costo"><select className="select" value={f.clase_id} onChange={(e) => setF({ ...f, clase_id: e.target.value })}>{db.clases_costo.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>
        <Field label="Potencial de ahorro anual" hint="(MM CLP)"><NumInput value={f.potencial} onChange={(v) => setF({ ...f, potencial: v ?? 0 })} /></Field>
      </div>
    </Modal>
  );
}
