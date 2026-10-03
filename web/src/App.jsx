import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import EmpresaApp from "./empresa/EmpresaApp";
import Sitio from "./empresa/Sitio";
import { ROLES } from "./format";
import ClienteHistorial from "./pages/ClienteHistorial";
import Dashboard from "./pages/Dashboard";
import Diversion from "./pages/Diversion";
import Empresas from "./pages/Empresas";
import Activar from "./pages/Activar";
import Invitaciones from "./pages/Invitaciones";
import Login from "./pages/Login";
import Monedas from "./pages/Monedas";
import Usuarios from "./pages/Usuarios";

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
          <NavLink to="/invitaciones">Invitaciones</NavLink>
          <NavLink to="/monedas">Monedas</NavLink>
          <NavLink to="/diversion">Diversión</NavLink>
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
          Tu cuenta es de tipo <strong>{ROLES[user.rol]}</strong>. Esta web es para la administración
          del Paseo y para los responsables de cada negocio u oficina.
        </p>
        <button className="btn" onClick={salir}>Cerrar sesión</button>
      </div>
    </div>
  );
}

export default function App() {
  const { user, cargando } = useAuth();
  const { pathname } = useLocation();
  // Página pública de cada empresa: no requiere iniciar sesión.
  if (pathname.startsWith("/sitio/")) {
    return <Routes><Route path="/sitio/:id" element={<Sitio />} /></Routes>;
  }
  // Enlace del correo de invitación: el invitado crea su cuenta (sin sesión).
  if (pathname.startsWith("/activar/")) {
    return <Routes><Route path="/activar/:token" element={<Activar />} /></Routes>;
  }
  if (cargando) return <div className="empty">Cargando…</div>;
  if (!user) return <Login />;
  // Negocios, emprendimientos y oficinas tienen su propio mini-sistema.
  if ((user.rol === "NEGOCIO" || user.rol === "OFICINA") && user.empresa) return <EmpresaApp />;
  if (user.rol !== "ADMIN") return <SoloAdmin />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="empresas" element={<Empresas />} />
        <Route path="invitaciones" element={<Invitaciones />} />
        <Route path="monedas" element={<Monedas />} />
        <Route path="diversion" element={<Diversion />} />
        <Route path="clientes/:id" element={<ClienteHistorial />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
