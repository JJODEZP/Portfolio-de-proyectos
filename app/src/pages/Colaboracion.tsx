// Colaboración desde la web: comentarios, formularios rápidos (hito, avance, ahorro, KPI) y feed de actividad.
import { forwardRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AHORRO } from '../components/ahorro';
import { Icon } from '../components/Icon';
import { Empty, Field, Modal, NumInput, saludColor, saludLabel } from '../components/ui';
import { useStore } from '../data/store';
import { hoyISO, periodoIdx, ultimoMesCerrado } from '../lib/calc';
import { fFecha, fHace, fMes, fMM, iniciales, uid } from '../lib/format';
import { puedeBorrarComentario, puedeComentar } from '../lib/permissions';
import { MESES, type BeneficioMensual, type Kpi, type Proyecto, type Salud } from '../lib/types';

// ---------------------------------------------------------------- comentarios
export const Comentarios = forwardRef<HTMLTextAreaElement, { proyecto: Proyecto }>(function Comentarios({ proyecto }, ref) {
  const { db, me, perfil, save, del, toast } = useStore();
  const [texto, setTexto] = useState('');
  const lista = db.comentarios.filter((c) => c.proyecto_id === proyecto.id).sort((a, b) => a.fecha.localeCompare(b.fecha));

  const enviar = () => {
    const t = texto.trim();
    if (!t || !me) return;
    save('comentarios', { id: uid('cm-'), proyecto_id: proyecto.id, autor_id: me.id, fecha: new Date().toISOString(), texto: t });
    setTexto('');
    toast('Comentario publicado');
  };

  return (
    <div className="stack" style={{ gap: 6 }}>
      {lista.length ? lista.map((c) => {
        const a = perfil(c.autor_id);
        return (
          <div className="coment" key={c.id}>
            <span className="avatar" aria-hidden="true">{iniciales(a?.nombre)}</span>
            <div style={{ minWidth: 0 }}>
              <div className="meta">
                <b>{a?.nombre ?? 'Usuario'}</b>
                <span title={new Date(c.fecha).toLocaleString('es-CL')}>{fHace(c.fecha)}</span>
                {puedeBorrarComentario(me, c.autor_id) && (
                  <button className="btn sm ghost" style={{ marginLeft: 'auto', height: 22 }} onClick={() => confirm('¿Eliminar comentario?') && del('comentarios', c.id)}>Eliminar</button>
                )}
              </div>
              <div className="texto">{c.texto}</div>
            </div>
          </div>
        );
      }) : <Empty>Aún no hay comentarios. Usa este espacio para preguntas, acuerdos y bloqueos del proyecto.</Empty>}

      {puedeComentar(me) && (
        <div className="composer" style={{ marginTop: 8 }}>
          <label className="field">
            <span>Escribe un comentario como <b>{me?.nombre}</b></span>
            <textarea ref={ref} id="nuevo-comentario" className="textarea" value={texto} placeholder="Ej: ¿Podemos adelantar la capacitación al turno A?"
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar(); }} />
          </label>
          <div className="row between">
            <span className="xs muted">Ctrl + Enter para publicar · visible para todo el equipo</span>
            <button className="btn primary" disabled={!texto.trim()} onClick={enviar}><Icon name="message" size={14} /> Publicar comentario</button>
          </div>
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------- hito
export function HitoForm({ proyecto, onClose }: { proyecto: Proyecto; onClose: () => void }) {
  const { save, toast } = useStore();
  const [f, setF] = useState({ nombre: '', fecha_plan: proyecto.fecha_fin_plan, peso: 10, completado: false });
  const guardar = () => {
    if (!f.nombre.trim()) return toast('Ponle un nombre al hito.');
    save('hitos', { id: uid('hi-'), proyecto_id: proyecto.id, nombre: f.nombre.trim(), fecha_plan: f.fecha_plan, fecha_real: f.completado ? hoyISO() : null, peso: f.peso });
    toast('Hito agregado');
    onClose();
  };
  return (
    <Modal title="Agregar hito" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={guardar}>Agregar hito</button></>}>
      <div className="form-grid">
        <Field label="Hito" full><input id="hito-nombre" className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej: Piloto en línea 1" autoFocus /></Field>
        <Field label="Fecha planificada"><input id="hito-fecha" className="input" type="date" value={f.fecha_plan} onChange={(e) => setF({ ...f, fecha_plan: e.target.value })} /></Field>
        <Field label="Peso" hint="(importancia relativa para el % de avance)"><NumInput value={f.peso} onChange={(v) => setF({ ...f, peso: Math.max(1, v ?? 1) })} /></Field>
        <label className="check full"><input type="checkbox" checked={f.completado} onChange={(e) => setF({ ...f, completado: e.target.checked })} /> Ya está completado (hoy)</label>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- check-in
export function CheckinForm({ proyecto, avance, saludInicial, onDone }: { proyecto: Proyecto; avance: number; saludInicial: Salud; onDone?: () => void }) {
  const { me, save, toast } = useStore();
  const [f, setF] = useState({ salud: saludInicial, comentario: '', riesgos: '', proximos_pasos: '' });
  const registrar = () => {
    if (!f.comentario.trim()) return toast('Cuenta qué se avanzó en el período.');
    save('checkins', { id: uid('ck-'), proyecto_id: proyecto.id, fecha: hoyISO(), autor_id: me!.id, avance, ...f });
    setF({ salud: f.salud, comentario: '', riesgos: '', proximos_pasos: '' });
    toast('Avance registrado');
    onDone?.();
  };
  return (
    <div className="stack" style={{ gap: 12 }}>
      <Field label="¿Cómo va el proyecto?">
        <div className="seg">
          {(['verde', 'amarillo', 'rojo'] as Salud[]).map((s) => (
            <button key={s} type="button" className={f.salud === s ? 'on' : ''} onClick={() => setF({ ...f, salud: s })}>
              <span className="dot" style={{ background: saludColor(s), marginRight: 5 }} />{saludLabel(s)}
            </button>
          ))}
        </div>
      </Field>
      <Field label="¿Qué se avanzó?"><textarea id="ck-comentario" className="textarea" value={f.comentario} onChange={(e) => setF({ ...f, comentario: e.target.value })} /></Field>
      <Field label="Riesgos o bloqueos"><textarea id="ck-riesgos" className="textarea" style={{ minHeight: 52 }} value={f.riesgos} onChange={(e) => setF({ ...f, riesgos: e.target.value })} /></Field>
      <Field label="Próximos pasos"><input id="ck-pasos" className="input" value={f.proximos_pasos} onChange={(e) => setF({ ...f, proximos_pasos: e.target.value })} /></Field>
      <p className="xs muted" style={{ margin: 0 }}>El % de avance ({avance}%) se calcula solo con los hitos completados.</p>
      <button className="btn primary" onClick={registrar}>Registrar avance</button>
    </div>
  );
}

// ---------------------------------------------------------------- ahorro del mes
export function AhorroMesForm({ proyecto, onClose }: { proyecto: Proyecto; onClose: () => void }) {
  const { db, save, toast } = useStore();
  const cierre = ultimoMesCerrado();
  const existentes = db.beneficios_mensuales.filter((b) => b.proyecto_id === proyecto.id);
  // Meses ofrecidos: los 12 meses hasta el último cerrado
  const opciones = Array.from({ length: 12 }, (_, k) => { const d = new Date(cierre.anio, cierre.mes - 1 - k, 1); return { anio: d.getFullYear(), mes: d.getMonth() + 1 }; });
  const [sel, setSel] = useState(`${cierre.anio}-${cierre.mes}`);
  const [anio, mes] = sel.split('-').map(Number);
  const prev = existentes.find((b) => b.anio === anio && b.mes === mes);
  const [real, setReal] = useState<number | null>(prev?.ahorro_real ?? null);
  const [plan, setPlan] = useState<number>(prev?.ahorro_plan ?? Math.round((proyecto.ahorro_comprometido_anual / 12) * 10) / 10);

  const cambiarMes = (v: string) => {
    setSel(v);
    const [a, m] = v.split('-').map(Number);
    const p = existentes.find((b) => b.anio === a && b.mes === m);
    setReal(p?.ahorro_real ?? null);
    setPlan(p?.ahorro_plan ?? Math.round((proyecto.ahorro_comprometido_anual / 12) * 10) / 10);
  };
  const guardar = () => {
    if (real == null) return toast('Ingresa el ahorro logrado del mes.');
    const row: BeneficioMensual = { id: prev?.id ?? uid('be-'), proyecto_id: proyecto.id, anio, mes, ahorro_plan: plan, ahorro_real: real };
    save('beneficios_mensuales', row);
    toast(`Ahorro de ${fMes(anio, mes)} registrado`);
    onClose();
  };
  const d = real == null ? null : real - plan;
  return (
    <Modal title="Registrar ahorro del mes" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={guardar}>Guardar ahorro</button></>}>
      <p className="small muted" style={{ marginTop: 0 }}>Ahorro = diferencia contra la línea base: <b>{proyecto.linea_base || 'sin definir'}</b>. Montos en millones de CLP.</p>
      <div className="form-grid">
        <Field label="Mes">
          <select id="ah-mes" className="select" value={sel} onChange={(e) => cambiarMes(e.target.value)}>
            {opciones.map((o) => <option key={`${o.anio}-${o.mes}`} value={`${o.anio}-${o.mes}`}>{MESES[o.mes - 1]} {o.anio}{periodoIdx(o) === periodoIdx(cierre) ? ' (último cierre)' : ''}</option>)}
          </select>
        </Field>
        <div />
        <Field label={AHORRO.esperado.label + ' (plan del mes)'}><NumInput value={plan} onChange={(v) => setPlan(v ?? 0)} /></Field>
        <Field label={AHORRO.logrado.label + ' (real del mes)'}><NumInput allowNull value={real} onChange={setReal} /></Field>
        {d != null && (
          <p className="full small" style={{ margin: 0 }}>
            Resultado: <b className={d >= 0 ? 'txt-good' : 'txt-crit'}>{d >= 0 ? '+' : '−'}{fMM(Math.abs(d))} MM {d >= 0 ? 'por sobre' : 'bajo'} lo esperado</b>
          </p>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- KPI
export function KpiForm({ proyecto, onClose }: { proyecto: Proyecto; onClose: () => void }) {
  const { save, toast } = useStore();
  const [f, setF] = useState<Kpi>({ id: uid('kp-'), proyecto_id: proyecto.id, nombre: '', unidad: '%', linea_base: 0, meta: 0, actual: null, sentido: 'menor' });
  const guardar = () => {
    if (!f.nombre.trim()) return toast('Ponle un nombre al indicador.');
    save('kpis', f);
    toast('KPI agregado');
    onClose();
  };
  return (
    <Modal title="Agregar KPI operativo" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={guardar}>Agregar KPI</button></>}>
      <div className="form-grid">
        <Field label="Indicador" full><input id="kpi-nombre" className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej: Merma en empaque" autoFocus /></Field>
        <Field label="Unidad"><input id="kpi-unidad" className="input" value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })} /></Field>
        <Field label="Mejor si es"><select id="kpi-sentido" className="select" value={f.sentido} onChange={(e) => setF({ ...f, sentido: e.target.value as Kpi['sentido'] })}><option value="menor">Menor</option><option value="mayor">Mayor</option></select></Field>
        <Field label="Línea base"><NumInput value={f.linea_base} onChange={(v) => setF({ ...f, linea_base: v ?? 0 })} /></Field>
        <Field label="Meta"><NumInput value={f.meta} onChange={(v) => setF({ ...f, meta: v ?? 0 })} /></Field>
        <Field label="Valor actual" hint="(opcional)"><NumInput allowNull value={f.actual} onChange={(v) => setF({ ...f, actual: v })} /></Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- feed de actividad
interface Evento { id: string; cuando: string; autor?: string; proyectoId: string; tipo: 'comentario' | 'checkin' | 'hito'; texto: string; salud?: Salud }

export function ActividadReciente({ limite = 8 }: { limite?: number }) {
  const { db, perfil, plantasVisibles } = useStore();
  const visibles = new Map(db.proyectos.filter((p) => plantasVisibles.includes(p.planta_id)).map((p) => [p.id, p]));
  const eventos: Evento[] = [
    ...db.comentarios.filter((c) => visibles.has(c.proyecto_id)).map((c) => ({ id: c.id, cuando: c.fecha, autor: c.autor_id, proyectoId: c.proyecto_id, tipo: 'comentario' as const, texto: c.texto })),
    ...db.checkins.filter((c) => visibles.has(c.proyecto_id)).map((c) => ({ id: c.id, cuando: `${c.fecha}T12:00:00`, autor: c.autor_id, proyectoId: c.proyecto_id, tipo: 'checkin' as const, texto: c.comentario, salud: c.salud })),
    ...db.hitos.filter((h) => h.fecha_real && visibles.has(h.proyecto_id)).map((h) => ({ id: h.id, cuando: `${h.fecha_real}T12:00:00`, proyectoId: h.proyecto_id, tipo: 'hito' as const, texto: h.nombre })),
  ].sort((a, b) => b.cuando.localeCompare(a.cuando)).slice(0, limite);

  if (!eventos.length) return <Empty>Sin actividad todavía.</Empty>;
  return (
    <div>
      {eventos.map((e) => {
        const p = visibles.get(e.proyectoId)!;
        const a = perfil(e.autor);
        const verbo = e.tipo === 'comentario' ? 'comentó en' : e.tipo === 'checkin' ? 'reportó avance en' : 'Hito completado en';
        return (
          <div className="feed-item" key={e.tipo + e.id}>
            {e.tipo === 'hito'
              ? <span className="avatar" style={{ background: 'var(--good-bg)', color: 'var(--good-text)' }}><Icon name="flag" size={13} /></span>
              : <span className="avatar">{iniciales(a?.nombre)}</span>}
            <div style={{ minWidth: 0 }}>
              <div>
                {a && <b>{a.nombre} </b>}{verbo} <Link to={`/proyectos/${p.id}`} className="strong">{p.nombre}</Link>
                {e.salud && <span className="dot" title={saludLabel(e.salud)} style={{ background: saludColor(e.salud), marginLeft: 6 }} />}
              </div>
              <div className="q">{e.tipo === 'hito' ? `«${e.texto}»` : e.texto}</div>
              <div className="xs muted">{e.tipo === 'comentario' ? fHace(e.cuando) : fFecha(e.cuando)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
