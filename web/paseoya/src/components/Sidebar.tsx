import { NavLink } from "react-router-dom";
import { negocioActual } from "../mockData";

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-logo">PaseoYa</span>
        <span className="sidebar-brand-negocio">{negocioActual.nombre}</span>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/productos" className="sidebar-link">
          Productos
        </NavLink>
        <NavLink to="/pedidos" className="sidebar-link">
          Pedidos
        </NavLink>
        <NavLink to="/negocio" className="sidebar-link">
          Mi negocio
        </NavLink>
      </nav>
    </aside>
  );
}
