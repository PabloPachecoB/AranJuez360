import { useNegocio } from "../context/NegocioContext";
import { Switch } from "./Switch";

export function Header() {
  const { negocio, setNegocio } = useNegocio();

  return (
    <header className="fixed top-0 left-72 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)] z-40 flex items-center justify-between px-space-lg">
      <div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{negocio.nombre}</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Paseo Aranjuez · Piso {negocio.piso} · Local {negocio.local}
        </p>
      </div>
      <div className="flex items-center gap-space-lg">
        <div className="flex items-center gap-space-sm bg-surface-container-low px-space-md py-1.5 rounded-full">
          <span className="font-label-sm text-label-sm text-on-surface font-semibold">
            Recepción {negocio.activo ? "activa" : "pausada"}
          </span>
          <Switch
            checked={negocio.activo}
            onChange={(activo) => setNegocio((prev) => ({ ...prev, activo }))}
            label="Recepción activa"
          />
        </div>
        <div className="flex items-center gap-space-sm pl-space-sm">
          <div className="w-8 h-8 rounded-full bg-primary-fixed text-on-primary-fixed-variant flex items-center justify-center font-headline-sm text-headline-sm ring-2 ring-surface-container-high">
            {negocio.nombre.charAt(0)}
          </div>
          <div className="flex flex-col text-left">
            <span className="font-label-md text-label-md text-on-surface font-bold">Administrador</span>
            <span className="font-badge-code text-badge-code text-on-surface-variant">
              Portal Locatarios
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
