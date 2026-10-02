import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Icon } from './components/Icon';
import { Layout } from './components/Layout';
import { Card, TipProvider } from './components/ui';
import { StoreProvider, useStore } from './data/store';
import { Acciones } from './pages/Acciones';
import { Admin } from './pages/Admin';
import { Beneficios } from './pages/Beneficios';
import { Costos } from './pages/Costos';
import { Oportunidades } from './pages/Oportunidades';
import { Plantas } from './pages/Plantas';
import { ProyectoDetalle } from './pages/ProyectoDetalle';
import { Proyectos } from './pages/Proyectos';
import { Resumen } from './pages/Resumen';
import './styles.css';

function Login() {
  const { signIn } = useStore();
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="login">
      <Card>
        <div className="brand" style={{ padding: '0 0 16px' }}>
          <div className="brand-mark"><Icon name="target" size={18} /></div>
          <div><b>Control Tower</b><span>Proyectos estratégicos</span></div>
        </div>
        {enviado ? <p>Revisa tu correo <b>{email}</b> y abre el enlace para entrar.</p> : (
          <form className="stack" style={{ gap: 12 }} onSubmit={async (e) => {
            e.preventDefault(); setError('');
            try { await signIn(email); setEnviado(true); } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
          }}>
            <label className="field"><span>Email corporativo</span><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <button className="btn primary" type="submit">Enviar enlace de acceso</button>
            {error && <p className="small" style={{ color: 'var(--crit)', margin: 0 }}>{error}</p>}
          </form>
        )}
      </Card>
    </div>
  );
}

function App() {
  const { status, error, signOut } = useStore();
  if (status === 'cargando') return <div className="login"><p className="muted">Cargando…</p></div>;
  if (status === 'login') return <Login />;
  if (status === 'error') return <div className="login"><Card title="No se pudieron cargar los datos"><p className="small">{error}</p></Card></div>;
  if (status === 'sin-perfil') {
    return (
      <div className="login"><Card title="Usuario sin perfil asignado">
        <p className="small">Tu correo aún no tiene un rol. Pide a Control de Gestión que te agregue en «Usuarios y roles».</p>
        <button className="btn" onClick={signOut}>Salir</button>
      </Card></div>
    );
  }
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Resumen />} />
        <Route path="/proyectos" element={<Proyectos />} />
        <Route path="/proyectos/:id" element={<ProyectoDetalle />} />
        <Route path="/plantas" element={<Plantas />} />
        <Route path="/beneficios" element={<Beneficios />} />
        <Route path="/oportunidades" element={<Oportunidades />} />
        <Route path="/costos" element={<Costos />} />
        <Route path="/acciones" element={<Acciones />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Resumen />} />
      </Routes>
    </Layout>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <StoreProvider>
        <TipProvider>
          <App />
        </TipProvider>
      </StoreProvider>
    </HashRouter>
  </StrictMode>,
);
