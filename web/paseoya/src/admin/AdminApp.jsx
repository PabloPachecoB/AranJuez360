import { Navigate, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ROLES } from "./format";
import ClienteHistorial from "./pages/ClienteHistorial";
import Dashboard from "./pages/Dashboard";
import Empresas from "./pages/Empresas";
import Usuarios from "./pages/Usuarios";
import "./styles.css";

function Layout() {
  const { usuario, cerrarSesion } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Paseo Aranjuez 360<small>Administración</small></div>
        <nav className="nav" aria-label="Principal">
          <NavLink to="/" end>Inicio</NavLink>
          <NavLink to="/usuarios">Usuarios</NavLink>
          <NavLink to="/empresas">Empresas</NavLink>
        </nav>
        <div className="user">
          {usuario?.first_name || usuario?.email}
          <br />
          {ROLES[usuario?.rol]} ·{" "}
          <a href="#salir" onClick={(event) => { event.preventDefault(); cerrarSesion(); }}>
            Cerrar sesión
          </a>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}

export default function AdminApp() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="empresas" element={<Empresas />} />
        <Route path="clientes/:id" element={<ClienteHistorial />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
