import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useStore } from '../data/store';
import { ROLES } from '../lib/types';
import { Icon, type IconName } from './Icon';

const NAV: [string, string, IconName][] = [
  ['/', 'Resumen ejecutivo', 'dashboard'],
  ['/proyectos', 'Proyectos', 'folder'],
  ['/plantas', 'Plantas y líderes', 'factory'],
  ['/beneficios', 'Beneficios y ROI', 'coins'],
  ['/oportunidades', 'Árbol de oportunidades', 'tree'],
  ['/costos', 'Desviaciones de costo', 'trend'],
  ['/acciones', 'Planes de acción', 'checkSquare'],
  ['/admin', 'Datos y administración', 'settings'],
];

function useTheme() {
  const [theme, setTheme] = useState<string | null>(() => { try { return localStorage.getItem('ct-theme'); } catch { return null; } });
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme;
    try { if (theme) localStorage.setItem('ct-theme', theme); } catch { /* */ }
  }, [theme]);
  const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  return [dark, () => setTheme(dark ? 'light' : 'dark')] as const;
}

export function Layout({ children }: { children: ReactNode }) {
  const { db, me, modo, planta, setPlanta, setDemoUser, signOut, toastMsg } = useStore();
  const [dark, toggle] = useTheme();

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="brand-mark"><Icon name="target" size={18} /></div>
          <div><b>Control Tower</b><span>Proyectos estratégicos</span></div>
        </div>
        <nav className="nav" aria-label="Principal">
          {NAV.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/'} title={label}>
              <Icon name={icon} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <span>{modo === 'demo' ? 'Modo demo · datos ficticios guardados en este navegador' : 'Conectado a Supabase'}</span>
          <a href="../index.html"><Icon name="arrowLeft" size={12} /> Volver al portafolio</a>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <label className="row small" style={{ gap: 6 }}>
            <Icon name="factory" size={14} />
            <select className="select" style={{ width: 'auto' }} value={planta} onChange={(e) => setPlanta(e.target.value)} aria-label="Filtrar planta">
              <option value="todas">Todas las plantas</option>
              {db.plantas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <div className="grow" />
          {modo === 'demo' ? (
            <label className="row small" style={{ gap: 6 }} title="En el demo puedes cambiar de usuario para probar los permisos de cada rol">
              <Icon name="user" size={14} />
              <span className="muted">Ver como</span>
              <select className="select" style={{ width: 'auto', maxWidth: 260 }} value={me?.id ?? ''} onChange={(e) => setDemoUser(e.target.value)} aria-label="Usuario demo">
                {db.perfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre} · {ROLES[p.rol]}{p.planta_id ? ` (${db.plantas.find((x) => x.id === p.planta_id)?.nombre})` : ''}</option>
                ))}
              </select>
            </label>
          ) : (
            <span className="row small">
              <Icon name="user" size={14} /> <b>{me?.nombre}</b> <span className="badge accent">{me && ROLES[me.rol]}</span>
              <button className="btn sm ghost" onClick={signOut}><Icon name="logout" size={14} /> Salir</button>
            </span>
          )}
          <button className="btn icon ghost" onClick={toggle} aria-label={dark ? 'Modo claro' : 'Modo oscuro'} title={dark ? 'Modo claro' : 'Modo oscuro'}>
            <Icon name={dark ? 'sun' : 'moon'} />
          </button>
        </header>
        <main className="content">{children}</main>
      </div>
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}
