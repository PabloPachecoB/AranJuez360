import { NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "../auth";
import { Estado, useApi } from "../ui";
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

const Icono = ({ nombre }) => <span className="material-symbols-outlined">{nombre}</span>;

function Layout({ empresa, user, salir }) {
  const oficina = empresa.tipo === "OFICINA";
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="side-marca">
          <div className="side-logo"><Icono nombre={oficina ? "apartment" : "storefront"} /></div>
          <div>
            <div className="side-titulo">Paseo Aranjuez 360</div>
            <div className="side-sub">{oficina ? "Portal Oficinas" : "Portal Locatarios"}</div>
          </div>
        </div>
        <div className="side-local">
          <strong>{empresa.nombre}</strong>
          <span><Icono nombre="store" /> {TIPOS[empresa.tipo]}{empresa.piso ? ` · Piso ${empresa.piso}` : ""}{empresa.local ? ` - ${oficina ? "Of." : "Local"} ${empresa.local}` : ""}</span>
        </div>
        <nav className="nav" aria-label="Mi empresa">
          {oficina && <NavLink to="/visitas"><Icono nombre="groups" />Visitas</NavLink>}
          <NavLink to="/" end><Icono nombre="badge" />Mi ficha</NavLink>
          <NavLink to="/horarios"><Icono nombre="schedule" />{oficina ? "Horario de atención" : empresa.tipo === "EMPRENDIMIENTO" ? "Días y horarios" : "Horarios"}</NavLink>
          <NavLink to="/catalogo"><Icono nombre="inventory_2" />{oficina ? "Servicios" : "Productos y menú"}</NavLink>
          {!oficina && <NavLink to="/ofertas"><Icono nombre="sell" />Ofertas</NavLink>}
          <NavLink to="/fotos"><Icono nombre="photo_library" />Fotos</NavLink>
          <a href={`/sitio/${empresa.id}`} target="_blank" rel="noreferrer"><Icono nombre="open_in_new" />Ver mi página</a>
        </nav>
        <div className="user">
          <div className="user-nombre">{user.first_name || user.email}</div>
          <a href="#salir" className="salir" onClick={(e) => { e.preventDefault(); salir(); }}><Icono nombre="logout" />Cerrar sesión</a>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}
