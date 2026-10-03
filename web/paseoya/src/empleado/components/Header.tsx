import { useNegocio } from "../context/NegocioContext";
import { Switch } from "./Switch";

interface Props {
  onAbrirMenu: () => void;
}

export function Header({ onAbrirMenu }: Props) {
  const { negocio, guardar } = useNegocio();

  return (
    <header className="fixed top-0 left-0 md:left-72 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)] z-30 flex items-center justify-between px-space-md md:px-space-lg gap-space-sm">
      <div className="flex items-center gap-space-sm min-w-0">
        <button
          type="button"
          className="p-1.5 -ml-1.5 rounded-full text-on-surface-variant hover:bg-surface-container-low md:hidden shrink-0"
          onClick={onAbrirMenu}
          aria-label="Abrir menú"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>
        <div className="min-w-0">
          <h2 className="font-headline-sm text-headline-sm text-on-surface truncate">
            {negocio?.nombre ?? "Cargando..."}
          </h2>
          {negocio && (
            <p className="font-body-sm text-body-sm text-on-surface-variant truncate hidden sm:block">
              Paseo Aranjuez · Piso {negocio.piso} · Local {negocio.local}
            </p>
          )}
        </div>
      </div>
      {negocio && (
        <div className="flex items-center gap-space-sm md:gap-space-lg shrink-0">
          <div className="flex items-center gap-space-sm bg-surface-container-low px-space-sm md:px-space-md py-1.5 rounded-full">
            <span className="font-label-sm text-label-sm text-on-surface font-semibold hidden sm:inline">
              Recepción {negocio.activo ? "activa" : "pausada"}
            </span>
            <Switch
              checked={negocio.activo}
              onChange={(activo) => guardar({ activo })}
              label="Recepción activa"
            />
          </div>
          <div className="hidden md:flex items-center gap-space-sm pl-space-sm">
            <div className="w-8 h-8 rounded-full bg-primary-fixed text-on-primary-fixed-variant flex items-center justify-center font-headline-sm text-headline-sm ring-2 ring-surface-container-high">
              {negocio.nombre.charAt(0)}
            </div>
            <div className="flex flex-col text-left">
              <span className="font-label-md text-label-md text-on-surface font-bold">Administrador</span>
              <span className="font-badge-code text-badge-code text-on-surface-variant">Portal Locatarios</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
