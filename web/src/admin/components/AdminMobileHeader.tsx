import { useSidebar } from "./SidebarContext";

export function AdminMobileHeader() {
  const { abierto, alternar } = useSidebar();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-space-sm border-b border-outline-variant/40 bg-surface-container-lowest px-space-md md:hidden">
      <button
        type="button"
        aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
        aria-controls="admin-sidebar"
        aria-expanded={abierto}
        onClick={alternar}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
      >
        <span className="material-symbols-outlined text-[22px] leading-none" aria-hidden="true">menu</span>
      </button>
      <img src="/logo-paseo-aranjuez.svg" alt="" className="h-9 w-9 shrink-0 object-contain" />
      <span className="truncate font-headline-sm text-headline-sm font-semibold text-primary">Panel administrativo</span>
    </header>
  );
}
