import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { MedioVerificacion, RegistroForm } from "./tipos";

const inputClase =
  "h-12 px-4 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all";
const labelClase = "flex flex-col gap-1.5 font-label-md text-label-md text-on-surface font-semibold";

const FORM_VACIO: RegistroForm = {
  nombres: "",
  apellidos: "",
  correo: "",
  celular: "",
  verificar_con: "correo",
};

/**
 * Registro público del Sorteo Paseo (cuenta de fidelización, no cuenta de sesión).
 * Todavía no hay endpoint real (ver docs/FIDELIZACION_EQUIPO.md) — simula el envío
 * y manda al cliente a su tarjeta con un código de ejemplo.
 */
export function RegistroPage() {
  const navegar = useNavigate();
  const [form, setForm] = useState<RegistroForm>(FORM_VACIO);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const set = (campo: keyof RegistroForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }));

  const elegirVerificacion = (medio: MedioVerificacion) => setForm((f) => ({ ...f, verificar_con: medio }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.verificar_con === "correo" && !form.correo) {
      setError("Escribe tu correo para verificarte con él.");
      return;
    }
    if (form.verificar_con === "celular" && !form.celular) {
      setError("Escribe tu celular para verificarte con él.");
      return;
    }
    setEnviando(true);
    // SIMULADO: aquí va la llamada real cuando exista POST /api/v1/sorteo-paseo/registro/
    await new Promise((resolve) => setTimeout(resolve, 600));
    setEnviando(false);
    navegar("/fidelizacion/mi-tarjeta/PA-7K3M9X");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-space-md py-space-lg">
      <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-lg p-space-lg flex flex-col gap-space-md">
        <div className="flex flex-col items-center gap-1 mb-space-sm text-center">
          <img src="/logo-360.svg" alt="Paseo Aranjuez 360" className="w-56 max-w-full" />
          <h1 className="font-headline-sm text-headline-sm text-primary">Sorteo Paseo</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Crea tu tarjeta de fidelización. Cada Bs 200 en compras validadas es 1 punto y 1 participación
            en el sorteo.
          </p>
        </div>

        <form onSubmit={enviar} className="flex flex-col gap-space-md">
          <label className={labelClase}>
            Nombres
            <input required className={inputClase} value={form.nombres} onChange={set("nombres")} />
          </label>
          <label className={labelClase}>
            Apellidos
            <input required className={inputClase} value={form.apellidos} onChange={set("apellidos")} />
          </label>
          <label className={labelClase}>
            Correo
            <input type="email" className={inputClase} value={form.correo} onChange={set("correo")} />
          </label>
          <label className={labelClase}>
            Celular
            <input className={inputClase} value={form.celular} onChange={set("celular")} />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className={labelClase}>¿Con cuál te verificamos?</span>
            <div className="flex gap-2">
              <label
                className={`flex-1 flex items-center justify-center gap-2 p-space-sm rounded-lg border-2 cursor-pointer transition-colors ${
                  form.verificar_con === "correo" ? "border-primary bg-primary-fixed/20" : "border-surface-container-high"
                }`}
              >
                <input
                  type="radio"
                  name="verificar_con"
                  checked={form.verificar_con === "correo"}
                  onChange={() => elegirVerificacion("correo")}
                />
                <span className="font-label-md text-label-md text-on-surface">Correo</span>
              </label>
              <label
                className={`flex-1 flex items-center justify-center gap-2 p-space-sm rounded-lg border-2 cursor-pointer transition-colors ${
                  form.verificar_con === "celular" ? "border-primary bg-primary-fixed/20" : "border-surface-container-high"
                }`}
              >
                <input
                  type="radio"
                  name="verificar_con"
                  checked={form.verificar_con === "celular"}
                  onChange={() => elegirVerificacion("celular")}
                />
                <span className="font-label-md text-label-md text-on-surface">Celular</span>
              </label>
            </div>
          </div>

          {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
          <button
            type="submit"
            disabled={enviando}
            className="h-12 rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm disabled:opacity-60"
          >
            {enviando ? "Creando..." : "Crear mi tarjeta"}
          </button>
          <Link
            to="/"
            className="font-label-md text-label-md text-on-surface-variant hover:underline text-center"
          >
            Volver
          </Link>
        </form>
      </div>
    </div>
  );
}
