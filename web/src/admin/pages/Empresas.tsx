import { useState, type ChangeEvent, type FormEvent } from "react";
import { api, qs } from "../../api/client";
import { Estado, useApi } from "../components/ui";
import { fecha, TIPOS } from "../format";

interface EmpresaForm {
  nombre: string;
  tipo: string;
  categoria: string;
  email_contacto: string;
  telefono: string;
}
interface EmpresaAdmin {
  id: number;
  nombre: string;
  tipo: string;
  categoria_nombre: string | null;
  piso: string;
  local: string;
  email_contacto: string;
  ficha_completa: boolean;
  activo: boolean;
  creado_en: string;
}
interface CategoriaAdmin { id: number; nombre: string }
interface ListaPaginada<T> { count: number; next: string | null; previous: string | null; results: T[] }
type TipoAccion = "acceso" | "estado";

const NUEVA: EmpresaForm = {
  nombre: "",
  tipo: "NEGOCIO",
  categoria: "",
  email_contacto: "",
  telefono: "",
};
const tarjeta = "mb-space-md min-w-0 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-space-md";
const campo = "min-h-10 min-w-40 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-space-sm py-2 text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary";
const boton = "rounded-lg bg-primary px-space-md py-space-sm font-label-md text-label-md font-semibold text-on-primary transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60";
const botonSecundario = "whitespace-nowrap rounded-lg border border-outline-variant/60 px-space-sm py-1.5 font-label-sm text-label-sm text-primary transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50";
const etiqueta = "inline-flex rounded-full bg-surface-container px-space-sm py-0.5 font-label-sm text-label-sm font-semibold text-on-surface-variant";
const tabla = "w-full border-collapse text-left font-body-sm text-body-sm text-on-surface";
const th = "whitespace-nowrap border-b border-outline-variant/40 px-space-sm py-space-sm font-label-md text-label-md text-on-surface-variant";
const td = "border-b border-outline-variant/30 px-space-sm py-space-sm align-middle";

export default function Empresas() {
  const [tipo, setTipo] = useState("");
  const lista = useApi<ListaPaginada<EmpresaAdmin>>(`/admin/empresas/${qs({ tipo })}`);
  const categorias = useApi<CategoriaAdmin[]>("/categorias/");
  const [form, setForm] = useState<EmpresaForm>(NUEVA);
  const [abierto, setAbierto] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function crear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true);
    setError(null);
    setMsg(null);
    try {
      const body = { ...form, categoria: form.categoria || null };
      const empresa = await api<EmpresaAdmin & { email_contacto: string }>("/admin/empresas/", { method: "POST", body });
      setMsg(`Empresa creada. Enviamos las credenciales a ${empresa.email_contacto}.`);
      setForm(NUEVA);
      setAbierto(false);
      lista.recargar();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo crear la empresa.");
    } finally {
      setEnviando(false);
    }
  }

  async function accion(empresa: EmpresaAdmin, tipoAccion: TipoAccion) {
    setMsg(null);
    setError(null);
    try {
      if (tipoAccion === "acceso") {
        const respuesta = await api<{ email: string }>(`/admin/empresas/${empresa.id}/reenviar-acceso/`, { method: "POST" });
        setMsg(`Nueva contraseña temporal enviada a ${respuesta.email}.`);
      } else {
        await api(`/admin/empresas/${empresa.id}/`, { method: "PATCH", body: { activo: !empresa.activo } });
        lista.recargar();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la empresa.");
    }
  }

  function cambiarCampo(campo: keyof EmpresaForm) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((actual) => ({ ...actual, [campo]: event.target.value }));
    };
  }

  return (
    <>
      <header className="mb-space-md flex flex-wrap items-center justify-between gap-space-md">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Empresas</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Negocios, emprendimientos y oficinas del Paseo</p>
        </div>
        <button type="button" className={boton} onClick={() => setAbierto((actual) => !actual)}>
          {abierto ? "Cancelar" : "Registrar empresa"}
        </button>
      </header>

      {abierto && (
        <form className={tarjeta} onSubmit={crear}>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Nueva empresa</h2>
          <p className="mb-space-md text-body-sm text-on-surface-variant">
            La empresa recibirá por correo su usuario y una contraseña temporal para completar su ficha.
          </p>
          <div className="flex flex-wrap items-center gap-space-sm">
            <input className={campo} placeholder="Nombre" required value={form.nombre} onChange={cambiarCampo("nombre")} aria-label="Nombre" />
            <select className={campo} value={form.tipo} onChange={cambiarCampo("tipo")} aria-label="Tipo">
              {Object.entries(TIPOS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <select className={campo} value={form.categoria} onChange={cambiarCampo("categoria")} aria-label="Categoría">
              <option value="">Sin categoría</option>
              {(categorias.data || []).map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
            </select>
            <input className={campo} type="email" placeholder="Correo del responsable" required
              value={form.email_contacto} onChange={cambiarCampo("email_contacto")} aria-label="Correo" />
            <input className={campo} placeholder="Teléfono (opcional)" value={form.telefono}
              onChange={cambiarCampo("telefono")} aria-label="Teléfono" />
            <button className={boton} disabled={enviando}>{enviando ? "Creando…" : "Crear y enviar acceso"}</button>
          </div>
          {error && <p className="mt-space-sm font-body-sm text-body-sm text-error">{error}</p>}
        </form>
      )}
      {msg && <p className="mb-space-md font-body-sm text-body-sm text-secondary">{msg}</p>}
      {!abierto && error && <p className="mb-space-md font-body-sm text-body-sm text-error">{error}</p>}

      <div className="mb-space-md">
        <select className={campo} value={tipo} onChange={(event) => setTipo(event.target.value)} aria-label="Filtrar por tipo">
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      <section className="min-w-0 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-space-md">
        <Estado cargando={lista.cargando && !lista.data} error={lista.error} vacio={lista.data?.count === 0}>
          <div className="overflow-x-auto">
            <table className={tabla}>
              <thead><tr>
                <th className={th}>Empresa</th><th className={th}>Tipo</th><th className={th}>Categoría</th>
                <th className={th}>Ubicación</th><th className={th}>Correo</th><th className={th}>Ficha</th>
                <th className={th}>Estado</th><th className={th}>Alta</th><th className={th}></th>
              </tr></thead>
              <tbody>{(lista.data?.results || []).map((empresa) => (
                <tr key={empresa.id}>
                  <td className={td}><strong>{empresa.nombre}</strong></td>
                  <td className={td}><span className={etiqueta}>{TIPOS[empresa.tipo] || empresa.tipo}</span></td>
                  <td className={td}>{empresa.categoria_nombre || <span className="text-on-surface-variant">—</span>}</td>
                  <td className={td}>{empresa.piso ? `Piso ${empresa.piso} · ${empresa.local}` : <span className="text-on-surface-variant">Sin completar</span>}</td>
                  <td className={td}>{empresa.email_contacto}</td>
                  <td className={td}>{empresa.ficha_completa
                    ? <span className="inline-flex rounded-full bg-secondary-container px-space-sm py-0.5 font-label-sm text-label-sm font-semibold text-on-secondary-container">Completa</span>
                    : <span className={etiqueta}>Incompleta</span>}</td>
                  <td className={td}><span className={empresa.activo
                    ? "inline-flex rounded-full bg-secondary-container px-space-sm py-0.5 font-label-sm text-label-sm font-semibold text-on-secondary-container"
                    : "inline-flex rounded-full bg-error-container px-space-sm py-0.5 font-label-sm text-label-sm font-semibold text-on-error-container"}>
                    {empresa.activo ? "Activa" : "Inactiva"}
                  </span></td>
                  <td className={td}>{fecha(empresa.creado_en)}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    <div className="flex gap-space-xs">
                      <button className={botonSecundario} onClick={() => accion(empresa, "acceso")}>Reenviar acceso</button>
                      <button className={botonSecundario} onClick={() => accion(empresa, "estado")}>{empresa.activo ? "Desactivar" : "Activar"}</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Estado>
      </section>
    </>
  );
}
