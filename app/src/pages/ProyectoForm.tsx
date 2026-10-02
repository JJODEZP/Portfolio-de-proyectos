import { useState } from 'react';
import { Field, Modal, NumInput } from '../components/ui';
import { useStore } from '../data/store';
import { hoyISO } from '../lib/calc';
import { uid } from '../lib/format';
import { puedeAprobar } from '../lib/permissions';
import { ETAPAS, TIPOS, TIPOS_BENEFICIO, type Etapa, type Proyecto } from '../lib/types';

export const ETAPAS_CON_APROBACION: Etapa[] = ['En ejecución', 'Implementado', 'Cerrado'];

export function nuevoProyecto(db: ReturnType<typeof useStore>['db'], me: ReturnType<typeof useStore>['me'], plantaFiltro: string): Proyecto {
  const anio = new Date().getFullYear();
  const n = db.proyectos.filter((p) => p.codigo.startsWith(`PE-${anio}`)).length + 1;
  const planta = me?.planta_id ?? (plantaFiltro !== 'todas' ? plantaFiltro : db.plantas[0]?.id ?? '');
  const fin = new Date(); fin.setMonth(fin.getMonth() + 6);
  return {
    id: uid('pr-'), codigo: `PE-${anio}-${String(n).padStart(3, '0')}`, nombre: '', descripcion: '', tipo: 'Kaizen', etapa: 'Idea',
    planta_id: planta, clase_id: db.clases_costo[0]?.id ?? '', oportunidad_id: null,
    lider_id: me?.rol === 'lider' ? me.id : '', sponsor: '', fecha_inicio: hoyISO(), fecha_fin_plan: fin.toISOString().slice(0, 10),
    fecha_fin_real: null, avance_manual: 0, linea_base: '', tipo_beneficio: 'Ahorro duro', ahorro_comprometido_anual: 0,
    inversion_capex: 0, inversion_opex: 0, aprobado: false, aprobado_por: null, aprobado_en: null,
  };
}

export function ProyectoForm({ inicial, onClose, onSaved }: { inicial: Proyecto; onClose: () => void; onSaved?: (p: Proyecto) => void }) {
  const { db, me, save, toast } = useStore();
  const [f, setF] = useState<Proyecto>(inicial);
  const set = <K extends keyof Proyecto>(k: K, v: Proyecto[K]) => setF((x) => ({ ...x, [k]: v }));
  const esNuevo = !db.proyectos.some((p) => p.id === f.id);
  const plantaFija = me?.rol === 'lider' || me?.rol === 'jefe_planta';
  const lideres = db.perfiles.filter((p) => p.rol !== 'gerencia' && (p.planta_id === f.planta_id || p.rol === 'admin'));
  const ops = db.oportunidades.filter((o) => o.clase_id === f.clase_id);
  const aprobable = puedeAprobar(me, f);

  const guardar = () => {
    if (!f.nombre.trim()) return toast('El proyecto necesita un nombre.');
    if (!f.lider_id) return toast('Asigna un líder de proyecto.');
    if (f.fecha_fin_plan < f.fecha_inicio) return toast('La fecha de término no puede ser anterior al inicio.');
    let p = f;
    if (ETAPAS_CON_APROBACION.includes(f.etapa) && !f.aprobado) {
      if (!aprobable) return toast('Para pasar a ejecución el proyecto debe ser aprobado por el jefe de planta o Control de Gestión.');
      p = { ...f, aprobado: true, aprobado_por: me!.id, aprobado_en: hoyISO() };
    }
    if ((p.etapa === 'Implementado' || p.etapa === 'Cerrado') && !p.fecha_fin_real) p = { ...p, fecha_fin_real: hoyISO() };
    save('proyectos', p);
    toast(esNuevo ? 'Proyecto creado' : 'Cambios guardados');
    onClose();
    onSaved?.(p); // después de cerrar: el cierre también navega y no debe pisar esta navegación
  };

  return (
    <Modal wide title={esNuevo ? 'Nuevo proyecto' : `Editar ${f.codigo}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={guardar}>Guardar</button></>}>
      <div className="form-grid">
        <Field label="Nombre del proyecto" full><input className="input" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} autoFocus /></Field>
        <Field label="Descripción / objetivo" full><textarea className="textarea" value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} /></Field>
        <Field label="Código"><input className="input" value={f.codigo} onChange={(e) => set('codigo', e.target.value)} /></Field>
        <Field label="Tipo"><select className="select" value={f.tipo} onChange={(e) => set('tipo', e.target.value as Proyecto['tipo'])}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Planta">
          <select className="select" value={f.planta_id} disabled={plantaFija} onChange={(e) => set('planta_id', e.target.value)}>
            {db.plantas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Field>
        <Field label="Etapa" hint={!f.aprobado ? '(ejecución requiere aprobación)' : undefined}>
          <select className="select" value={f.etapa} onChange={(e) => set('etapa', e.target.value as Etapa)}>
            {ETAPAS.map((e) => <option key={e} disabled={ETAPAS_CON_APROBACION.includes(e) && !f.aprobado && !aprobable}>{e}</option>)}
          </select>
        </Field>
        <Field label="Líder del proyecto">
          <select className="select" value={f.lider_id} disabled={me?.rol === 'lider'} onChange={(e) => set('lider_id', e.target.value)}>
            <option value="">— Seleccionar —</option>
            {lideres.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Field>
        <Field label="Sponsor"><input className="input" value={f.sponsor} onChange={(e) => set('sponsor', e.target.value)} /></Field>
        <Field label="Clase de costo impactada">
          <select className="select" value={f.clase_id} onChange={(e) => setF((x) => ({ ...x, clase_id: e.target.value, oportunidad_id: null }))}>
            {db.clases_costo.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Field>
        <Field label="Oportunidad (árbol)">
          <select className="select" value={f.oportunidad_id ?? ''} onChange={(e) => set('oportunidad_id', e.target.value || null)}>
            <option value="">— Sin asignar —</option>
            {ops.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
        </Field>
        <Field label="Inicio"><input className="input" type="date" value={f.fecha_inicio} onChange={(e) => set('fecha_inicio', e.target.value)} /></Field>
        <Field label="Término planificado"><input className="input" type="date" value={f.fecha_fin_plan} onChange={(e) => set('fecha_fin_plan', e.target.value)} /></Field>
        <Field label="Línea base" hint="(situación inicial medible)" full><input className="input" value={f.linea_base} onChange={(e) => set('linea_base', e.target.value)} placeholder="Ej: merma de empaque 1,9 % promedio últimos 6 meses" /></Field>
        <Field label="Tipo de beneficio"><select className="select" value={f.tipo_beneficio} onChange={(e) => set('tipo_beneficio', e.target.value as Proyecto['tipo_beneficio'])}>{TIPOS_BENEFICIO.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Ahorro comprometido anual" hint="(MM CLP)"><NumInput value={f.ahorro_comprometido_anual} onChange={(v) => set('ahorro_comprometido_anual', v ?? 0)} /></Field>
        <Field label="Inversión CAPEX" hint="(MM CLP)"><NumInput value={f.inversion_capex} onChange={(v) => set('inversion_capex', v ?? 0)} /></Field>
        <Field label="Inversión OPEX one-time" hint="(MM CLP)"><NumInput value={f.inversion_opex} onChange={(v) => set('inversion_opex', v ?? 0)} /></Field>
        <Field label="Avance manual %" hint="(solo si el proyecto no tiene hitos)"><NumInput value={f.avance_manual} onChange={(v) => set('avance_manual', Math.max(0, Math.min(100, v ?? 0)))} /></Field>
      </div>
    </Modal>
  );
}
