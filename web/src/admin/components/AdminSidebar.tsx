import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { ROLES } from "../format";
import { useSidebar } from "./SidebarContext";

interface OpcionNavegacion {
  label: string;
  icono: string;
  to?: string;
}

interface GrupoNavegacion {
  titulo: string;
  opciones: OpcionNavegacion[];
}

const GRUPOS: GrupoNavegacion[] = [
  { titulo: "Resumen", opciones: [{ label: "Dashboard", icono: "grid_view", to: "/" }] },
  {
    titulo: "Directorio",
    opciones: [
      { label: "Establecimientos", icono: "storefront", to: "/empresas" },
      { label: "Invitaciones", icono: "forward_to_inbox", to: "/invitaciones" },
      { label: "Mapa y espacios", icono: "map", to: "/mapa-espacios" },
      { label: "Categorías", icono: "category", to: "/categorias" },
    ],
  },
  {
    titulo: "Operación",
    opciones: [
      { label: "Pedidos y retiros", icono: "shopping_bag", to: "/pedidos" },
      { label: "Promociones y eventos", icono: "confirmation_number", to: "/diversion" },
      { label: "Escenario abierto", icono: "mic_external_on", to: "/escenario" },
      { label: "Paseo Points", icono: "stars", to: "/monedas" },
    ],
  },
  {
    titulo: "Personas",
    opciones: [
      { label: "Usuarios", icono: "group", to: "/usuarios" },
      { label: "Representantes", icono: "badge", to: "/representantes" },
      { label: "Equipo del Paseo", icono: "shield_person", to: "/equipo" },
    ],
  },
  {
    titulo: "Inteligencia y análisis",
    opciones: [
      { label: "Asistente de análisis", icono: "psychology", to: "/asistente" },
      { label: "Reportes", icono: "insights", to: "/reportes" },
    ],
  },
  {
    titulo: "Administración",
    opciones: [
      { label: "Auditoría", icono: "verified_user", to: "/auditoria" },
      { label: "Configuración", icono: "settings", to: "/configuracion" },
    ],
  },
];

function Icono({ nombre }: { nombre: string }) {
  return <span className="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">{nombre}</span>;
}

function Opcion({ opcion }: { opcion: OpcionNavegacion }) {
  const { cerrar } = useSidebar();
  const clases = "group relative flex min-h-11 items-center gap-space-sm rounded-lg px-space-sm font-body-md text-body-md transition-colors";

  if (!opcion.to) {
    return (
      <span
        aria-disabled="true"
        title="Este módulo todavía no está disponible"
        className={`${clases} cursor-not-allowed text-admin-sidebar-muted/55`}
      >
        <Icono nombre={opcion.icono} />
        <span className="truncate">{opcion.label}</span>
      </span>
    );
  }

  return (
    <NavLink
      to={opcion.to}
      end={opcion.to === "/"}
      onClick={cerrar}
      className={({ isActive }) => [
        clases,
        isActive
          ? "bg-admin-sidebar-active font-semibold text-admin-sidebar-fg"
          : "text-admin-sidebar-muted hover:bg-white/10 hover:text-admin-sidebar-fg",
      ].join(" ")}
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-admin-sidebar-accent" aria-hidden="true" />}
          <Icono nombre={opcion.icono} />
          <span className="truncate">{opcion.label}</span>
        </>
      )}
    </NavLink>
  );
}

export function AdminSidebar() {
  const { usuario, cerrarSesion } = useAuth();
  const { abierto, cerrar } = useSidebar();
  const nombre = [usuario?.first_name, usuario?.last_name].filter(Boolean).join(" ") || usuario?.email || "Administración Paseo";
  const iniciales = [usuario?.first_name, usuario?.last_name]
    .filter(Boolean)
    .map((parte) => parte?.trim().charAt(0))
    .join("")
    .toUpperCase() || "AP";

  return (
    <>
      {abierto && (
        <button
          type="button"
          aria-label="Cerrar menú de navegación"
          className="fixed inset-0 z-30 bg-admin-sidebar-bg/60 md:hidden"
          onClick={cerrar}
        />
      )}
      <aside
        id="admin-sidebar"
        aria-label="Navegación del panel administrativo"
        className={[
          "fixed inset-y-0 left-0 z-40 flex w-[16.5rem] flex-col bg-admin-sidebar-bg px-space-md py-space-lg text-admin-sidebar-fg shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none md:translate-x-0 md:shadow-none",
          abierto ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="mb-space-lg flex items-center gap-space-sm px-space-xs">
          <img
            src="/logo-paseo-aranjuez.svg"
            alt="Logo de Paseo Aranjuez"
            className="h-12 w-12 shrink-0 object-contain"
          />
          <div className="min-w-0">
            <p className="truncate font-headline-sm text-headline-sm font-bold tracking-tight text-admin-sidebar-fg">Paseo Aranjuez</p>
            <p className="mt-0.5 font-label-sm text-label-sm text-admin-sidebar-muted">Panel administrativo</p>
          </div>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={cerrar}
            className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-lg text-admin-sidebar-muted hover:bg-white/10 hover:text-admin-sidebar-fg md:hidden"
          >
            <Icono nombre="close" />
          </button>
        </div>

        <nav aria-label="Secciones administrativas" className="min-h-0 flex-1 space-y-space-md overflow-y-auto pr-1">
          {GRUPOS.map((grupo) => (
            <section key={grupo.titulo} aria-label={grupo.titulo}>
              <h2 className="mb-space-xs px-space-sm font-label-sm text-label-sm font-semibold uppercase tracking-[0.14em] text-admin-sidebar-muted/70">
                {grupo.titulo}
              </h2>
              <ul className="space-y-1">
                {grupo.opciones.map((opcion) => (
                  <li key={opcion.label}><Opcion opcion={opcion} /></li>
                ))}
              </ul>
            </section>
          ))}
        </nav>

        <div className="mt-space-md border-t border-admin-sidebar-divider pt-space-md">
          <div className="flex min-w-0 items-center gap-space-sm">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-admin-sidebar-active font-label-md text-label-md font-semibold text-admin-sidebar-fg" aria-hidden="true">
              {iniciales}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-label-md text-label-md font-semibold text-admin-sidebar-fg">{nombre}</p>
              <p className="truncate font-body-sm text-body-sm text-admin-sidebar-muted">{ROLES[usuario?.rol ?? ""] || "Administrador"}</p>
            </div>
            <button
              type="button"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              onClick={cerrarSesion}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-admin-sidebar-muted transition-colors hover:bg-white/10 hover:text-admin-sidebar-fg"
            >
              <Icono nombre="logout" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
