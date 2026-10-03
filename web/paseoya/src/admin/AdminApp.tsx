import { Navigate, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ROLES } from "./format";
import ClienteHistorial from "./pages/ClienteHistorial";
import Dashboard from "./pages/Dashboard";
import Empresas from "./pages/Empresas";
import Usuarios from "./pages/Usuarios";

function Layout() {
  const { usuario, cerrarSesion } = useAuth();

  return (
    <div className="min-h-screen bg-background text-on-surface md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="flex flex-wrap items-center gap-space-md border-b border-outline-variant/40 bg-surface-container-lowest p-space-md md:min-h-screen md:flex-col md:items-stretch md:gap-space-lg md:border-b-0 md:border-r md:p-space-lg">
        <div className="min-w-0 font-headline-sm text-headline-sm text-primary">
          Paseo Aranjuez 360
          <span className="mt-1 block font-body-sm text-body-sm text-on-surface-variant">Administración</span>
        </div>
        <nav className="flex flex-wrap gap-space-xs md:flex-col" aria-label="Principal">
          <NavLink to="/" end className={claseEnlace}>Inicio</NavLink>
          <NavLink to="/usuarios" className={claseEnlace}>Usuarios</NavLink>
          <NavLink to="/empresas" className={claseEnlace}>Empresas</NavLink>
        </nav>
        <div className="ml-auto border-l border-outline-variant/40 pl-space-md font-body-sm text-body-sm text-on-surface-variant md:mt-auto md:ml-0 md:border-l-0 md:border-t md:pl-0 md:pt-space-md">
          <span className="font-semibold text-on-surface">{usuario?.first_name || usuario?.email}</span>
          <span className="block">{ROLES[usuario?.rol ?? ""] || usuario?.rol}</span>
          <button
            type="button"
            onClick={cerrarSesion}
            className="mt-1 font-label-md text-label-md text-primary hover:underline"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="min-w-0 px-space-md py-space-lg md:px-space-xl md:py-space-xl">
        <Outlet />
      </main>
    </div>
  );
}

function claseEnlace({ isActive }: { isActive: boolean }) {
  return [
    "rounded-lg px-space-md py-space-sm font-body-md text-body-md transition-colors",
    isActive
      ? "bg-primary-container text-on-primary-container font-semibold"
      : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
  ].join(" ");
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
