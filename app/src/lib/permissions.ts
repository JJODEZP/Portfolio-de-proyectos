// Permisos en la UI. Replican 1:1 las políticas RLS de supabase/migrations/001_schema.sql,
// que son las que realmente protegen los datos en modo Supabase.
import type { Accion, Perfil, Proyecto, Tables } from './types';

export const esAdmin = (me: Perfil | null) => me?.rol === 'admin';

export function puedeCrearProyecto(me: Perfil | null) {
  return !!me && me.rol !== 'gerencia';
}

export function puedeEditarProyecto(me: Perfil | null, p: Proyecto | undefined) {
  if (!me || !p) return false;
  if (me.rol === 'admin') return true;
  if (me.rol === 'jefe_planta') return p.planta_id === me.planta_id;
  if (me.rol === 'lider') return p.lider_id === me.id;
  return false;
}

export function puedeAprobar(me: Perfil | null, p: Proyecto | undefined) {
  if (!me || !p) return false;
  return me.rol === 'admin' || (me.rol === 'jefe_planta' && p.planta_id === me.planta_id);
}

export const puedeEliminarProyecto = puedeAprobar;

export function puedeEditarCostos(me: Perfil | null, plantaId: string) {
  if (!me) return false;
  return me.rol === 'admin' || (me.rol === 'jefe_planta' && me.planta_id === plantaId);
}

export function puedeEditarOportunidades(me: Perfil | null) {
  return me?.rol === 'admin' || me?.rol === 'jefe_planta';
}

export function puedeEditarAccion(me: Perfil | null, a: Accion, db: Tables) {
  if (!me || me.rol === 'gerencia') return false;
  if (me.rol === 'admin' || a.responsable_id === me.id) return true;
  if (a.proyecto_id) return puedeEditarProyecto(me, db.proyectos.find((p) => p.id === a.proyecto_id));
  if (a.causa_id) {
    const c = db.causas_raiz.find((x) => x.id === a.causa_id);
    return !!c && puedeEditarCostos(me, c.planta_id);
  }
  return false;
}

/** Puede crear acciones sueltas (no vinculadas a un proyecto ni causa). */
export const puedeCrearAccion = (me: Perfil | null) => !!me && me.rol !== 'gerencia';
