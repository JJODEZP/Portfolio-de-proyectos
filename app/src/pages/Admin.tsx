import { useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Card, Field, Modal, NumInput } from '../components/ui';
import { buildSeed } from '../data/seed';
import { useStore } from '../data/store';
import { descargar, toCSV } from '../lib/csv';
import { uid } from '../lib/format';
import { esAdmin } from '../lib/permissions';
import { ROLES, TABLE_NAMES, type Perfil, type Rol, type Tables } from '../lib/types';

export function Admin() {
  const { db, me, modo, save, replaceAll, toast } = useStore();
  const admin = esAdmin(me);
  const [usuario, setUsuario] = useState<Perfil | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fecha = new Date().toISOString().slice(0, 10);

  const importar = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Tables;
      if (!TABLE_NAMES.every((t) => Array.isArray(data[t]))) throw new Error('El archivo no tiene todas las tablas esperadas.');
      replaceAll(data);
      toast('Datos importados');
    } catch (e) {
      toast(`Importación fallida: ${e instanceof Error ? e.message : e}`);
    }
  };

  const enBlanco = (): Tables => {
    const base = buildSeed();
    return { ...base, oportunidades: [], proyectos: [], hitos: [], checkins: [], beneficios_mensuales: [], kpis: [], replicaciones: [], causas_raiz: [], acciones: [],
      costos_mensuales: base.costos_mensuales.map((c) => ({ ...c, presupuesto: 0, costo_real: null, estandar: 0 })),
      perfiles: base.perfiles.filter((p) => p.rol === 'admin') };
  };

  return (
    <>
      <div className="page-head"><div><h1>Datos y administración</h1><p>Plantas, metas, usuarios y roles; exportación a Power BI y respaldo</p></div></div>
      {!admin && <div className="banner" style={{ marginBottom: 16 }}><Icon name="info" /> Solo Control de Gestión (admin) puede modificar esta sección. Puedes exportar los datos.</div>}

      <div className="grid g2">
        <Card title="Plantas y metas de ahorro" sub="Meta anual de ahorro por planta (MM CLP)"
          actions={admin && <button className="btn sm" onClick={() => save('plantas', { id: uid('pl-'), nombre: 'Nueva planta', meta_ahorro_anual: 0 })}><Icon name="plus" size={14} /> Planta</button>}>
          <table className="tbl compact">
            <thead><tr><th>Planta</th><th className="num">Meta anual</th></tr></thead>
            <tbody>
              {db.plantas.map((p) => (
                <tr key={p.id}>
                  <td>{admin ? <input className="input" defaultValue={p.nombre} onBlur={(e) => e.target.value !== p.nombre && save('plantas', { ...p, nombre: e.target.value })} /> : p.nombre}</td>
                  <td className="num" style={{ width: 140 }}>{admin ? <NumInput className="input cell" value={p.meta_ahorro_anual} onChange={(v) => save('plantas', { ...p, meta_ahorro_anual: v ?? 0 })} aria-label="Meta" /> : p.meta_ahorro_anual}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Clases de costo" sub="Estructura usada en presupuesto, desviaciones y árbol de oportunidades">
          <table className="tbl compact">
            <tbody>
              {db.clases_costo.map((c) => (
                <tr key={c.id}>
                  <td style={{ width: 160 }}>{admin ? <input className="input" defaultValue={c.nombre} onBlur={(e) => e.target.value !== c.nombre && save('clases_costo', { ...c, nombre: e.target.value })} /> : <b>{c.nombre}</b>}</td>
                  <td>{admin ? <input className="input" defaultValue={c.descripcion} onBlur={(e) => e.target.value !== c.descripcion && save('clases_costo', { ...c, descripcion: e.target.value })} /> : c.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card flush className="mt" title="Usuarios y roles"
        sub={modo === 'supabase' ? 'El usuario entra con el enlace mágico a su correo y queda asociado a este perfil por email.' : 'En el demo puedes cambiar de usuario arriba a la derecha («Ver como») para probar cada rol.'}
        actions={admin && <button className="btn sm primary" onClick={() => setUsuario({ id: uid('u-'), nombre: '', email: '', rol: 'lider', planta_id: db.plantas[0]?.id ?? null })}><Icon name="plus" size={14} /> Usuario</button>}>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Planta</th><th>Permisos</th><th /></tr></thead>
            <tbody>
              {db.perfiles.map((p) => (
                <tr key={p.id}>
                  <td className="strong">{p.nombre}</td><td className="small">{p.email}</td>
                  <td><span className="badge accent">{ROLES[p.rol]}</span></td>
                  <td className="small">{db.plantas.find((x) => x.id === p.planta_id)?.nombre ?? 'Todas'}</td>
                  <td className="xs muted" style={{ maxWidth: 320 }}>{DESC_ROL[p.rol]}</td>
                  <td className="right">{admin && <button className="btn sm ghost icon" aria-label="Editar usuario" onClick={() => setUsuario(p)}><Icon name="pencil" size={13} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid g2 mt">
        <Card title="Exportar para Power BI" sub="CSV por tabla (UTF-8, coma, punto decimal). Mismas columnas que la base de datos.">
          <div className="row">
            {TABLE_NAMES.map((t) => (
              <button key={t} className="btn sm" onClick={() => descargar(`${t}_${fecha}.csv`, toCSV(db[t] as unknown as Record<string, unknown>[]))}>
                <Icon name="download" size={13} /> {t} <span className="muted">({db[t].length})</span>
              </button>
            ))}
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            En modo Supabase, Power BI se conecta directo a PostgreSQL y usa las vistas <code>vw_proyectos</code>, <code>vw_beneficios_mensuales</code>, <code>vw_desviacion_costos</code> y <code>vw_cobertura_oportunidades</code> (ver README).
          </p>
        </Card>
        <Card title="Respaldo y datos" sub={modo === 'demo' ? 'Modo demo: los datos viven en este navegador.' : 'Modo Supabase: los datos viven en la base compartida.'}>
          <div className="row">
            <button className="btn sm" onClick={() => descargar(`control-tower_${fecha}.json`, JSON.stringify(db, null, 2), 'application/json')}><Icon name="download" size={13} /> Respaldo JSON</button>
            {modo === 'demo' && admin && <>
              <button className="btn sm" onClick={() => fileRef.current?.click()}><Icon name="upload" size={13} /> Importar JSON</button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ''; }} />
              <button className="btn sm" onClick={() => confirm('¿Restaurar los datos de demostración? Se perderán los cambios locales.') && (replaceAll(buildSeed()), toast('Datos demo restaurados'))}><Icon name="reset" size={13} /> Restaurar demo</button>
              <button className="btn sm danger" onClick={() => confirm('¿Empezar con una base vacía (se mantienen plantas y clases de costo)?') && (replaceAll(enBlanco()), toast('Base vacía lista para cargar tus proyectos'))}><Icon name="trash" size={13} /> Empezar en blanco</button>
            </>}
          </div>
        </Card>
      </div>

      {usuario && <UsuarioForm inicial={usuario} onClose={() => setUsuario(null)} />}
    </>
  );
}

const DESC_ROL: Record<Rol, string> = {
  admin: 'Todo: plantas, metas, presupuesto, usuarios y todos los proyectos.',
  gerencia: 'Solo lectura de todos los dashboards.',
  jefe_planta: 'Aprueba y edita proyectos de su planta; edita presupuesto/real y causas raíz de su planta.',
  lider: 'Crea proyectos y actualiza los suyos: hitos, beneficios, KPIs, check-ins y acciones.',
};

function UsuarioForm({ inicial, onClose }: { inicial: Perfil; onClose: () => void }) {
  const { db, save, del, toast } = useStore();
  const [f, setF] = useState(inicial);
  const existe = db.perfiles.some((p) => p.id === f.id);
  const enUso = db.proyectos.some((p) => p.lider_id === f.id);
  return (
    <Modal title={existe ? 'Editar usuario' : 'Nuevo usuario'} onClose={onClose}
      footer={<>
        {existe && <button className="btn danger" style={{ marginRight: 'auto' }} disabled={enUso} title={enUso ? 'Lidera proyectos: reasígnalos antes' : ''} onClick={() => { if (confirm('¿Eliminar usuario?')) { del('perfiles', f.id); onClose(); } }}><Icon name="trash" /> Eliminar</button>}
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" onClick={() => {
          if (!f.nombre.trim() || !f.email.includes('@')) return toast('Nombre y email válidos son obligatorios');
          save('perfiles', { ...f, email: f.email.trim().toLowerCase(), planta_id: f.rol === 'admin' || f.rol === 'gerencia' ? null : f.planta_id });
          onClose();
        }}>Guardar</button>
      </>}>
      <div className="form-grid">
        <Field label="Nombre"><input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoFocus /></Field>
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Rol"><select className="select" value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value as Rol })}>{(Object.keys(ROLES) as Rol[]).map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}</select></Field>
        {(f.rol === 'jefe_planta' || f.rol === 'lider') && (
          <Field label="Planta"><select className="select" value={f.planta_id ?? ''} onChange={(e) => setF({ ...f, planta_id: e.target.value })}>{db.plantas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
        )}
        <p className="xs muted full" style={{ margin: 0 }}>{DESC_ROL[f.rol]}</p>
      </div>
    </Modal>
  );
}
