import { NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { ROLES } from "./format";
import ClienteHistorial from "./pages/ClienteHistorial";
import Dashboard from "./pages/Dashboard";
import Empresas from "./pages/Empresas";
import Login from "./pages/Login";
import Usuarios from "./pages/Usuarios";
import Points from "./pages/Points";

function Layout() {
  const { user, salir } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Paseo Aranjuez 360<small>Administración</small></div>
        <nav className="nav" aria-label="Principal">
          <NavLink to="/" end>Inicio</NavLink>
          <NavLink to="/usuarios">Usuarios</NavLink>
          <NavLink to="/empresas">Empresas</NavLink>
          <NavLink to="/points">Paseo Points</NavLink>
        </nav>
        <div className="user">
          {user.first_name || user.email}
          <br />
          {ROLES[user.rol]} ·{" "}
          <a href="#salir" onClick={(e) => { e.preventDefault(); salir(); }}>Cerrar sesión</a>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}

function SoloAdmin() {
  const { user, salir } = useAuth();
  return (
    <div className="login">
      <div className="card">
        <h1>Hola, {user.first_name || user.email}</h1>
        <p>
          Tu cuenta es de tipo <strong>{ROLES[user.rol]}</strong>. El panel de empresas y oficinas
          está en construcción; por ahora esta web es solo para la administración del Paseo.
        </p>
        <button className="btn" onClick={salir}>Cerrar sesión</button>
      </div>
    </div>
  );
}

export default function App() {
  const { user, cargando } = useAuth();
  if (cargando) return <div className="empty">Cargando…</div>;
  if (!user) return <Login />;
  if (["CLIENTE", "NEGOCIO", "CAJERO"].includes(user.rol)) return <Points />;
  if (user.rol !== "ADMIN") return <SoloAdmin />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="empresas" element={<Empresas />} />
        <Route path="points" element={<Points />} />
        <Route path="clientes/:id" element={<ClienteHistorial />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
