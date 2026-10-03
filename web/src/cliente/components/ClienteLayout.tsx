import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

const enlaces = [
  { to: "/", label: "Resumen", icon: "home", end: true },
  { to: "/pase", label: "Mi pase", icon: "qr_code_2" },
  { to: "/puntos", label: "Mis puntos", icon: "toll" },
  { to: "/recompensas", label: "Recompensas", icon: "redeem" },
  { to: "/cupones", label: "Cupones", icon: "confirmation_number" },
  { to: "/movimientos", label: "Movimientos", icon: "receipt_long" },
  { to: "/explorar", label: "Explorar", icon: "storefront" },
  { to: "/perfil", label: "Mi perfil", icon: "account_circle" },
];

function enlaceClase(activo: boolean) {
  return [
    "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
    activo
      ? "bg-primary text-on-primary"
      : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
  ].join(" ");
}

export function ClienteLayout() {
  const { usuario, cerrarSesion } = useAuth();
  const nombre = usuario?.first_name || usuario?.email || "Cliente";

  return (
    <div className="cliente-theme min-h-screen bg-background font-sans text-on-surface md:grid md:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="border-b border-outline-variant/50 bg-surface-container-lowest md:sticky md:top-0 md:flex md:h-screen md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-5 py-4 md:px-6 md:pb-6 md:pt-7">
          <Link to="/" className="flex min-w-0 items-center gap-3 text-primary">
            <span
              role="img"
              aria-label="Logo de Paseo Aranjuez"
              className="h-10 w-10 shrink-0 bg-primary"
              style={{
                maskImage: "url('/logo-paseo-aranjuez.svg')",
                WebkitMaskImage: "url('/logo-paseo-aranjuez.svg')",
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                maskPosition: "center",
                WebkitMaskPosition: "center",
                maskSize: "contain",
                WebkitMaskSize: "contain",
              }}
            />
            <span className="truncate font-headline-sm text-headline-sm font-bold">Paseo Aranjuez</span>
          </Link>
          <button type="button" onClick={cerrarSesion} className="rounded-md px-2 py-1 font-label-sm text-label-sm font-bold text-primary md:hidden">Salir</button>
        </div>

        <nav aria-label="Navegación del cliente" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:px-3">
          {enlaces.map((enlace) => (
            <NavLink key={enlace.to} to={enlace.to} end={enlace.end} className={({ isActive }) => enlaceClase(isActive)}>
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{enlace.icon}</span>
              <span>{enlace.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="hidden border-t border-outline-variant/40 px-5 py-5 md:mt-auto md:block">
          <p className="truncate font-label-md text-label-md font-semibold text-on-surface">{nombre}</p>
          <p className="mt-1 truncate font-body-sm text-body-sm text-on-surface-variant">{usuario?.email}</p>
          <button type="button" onClick={cerrarSesion} className="mt-4 font-label-md text-label-md font-semibold text-primary hover:underline">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="min-w-0 px-4 pb-10 pt-5 sm:px-6 md:px-8 md:py-8 xl:px-12">
        <Outlet />
      </main>
    </div>
  );
}