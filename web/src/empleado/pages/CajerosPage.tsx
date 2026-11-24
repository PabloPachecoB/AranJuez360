import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import { alternarCajeroActivo, crearCajero, listarCajeros, type CajeroApi } from "../api/cajeros";
import { Switch } from "../components/Switch";

const inputClase =
  "w-full h-12 px-4 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary transition-all";
const labelClase = "font-label-md text-label-md text-on-surface font-semibold";

/** Issue #18: la empresa crea y desactiva sus cajeros sin pasar por el admin de Django. */
export function CajerosPage() {
  const [cajeros, setCajeros] = useState<CajeroApi[] | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "" });
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creado, setCreado] = useState<string | null>(null);

  function cargar() {
    listarCajeros().then(setCajeros);
  }

  useEffect(cargar, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setCreando(true);
    setError(null);
    setCreado(null);
    try {
      const nuevo = await crearCajero(form);
      setForm({ first_name: "", last_name: "", email: "" });
      setCreado(`Se le envió el acceso a ${nuevo.email}.`);
      cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el cajero.");
    } finally {
      setCreando(false);
    }
  }

  async function alternar(cajero: CajeroApi, activo: boolean) {
    try {
      await alternarCajeroActivo(cajero.id, activo);
      cargar();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "No se pudo cambiar el estado.");
    }
  }

  return (
    <div className="flex flex-col w-full gap-space-lg max-w-3xl">
      <div className="flex flex-col gap-1">
        <span className="font-badge-code text-badge-code uppercase tracking-wider text-secondary px-2 py-0.5 rounded-full bg-secondary-container/40 w-fit">
          Gestión de Local
        </span>
        <h1 className="font-display text-display text-on-surface tracking-tight">Cajeros</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
          Crea cuentas para tu personal de caja. Cada uno recibe su acceso por correo — nadie necesita
          pasar por el administrador del Paseo.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md"
      >
        <h3 className="font-headline-sm text-headline-sm text-on-surface">Agregar cajero</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
          <div className="flex flex-col gap-1.5">
            <label className={labelClase}>Nombres</label>
            <input
              required
              className={inputClase}
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClase}>Apellidos</label>
            <input
              required
              className={inputClase}
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClase}>Correo</label>
            <input
              type="email"
              required
              className={inputClase}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>
        {error && (
          <p className="font-body-sm text-body-sm text-error bg-error-container/40 rounded-lg px-space-md py-2">
            {error}
          </p>
        )}
        {creado && (
          <p className="font-body-sm text-body-sm text-secondary bg-secondary-container/40 rounded-lg px-space-md py-2">
            {creado}
          </p>
        )}
        <button
          type="submit"
          disabled={creando}
          className="self-end px-space-xl py-3 bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm rounded-lg shadow-md active:scale-95 transition-all disabled:opacity-60"
        >
          {creando ? "Creando..." : "Crear cajero"}
        </button>
      </form>

      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
        <div className="p-space-md bg-surface-container-low">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Tu equipo de caja</h3>
        </div>
        {cajeros === null ? (
          <p className="p-space-md font-body-md text-body-md text-on-surface-variant">Cargando...</p>
        ) : cajeros.length === 0 ? (
          <p className="p-space-md font-body-md text-body-md text-on-surface-variant">
            Todavía no tienes cajeros registrados.
          </p>
        ) : (
          <div className="divide-y divide-surface-container-high">
            {cajeros.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-space-md">
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    {c.first_name} {c.last_name}
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">{c.email}</span>
                </div>
                <div className="flex items-center gap-space-sm">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {c.is_active ? "Activo" : "Desactivado"}
                  </span>
                  <Switch checked={c.is_active} onChange={(activo) => alternar(c, activo)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
