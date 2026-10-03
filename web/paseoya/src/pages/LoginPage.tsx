import { useState, type FormEvent } from "react";
import { iniciarLogin, verificarCodigo } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

const inputClase =
  "h-12 px-4 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all";

export function LoginPage() {
  const { setUsuario } = useAuth();
  const [paso, setPaso] = useState<"credenciales" | "codigo">("credenciales");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [desafio, setDesafio] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviarCredenciales(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const resp = await iniciarLogin(email, password);
      setDesafio(resp.desafio);
      setPaso("codigo");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setCargando(false);
    }
  }

  async function enviarCodigo(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const usuario = await verificarCodigo(desafio, codigo);
      if (usuario.rol !== "NEGOCIO") {
        setError("Esta cuenta no administra un negocio. El panel es solo para locatarios.");
        return;
      }
      setUsuario(usuario);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Código inválido.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-space-md">
      <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-lg p-space-lg flex flex-col gap-space-md">
        <div className="flex flex-col items-center gap-1 mb-space-sm">
          <span className="material-symbols-outlined text-primary text-[32px]">storefront</span>
          <h1 className="font-headline-lg text-headline-lg text-primary">PaseoYa</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Portal Locatarios</p>
        </div>

        {paso === "credenciales" ? (
          <form onSubmit={enviarCredenciales} className="flex flex-col gap-space-md">
            <label className="flex flex-col gap-1.5 font-label-md text-label-md text-on-surface font-semibold">
              Correo
              <input
                type="email"
                required
                autoFocus
                className={inputClase}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cafearanjuez@paseo.bo"
              />
            </label>
            <label className="flex flex-col gap-1.5 font-label-md text-label-md text-on-surface font-semibold">
              Contraseña
              <input
                type="password"
                required
                className={inputClase}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
            <button
              type="submit"
              disabled={cargando}
              className="h-12 rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm disabled:opacity-60"
            >
              {cargando ? "Enviando..." : "Continuar"}
            </button>
          </form>
        ) : (
          <form onSubmit={enviarCodigo} className="flex flex-col gap-space-md">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Enviamos un código de 6 dígitos a <strong>{email}</strong>. En desarrollo se imprime en la
              consola del servidor backend (no llega un correo real).
            </p>
            <label className="flex flex-col gap-1.5 font-label-md text-label-md text-on-surface font-semibold">
              Código
              <input
                required
                autoFocus
                maxLength={6}
                className={`${inputClase} font-headline-sm text-headline-sm tracking-[0.3em] text-center`}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
            </label>
            {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
            <button
              type="submit"
              disabled={cargando}
              className="h-12 rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm disabled:opacity-60"
            >
              {cargando ? "Verificando..." : "Ingresar"}
            </button>
            <button
              type="button"
              className="font-label-md text-label-md text-on-surface-variant hover:underline"
              onClick={() => setPaso("credenciales")}
            >
              Volver
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
