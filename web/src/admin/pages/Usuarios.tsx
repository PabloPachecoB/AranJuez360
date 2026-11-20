import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, qs } from "../../api/client";
import { Estado, useApi } from "../components/ui";
import { fecha, hace, ROLES } from "../format";

interface UsuarioAdmin {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  empresa_nombre: string | null;
  is_active: boolean;
  debe_cambiar_password: boolean;
  date_joined: string;
  last_login: string | null;
}
interface ListaUsuarios { count: number; next: string | null; previous: string | null; results: UsuarioAdmin[] }
type Filtro = "rol" | "activo" | "sin_activar" | "buscar" | "page";

const campo = "min-h-10 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-space-sm py-2 text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary";
const boton = "rounded-lg border border-outline-variant/60 px-space-sm py-1.5 font-label-sm text-label-sm text-primary transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50";
const etiqueta = "inline-flex rounded-full bg-surface-container px-space-sm py-0.5 font-label-sm text-label-sm font-semibold text-on-surface-variant";
const tabla = "w-full border-collapse text-left font-body-sm text-body-sm text-on-surface";
const th = "whitespace-nowrap border-b border-outline-variant/40 px-space-sm py-space-sm font-label-md text-label-md text-on-surface-variant";
const td = "border-b border-outline-variant/30 px-space-sm py-space-sm align-middle";

export default function Usuarios() {
  const [params, setParams] = useSearchParams();
  const [buscar, setBuscar] = useState(params.get("buscar") || "");
  const filtros = {
    rol: params.get("rol") || "",
    activo: params.get("activo") || "",
    sin_activar: params.get("sin_activar") || "",
    buscar: params.get("buscar") || "",
    page: params.get("page") || "",
  };
  const lista = useApi<ListaUsuarios>(`/admin/usuarios/${qs(filtros)}`);
  const [error, setError] = useState<string | null>(null);

  function cambiar(clave: Filtro, valor: string) {
    const nuevos = new URLSearchParams(params);
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    if (clave !== "page") nuevos.delete("page");
    setParams(nuevos);
  }

  async function alternar(usuario: UsuarioAdmin) {
    setError(null);
    try {
      await api(`/admin/usuarios/${usuario.id}/`, {
        method: "PATCH",
        body: { is_active: !usuario.is_active },
      });
      lista.recargar();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el usuario.");
    }
  }

  function buscarUsuarios(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    cambiar("buscar", buscar.trim());
  }

  const pagina = Number(filtros.page || 1);

  return (
    <>
      <header className="mb-space-md">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Usuarios</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {lista.data ? `${lista.data.count} cuentas` : "Cuentas de la plataforma"}
        </p>
      </header>

      <div className="mb-space-md flex flex-wrap items-center gap-space-sm">
        <form onSubmit={buscarUsuarios}>
          <input className={`${campo} min-w-56`} placeholder="Buscar por nombre o correo" value={buscar}
            onChange={(event) => setBuscar(event.target.value)} aria-label="Buscar" />
        </form>
        <select className={campo} value={filtros.rol} onChange={(event) => cambiar("rol", event.target.value)} aria-label="Rol">
          <option value="">Todos los roles</option>
          {Object.entries(ROLES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select className={campo} value={filtros.activo} onChange={(event) => cambiar("activo", event.target.value)} aria-label="Estado">
          <option value="">Activos e inactivos</option>
          <option value="true">Solo activos</option>
          <option value="false">Solo inactivos</option>
        </select>
        <select className={campo} value={filtros.sin_activar} onChange={(event) => cambiar("sin_activar", event.target.value)} aria-label="Activación">
          <option value="">Todas las cuentas</option>
          <option value="true">Sin activar (contraseña temporal)</option>
        </select>
      </div>
      {error && <p className="mb-space-md font-body-sm text-body-sm text-error">{error}</p>}

      <section className="min-w-0 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-space-md">
        <Estado cargando={lista.cargando && !lista.data} error={lista.error} vacio={lista.data?.count === 0}>
          <div className="overflow-x-auto">
            <table className={tabla}>
              <thead><tr>
                <th className={th}>Nombre</th><th className={th}>Correo</th><th className={th}>Rol</th>
                <th className={th}>Empresa</th><th className={th}>Estado</th><th className={th}>Alta</th>
                <th className={th}>Último ingreso</th><th className={th}></th>
              </tr></thead>
              <tbody>{(lista.data?.results || []).map((usuario) => (
                <tr key={usuario.id}>
                  <td className={td}>{usuario.rol === "CLIENTE"
                    ? <Link className="text-primary hover:underline" to={`/clientes/${usuario.id}`}>{usuario.nombre}</Link>
                    : usuario.nombre}</td>
                  <td className={td}>{usuario.email}</td>
                  <td className={td}><span className={etiqueta}>{ROLES[usuario.rol] || usuario.rol}</span></td>
                  <td className={td}>{usuario.empresa_nombre || <span className="text-on-surface-variant">—</span>}</td>
                  <td className={td}>
                    <span className={usuario.is_active
                      ? "inline-flex rounded-full bg-secondary-container px-space-sm py-0.5 font-label-sm text-label-sm font-semibold text-on-secondary-container"
                      : "inline-flex rounded-full bg-error-container px-space-sm py-0.5 font-label-sm text-label-sm font-semibold text-on-error-container"}>
                      {usuario.is_active ? "Activo" : "Inactivo"}
                    </span>
                    {usuario.debe_cambiar_password && <span className={`${etiqueta} ml-1`}>Sin activar</span>}
                  </td>
                  <td className={td}>{fecha(usuario.date_joined)}</td>
                  <td className={td}>{hace(usuario.last_login)}</td>
                  <td className={td}>
                    <button type="button" className={boton} onClick={() => alternar(usuario)}>
                      {usuario.is_active ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="mt-space-md flex justify-end gap-space-sm">
            <button type="button" className={boton} disabled={!lista.data?.previous} onClick={() => cambiar("page", String(pagina - 1))}>Anterior</button>
            <span className="self-center text-body-sm text-body-sm text-on-surface-variant">Página {pagina}</span>
            <button type="button" className={boton} disabled={!lista.data?.next} onClick={() => cambiar("page", String(pagina + 1))}>Siguiente</button>
          </div>
        </Estado>
      </section>
    </>
  );
}
