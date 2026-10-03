import { useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import type { Empresa, ListaApi } from "../api";
import { CabeceraCliente, Superficie } from "../components/ClienteUi";
import { useClienteDatos } from "../hooks/useClienteDatos";
import { lista } from "../utils";

const CLAVE_PREFERENCIAS = "paseoya_cliente_preferencias";

function leerPreferencias(): { marcas: string[]; cumple: string } {
  try {
    const guardado = localStorage.getItem(CLAVE_PREFERENCIAS);
    return guardado ? JSON.parse(guardado) as { marcas: string[]; cumple: string } : { marcas: [], cumple: "" };
  } catch {
    return { marcas: [], cumple: "" };
  }
}

export function ClientePerfilPage() {
  const { usuario } = useAuth();
  const empresasApi = useClienteDatos<ListaApi<Empresa>>("/empresas/", false);
  const [preferencias, setPreferencias] = useState(leerPreferencias);
  const [guardado, setGuardado] = useState(false);
  const nombre = [usuario?.first_name, usuario?.last_name].filter(Boolean).join(" ");
  const marcas = lista(empresasApi.data).map((empresa) => empresa.nombre);

  function alternarMarca(marca: string) {
    setPreferencias((actual) => ({
      ...actual,
      marcas: actual.marcas.includes(marca) ? actual.marcas.filter((item) => item !== marca) : [...actual.marcas, marca],
    }));
    setGuardado(false);
  }

  function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(preferencias));
    setGuardado(true);
  }

  return (
    <div className="animate-cliente-in">
      <CabeceraCliente eyebrow="Tu cuenta PaseoYa" titulo="Mi perfil" descripcion="Mantén tus datos al día y recibe novedades que sí te interesan." />
      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Superficie>
          <p className="font-label-md text-label-md font-bold uppercase text-secondary">Datos personales</p>
          <dl className="mt-5 divide-y divide-outline-variant/40">
            <div className="py-3"><dt className="font-label-sm text-label-sm text-on-surface-variant">Nombre</dt><dd className="mt-1 font-body-md text-body-md font-semibold">{nombre || usuario?.username || "—"}</dd></div>
            <div className="py-3"><dt className="font-label-sm text-label-sm text-on-surface-variant">Correo</dt><dd className="mt-1 break-all font-body-md text-body-md font-semibold">{usuario?.email || "—"}</dd></div>
            <div className="py-3"><dt className="font-label-sm text-label-sm text-on-surface-variant">Celular</dt><dd className="mt-1 font-body-md text-body-md font-semibold">{usuario?.celular || "Sin registrar"}</dd></div>
            <div className="py-3"><dt className="font-label-sm text-label-sm text-on-surface-variant">Fecha de cumpleaños</dt><dd className="mt-1 font-body-md text-body-md font-semibold">{usuario?.fecha_nacimiento || preferencias.cumple || "Sin registrar"}</dd></div>
          </dl>
        </Superficie>

        <Superficie>
          <form onSubmit={guardar}>
            <p className="font-label-md text-label-md font-bold uppercase text-secondary">Mis preferencias</p>
            <fieldset className="mt-5">
              <legend className="font-body-md text-body-md font-semibold">Tus marcas favoritas</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {marcas.map((marca) => <label key={marca} className={`flex min-h-11 cursor-pointer items-center gap-3 border px-3 ${preferencias.marcas.includes(marca) ? "border-secondary bg-[#edf5ee]" : "border-outline-variant/50"}`}><input type="checkbox" checked={preferencias.marcas.includes(marca)} onChange={() => alternarMarca(marca)} className="h-4 w-4 accent-[#006c4c]" /><span className="font-body-sm text-body-sm">{marca}</span></label>)}
              </div>
              {!marcas.length && <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">No hay establecimientos disponibles para seleccionar.</p>}
            </fieldset>
            {!usuario?.fecha_nacimiento && <label className="mt-5 flex max-w-xs flex-col gap-2 font-label-md text-label-md font-semibold">Fecha de cumpleaños<input type="date" value={preferencias.cumple} onChange={(event) => { setPreferencias((actual) => ({ ...actual, cumple: event.target.value })); setGuardado(false); }} className="h-11 border border-outline-variant/60 bg-surface-container-lowest px-3 font-body-md text-body-md" /></label>}
            <div className="mt-6 flex flex-wrap items-center gap-4"><button type="submit" className="min-h-11 bg-primary px-5 font-label-md text-label-md font-bold text-on-primary hover:bg-primary-container">Guardar preferencias</button>{guardado && <p role="status" className="font-body-sm text-body-sm font-semibold text-secondary">Preferencias guardadas en este dispositivo.</p>}</div>
          </form>
        </Superficie>
      </div>
    </div>
  );
}