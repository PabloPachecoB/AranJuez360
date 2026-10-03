import { NavLink } from "react-router-dom";
import { useNegocio } from "../context/NegocioContext";
import { usePedidos } from "../context/PedidosContext";
import { useAuth } from "../../auth/AuthContext";

const ENLACES = [
  { to: "/productos", etiqueta: "Productos", icono: "inventory_2" },
  { to: "/pedidos", etiqueta: "Pedidos", icono: "receipt_long" },
  { to: "/negocio", etiqueta: "Mi negocio", icono: "storefront" },
  // Paseo 360: monedas (caja y QR) y lo que ven los clientes en la app y en la página del negocio.
  { to: "/caja", etiqueta: "Caja", icono: "point_of_sale" },
  { to: "/mi-qr", etiqueta: "Mi QR de caja", icono: "qr_code_2" },
  { to: "/ficha", etiqueta: "Ficha pública", icono: "badge" },
  { to: "/horarios", etiqueta: "Horarios", icono: "schedule" },
  { to: "/ofertas", etiqueta: "Ofertas", icono: "sell" },
  { to: "/fotos", etiqueta: "Fotos", icono: "photo_library" },
];

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

export function Sidebar({ abierto, onCerrar }: Props) {
  const { negocio } = useNegocio();
  const { pedidos } = usePedidos();
  const { cerrarSesion } = useAuth();
  const nuevos = pedidos.filter((p) => p.estado === "RECIBIDO").length;

  const clasesAside = [
    "fixed left-0 top-0 h-full w-72 bg-surface-container-lowest z-50 flex flex-col justify-between",
    "shadow-[0_1px_12px_rgba(0,0,0,0.03)] transform transition-transform duration-200",
    abierto ? "translate-x-0" : "-translate-x-full",
    "md:translate-x-0",
  ].join(" ");

  return (
    <>
      {abierto && (
        <div
          className="fixed inset-0 bg-on-surface/40 z-40 md:hidden"
          onClick={onCerrar}
          aria-hidden="true"
        />
      )}
      <aside className={clasesAside}>
        <div className="flex flex-col">
          <div className="px-space-lg pt-space-lg pb-space-md">
            <div className="flex items-center justify-between mb-space-sm">
              <div className="flex items-center gap-space-sm">
                <div className="h-8 w-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">storefront</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-headline-sm text-headline-sm text-primary tracking-tight">
                    PaseoYa
                  </span>
                  <span className="font-badge-code text-badge-code text-on-surface-variant uppercase">
                    Portal Locatarios
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="p-1.5 rounded-full text-on-surface-variant hover:bg-surface-container md:hidden"
                onClick={onCerrar}
                aria-label="Cerrar menu"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            {negocio && (
              <div className="mt-space-sm p-space-sm bg-surface-container-low rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    {negocio.nombre}
                  </span>
                  <span className="flex h-2 w-2 relative">
                    {negocio.activo && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                    )}
                    <span
                      className={
                        "relative inline-flex rounded-full h-2 w-2 " +
                        (negocio.activo ? "bg-secondary" : "bg-outline-variant")
                      }
                    />
                  </span>
                </div>
                <div className="flex items-center gap-space-xs mt-1 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">store</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Piso {negocio.piso} - Local {negocio.local}
                  </span>
                </div>
              </div>
            )}
          </div>
          <nav className="flex flex-col px-space-md gap-space-xs">
            {ENLACES.map(({ to, etiqueta, icono }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onCerrar}
                className={({ isActive }) =>
                  "flex items-center justify-between px-space-md py-space-sm rounded-lg transition-all " +
                  (isActive
                    ? "bg-primary-container text-on-primary-container font-semibold shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface")
                }
              >
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-[20px]">{icono}</span>
                  <span className="font-body-md text-body-md">{etiqueta}</span>
                </div>
                {to === "/pedidos" && nuevos > 0 && (
                  <span className="bg-secondary-container text-on-secondary-container font-label-sm text-label-sm px-2 py-0.5 rounded-full">
                    {nuevos} nuevos
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="p-space-md bg-surface-container-lowest flex flex-col gap-space-sm">
          {negocio && (
            <div className="p-space-sm bg-surface-container-low rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-space-xs">
                  <span
                    className={
                      "material-symbols-outlined text-[16px] " +
                      (negocio.activo ? "text-secondary" : "text-on-surface-variant")
                    }
                  >
                    check_circle
                  </span>
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    {negocio.activo ? "Comercio Abierto" : "Comercio Cerrado"}
                  </span>
                </div>
                {negocio.activo && (
                  <span className="font-badge-code text-badge-code text-secondary font-bold uppercase">
                    Live
                  </span>
                )}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {negocio.activo
                  ? "Recibiendo pedidos para recojo en tienda"
                  : "No visible para nuevos pedidos"}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={cerrarSesion}
            className="flex items-center gap-space-xs px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-error-container/40 hover:text-error font-label-md text-label-md font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
