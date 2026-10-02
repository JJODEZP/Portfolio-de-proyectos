import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Perfil, Planta, Row, TableName, Tables } from '../lib/types';
import { LocalRepo, repo, SupabaseRepo } from './repo';

type Status = 'cargando' | 'listo' | 'login' | 'sin-perfil' | 'error';

interface Store {
  db: Tables;
  me: Perfil | null;
  modo: 'demo' | 'supabase';
  status: Status;
  error: string;
  /** Filtro global de planta ('todas' o id). */
  planta: string;
  setPlanta: (id: string) => void;
  save: <T extends TableName>(table: T, rows: Row<T> | Row<T>[]) => Promise<void>;
  del: (table: TableName, ids: string | string[]) => Promise<void>;
  reload: () => Promise<void>;
  setDemoUser: (id: string) => void;
  replaceAll: (db: Tables) => void;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  // búsquedas frecuentes
  perfil: (id: string | null | undefined) => Perfil | undefined;
  plantaDe: (id: string | null | undefined) => Planta | undefined;
  plantasVisibles: string[];
  toast: (msg: string) => void;
  toastMsg: string;
}

const vacio = (): Tables => ({
  plantas: [], perfiles: [], clases_costo: [], oportunidades: [], proyectos: [], hitos: [], checkins: [],
  beneficios_mensuales: [], kpis: [], replicaciones: [], costos_mensuales: [], causas_raiz: [], acciones: [], comentarios: [],
});

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Tables>(vacio);
  const [me, setMe] = useState<Perfil | null>(null);
  const [status, setStatus] = useState<Status>('cargando');
  const [error, setError] = useState('');
  const [planta, setPlantaState] = useState<string>(() => {
    try { return localStorage.getItem('ct-planta') || 'todas'; } catch { return 'todas'; }
  });
  const [toastMsg, setToastMsg] = useState('');

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((m) => (m === msg ? '' : m)), 3500);
  }, []);

  const reload = useCallback(async () => {
    try {
      if (repo instanceof SupabaseRepo && !(await repo.isLoggedIn())) { setStatus('login'); return; }
      const data = await repo.loadAll();
      const perfil = await repo.currentProfile(data);
      setDb(data);
      setMe(perfil);
      setStatus(perfil ? 'listo' : 'sin-perfil');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    reload();
    return repo.onAuthChange?.(() => { setStatus('cargando'); reload(); });
  }, [reload]);

  const setPlanta = useCallback((id: string) => {
    setPlantaState(id);
    try { localStorage.setItem('ct-planta', id); } catch { /* */ }
  }, []);

  const save = useCallback(async <T extends TableName>(table: T, rows: Row<T> | Row<T>[]) => {
    const list = Array.isArray(rows) ? rows : [rows];
    setDb((d) => {
      const next = [...(d[table] as Row<T>[])];
      for (const r of list) {
        const i = next.findIndex((x) => x.id === r.id);
        if (i >= 0) next[i] = r; else next.push(r);
      }
      return { ...d, [table]: next };
    });
    try {
      await repo.upsert(table, list);
    } catch (e) {
      toast(`No se pudo guardar: ${e instanceof Error ? e.message : e}`);
      reload();
    }
  }, [reload, toast]);

  const del = useCallback(async (table: TableName, idsIn: string | string[]) => {
    const ids = Array.isArray(idsIn) ? idsIn : [idsIn];
    const set = new Set(ids);
    // Cascada explícita (en Supabase además existe ON DELETE CASCADE / SET NULL)
    const hijos: [TableName, string[]][] = [];
    if (table === 'proyectos') {
      for (const t of ['hitos', 'checkins', 'beneficios_mensuales', 'kpis', 'replicaciones', 'acciones', 'comentarios'] as const) {
        const quitar = (db[t] as { id: string; proyecto_id: string | null }[])
          .filter((x) => x.proyecto_id && set.has(x.proyecto_id)).map((x) => x.id);
        if (quitar.length) hijos.push([t, quitar]);
      }
    }
    if (table === 'causas_raiz') {
      const quitar = db.acciones.filter((a) => a.causa_id && set.has(a.causa_id)).map((a) => a.id);
      if (quitar.length) hijos.push(['acciones', quitar]);
    }
    const desvinculados = table === 'oportunidades'
      ? db.proyectos.filter((p) => p.oportunidad_id && set.has(p.oportunidad_id)).map((p) => ({ ...p, oportunidad_id: null }))
      : [];
    setDb((d) => {
      const n = { ...d };
      for (const [t, q] of hijos) {
        const qs = new Set(q);
        (n[t] as { id: string }[]) = (d[t] as { id: string }[]).filter((x) => !qs.has(x.id));
      }
      if (desvinculados.length) {
        const m = new Map(desvinculados.map((p) => [p.id, p]));
        n.proyectos = d.proyectos.map((p) => m.get(p.id) ?? p);
      }
      (n[table] as { id: string }[]) = (d[table] as { id: string }[]).filter((x) => !set.has(x.id));
      return n;
    });
    try {
      for (const [t, q] of hijos) await repo.remove(t, q);
      if (desvinculados.length) await repo.upsert('proyectos', desvinculados);
      await repo.remove(table, ids);
    } catch (e) {
      toast(`No se pudo eliminar: ${e instanceof Error ? e.message : e}`);
      reload();
    }
  }, [db, reload, toast]);

  const setDemoUser = useCallback((id: string) => {
    if (repo instanceof LocalRepo) repo.setDemoUser(id);
    setMe(db.perfiles.find((p) => p.id === id) ?? null);
  }, [db.perfiles]);

  const replaceAll = useCallback((nuevo: Tables) => {
    if (repo instanceof LocalRepo) {
      repo.replaceAll(nuevo);
      setDb(structuredClone(nuevo));
      setMe((m) => nuevo.perfiles.find((p) => p.id === m?.id) ?? nuevo.perfiles.find((p) => p.rol === 'admin') ?? null);
    }
  }, []);

  const value = useMemo<Store>(() => {
    const perfMap = new Map(db.perfiles.map((p) => [p.id, p]));
    const plantaMap = new Map(db.plantas.map((p) => [p.id, p]));
    return {
      db, me, modo: repo.mode, status, error, planta, setPlanta, save, del, reload, setDemoUser, replaceAll,
      signIn: async (email) => { await repo.signIn?.(email); },
      signOut: async () => { await repo.signOut?.(); },
      perfil: (id) => (id ? perfMap.get(id) : undefined),
      plantaDe: (id) => (id ? plantaMap.get(id) : undefined),
      plantasVisibles: planta === 'todas' ? db.plantas.map((p) => p.id) : [planta],
      toast, toastMsg,
    };
  }, [db, me, status, error, planta, setPlanta, save, del, reload, setDemoUser, replaceAll, toast, toastMsg]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore fuera de StoreProvider');
  return s;
}
