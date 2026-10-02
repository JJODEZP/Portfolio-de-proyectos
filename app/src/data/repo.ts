// Capa de acceso a datos. La app solo conoce esta interfaz; el modo (demo o Supabase)
// se decide por variables de entorno en build.
import type { Perfil, Row, TableName, Tables } from '../lib/types';
import { TABLE_NAMES } from '../lib/types';
import { buildSeed } from './seed';

export interface Repo {
  mode: 'demo' | 'supabase';
  loadAll(): Promise<Tables>;
  upsert<T extends TableName>(table: T, rows: Row<T>[]): Promise<void>;
  remove(table: TableName, ids: string[]): Promise<void>;
  /** Perfil de la sesión actual (null = no autenticado). */
  currentProfile(db: Tables): Promise<Perfil | null>;
  signIn?(email: string): Promise<void>;
  signOut?(): Promise<void>;
  onAuthChange?(cb: () => void): () => void;
}

// ---------------------------------------------------------------- demo
const KEY = 'ct-proyectos-v1';
const KEY_USER = 'ct-proyectos-demo-user';

export class LocalRepo implements Repo {
  mode = 'demo' as const;
  private db: Tables | null = null;

  async loadAll(): Promise<Tables> {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Tables>;
        if (TABLE_NAMES.every((t) => Array.isArray(parsed[t]))) this.db = parsed as Tables;
      }
    } catch { /* almacenamiento no disponible: se usa el seed en memoria */ }
    this.db ??= buildSeed();
    this.persist();
    return structuredClone(this.db);
  }

  private persist() {
    try { localStorage.setItem(KEY, JSON.stringify(this.db)); } catch { /* modo privado */ }
  }

  async upsert<T extends TableName>(table: T, rows: Row<T>[]) {
    if (!this.db) return;
    const list = this.db[table] as Row<T>[];
    for (const r of rows) {
      const i = list.findIndex((x) => x.id === r.id);
      if (i >= 0) list[i] = r; else list.push(r);
    }
    this.persist();
  }

  async remove(table: TableName, ids: string[]) {
    if (!this.db) return;
    const set = new Set(ids);
    (this.db[table] as { id: string }[]) = (this.db[table] as { id: string }[]).filter((x) => !set.has(x.id));
    this.persist();
  }

  async currentProfile(db: Tables) {
    let id: string | null = null;
    try { id = localStorage.getItem(KEY_USER); } catch { /* */ }
    return db.perfiles.find((p) => p.id === id) ?? db.perfiles.find((p) => p.rol === 'admin') ?? null;
  }

  setDemoUser(id: string) {
    try { localStorage.setItem(KEY_USER, id); } catch { /* */ }
  }

  /** Reemplaza todo (restaurar demo, base vacía o importar JSON). */
  replaceAll(db: Tables) {
    this.db = structuredClone(db);
    this.persist();
  }
}

// ---------------------------------------------------------------- supabase
export class SupabaseRepo implements Repo {
  mode = 'supabase' as const;
  // Import dinámico: el SDK no se descarga en modo demo
  private client = import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY));

  async loadAll(): Promise<Tables> {
    const sb = await this.client;
    const entries = await Promise.all(
      TABLE_NAMES.map(async (t) => {
        // Paginado: PostgREST limita a 1000 filas por respuesta
        const rows: unknown[] = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await sb.from(t).select('*').range(from, from + 999);
          if (error) throw new Error(`${t}: ${error.message}`);
          rows.push(...data);
          if (data.length < 1000) break;
        }
        return [t, rows] as const;
      }),
    );
    return Object.fromEntries(entries) as unknown as Tables;
  }

  async upsert<T extends TableName>(table: T, rows: Row<T>[]) {
    const sb = await this.client;
    const { error } = await sb.from(table).upsert(rows as never[]);
    if (error) throw new Error(error.message);
  }

  async remove(table: TableName, ids: string[]) {
    const sb = await this.client;
    const { error } = await sb.from(table).delete().in('id', ids);
    if (error) throw new Error(error.message);
  }

  async currentProfile(db: Tables) {
    const sb = await this.client;
    const { data } = await sb.auth.getUser();
    if (!data.user) return null;
    return db.perfiles.find((p) => p.user_id === data.user!.id) ?? null;
  }

  async isLoggedIn() {
    const sb = await this.client;
    const { data } = await sb.auth.getSession();
    return !!data.session;
  }

  async signIn(email: string) {
    const sb = await this.client;
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split('#')[0] } });
    if (error) throw new Error(error.message);
  }

  async signOut() {
    const sb = await this.client;
    await sb.auth.signOut();
  }

  onAuthChange(cb: () => void) {
    let unsub = () => {};
    this.client.then((sb) => {
      const { data } = sb.auth.onAuthStateChange((evt) => { if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT') cb(); });
      unsub = () => data.subscription.unsubscribe();
    });
    return () => unsub();
  }
}

export const supabaseConfigurado = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
export const repo: Repo = supabaseConfigurado ? new SupabaseRepo() : new LocalRepo();
