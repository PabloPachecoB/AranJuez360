import Points from "../pages/Points";
import { NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "../auth";
import { Estado, useApi } from "../components/ui";
import Catalogo, { Fotos, Ofertas } from "./Catalogo";
import Horarios from "./Horarios";
import MiFicha from "./MiFicha";
import Visitas from "./Visitas";

const TIPOS = { NEGOCIO: "Negocio", EMPRENDIMIENTO: "Emprendimiento", OFICINA: "Oficina" };

/**
 * Mini-sistema de cada empresa dentro del panel del Paseo (idea base: rama brenda-explorar,
 * "Mi local" y "Ver presentación", ahora conectado al backend). El menú cambia según el tipo.
 */
export default function EmpresaApp() {
  const { user, salir } = useAuth();
  const perfil = useApi("/mi-empresa/");
  const empresa = perfil.data;

  return (
    <Estado cargando={perfil.cargando && !empresa} error={perfil.error} vacio={false}>
      {empresa && (
        <Routes>
          <Route element={<Layout empresa={empresa} user={user} salir={salir} />}>
            <Route index element={<MiFicha empresa={empresa} onCambio={perfil.recargar} />} />
            {empresa.tipo !== "OFICINA" && <Route path="points" element={<Points />} />}
            <Route path="horarios" element={<Horarios empresa={empresa} />} />
            <Route path="catalogo" element={<Catalogo empresa={empresa} />} />
            {empresa.tipo !== "OFICINA" && <Route path="ofertas" element={<Ofertas />} />}
            <Route path="fotos" element={<Fotos />} />
            {empresa.tipo === "OFICINA" && <Route path="visitas" element={<Visitas />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </Estado>
  );
}

function Layout({ empresa, user, salir }) {
  const oficina = empresa.tipo === "OFICINA";
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">{empresa.nombre}<small>{TIPOS[empresa.tipo]} · Paseo Aranjuez</small></div>
        <nav className="nav" aria-label="Mi empresa">
          {oficina && <NavLink to="/visitas">Visitas</NavLink>}
          <NavLink to="/" end>Mi ficha</NavLink>
          <NavLink to="/horarios">{oficina ? "Horario de atención" : empresa.tipo === "EMPRENDIMIENTO" ? "Días y horarios" : "Horarios"}</NavLink>
          <NavLink to="/catalogo">{oficina ? "Servicios" : "Productos y menú"}</NavLink>
          {!oficina && <NavLink to="/points">Validar beneficios</NavLink>}
          {!oficina && <NavLink to="/ofertas">Ofertas</NavLink>}
          <NavLink to="/fotos">Fotos</NavLink>
          <a href={`/sitio/${empresa.id}`} target="_blank" rel="noreferrer">Ver mi página ↗</a>
        </nav>
        <div className="user">
          {user.first_name || user.email}
          <br />
          <a href="#salir" onClick={(e) => { e.preventDefault(); salir(); }}>Cerrar sesión</a>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}
