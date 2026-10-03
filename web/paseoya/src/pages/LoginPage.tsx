import { useEffect, useState, type FormEvent } from "react";
import { iniciarLogin, registrarNegocio, verificarCodigo, type TipoEmpresa } from "../api/auth";
import { listarCategorias, type CategoriaApi } from "../api/categorias";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

const inputClase =
  "h-12 px-4 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all";
const labelClase = "flex flex-col gap-1.5 font-label-md text-label-md text-on-surface font-semibold";

type Paso = "credenciales" | "registro" | "codigo";

export function LoginPage() {
  const { setUsuario } = useAuth();
  const [paso, setPaso] = useState<Paso>("credenciales");

  // Login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Registro
  const [categorias, setCategorias] = useState<CategoriaApi[]>([]);
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [tipo, setTipo] = useState<TipoEmpresa>("NEGOCIO");
  const [categoriaId, setCategoriaId] = useState<number | "">("");
  const [telefono, setTelefono] = useState("");
  const [passwordReg, setPasswordReg] = useState("");
  const [passwordConfirmacion, setPasswordConfirmacion] = useState("");

  // Código (compartido por login y registro)
  const [emailPendiente, setEmailPendiente] = useState("");
  const [desafio, setDesafio] = useState("");
  const [codigo, setCodigo] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (paso === "registro" && categorias.length === 0) {
      listarCategorias()
        .then(setCategorias)
        .catch(() => setError("No se pudieron cargar las categorías."));
    }
  }, [paso, categorias.length]);

  async function enviarCredenciales(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const resp = await iniciarLogin(email, password);
      setDesafio(resp.desafio);
      setEmailPendiente(resp.email);
      setPaso("codigo");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setCargando(false);
    }
  }

  async function enviarRegistro(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (categoriaId === "") {
      setError("Elige una categoría.");
      return;
    }
    setCargando(true);
    try {
      const resp = await registrarNegocio({
        nombre: nombreEmpresa,
        tipo,
        categoria: categoriaId,
        email,
        telefono,
        password: passwordReg,
        password_confirmacion: passwordConfirmacion,
      });
      setDesafio(resp.desafio);
      setEmailPendiente(resp.email);
      setPaso("codigo");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la cuenta.");
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
    <div className="min-h-screen flex items-center justify-center bg-background px-space-md py-space-lg">
      <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-lg p-space-lg flex flex-col gap-space-md">
        <div className="flex flex-col items-center gap-1 mb-space-sm">
          <span className="material-symbols-outlined text-primary text-[32px]">storefront</span>
          <h1 className="font-headline-lg text-headline-lg text-primary">PaseoYa</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Portal Locatarios</p>
        </div>

        {paso === "credenciales" && (
          <form onSubmit={enviarCredenciales} className="flex flex-col gap-space-md">
            <label className={labelClase}>
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
            <label className={labelClase}>
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
            <button
              type="button"
              className="font-label-md text-label-md text-on-surface-variant hover:underline text-center"
              onClick={() => {
                setError(null);
                setPaso("registro");
              }}
            >
              ¿Nuevo en Paseo Aranjuez? Crea tu cuenta
            </button>
          </form>
        )}

        {paso === "registro" && (
          <form onSubmit={enviarRegistro} className="flex flex-col gap-space-md">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Crea tu cuenta y empieza a vender en PaseoYa sin esperar aprobación.
            </p>

            <div className="flex flex-col gap-1.5">
              <span className={labelClase}>¿Qué eres dentro de Paseo Aranjuez?</span>
              <div className="flex flex-col gap-2">
                <label
                  className={`flex items-start gap-2 p-space-sm rounded-lg border-2 cursor-pointer transition-colors ${
                    tipo === "NEGOCIO" ? "border-primary bg-primary-fixed/20" : "border-surface-container-high"
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo"
                    className="mt-1"
                    checked={tipo === "NEGOCIO"}
                    onChange={() => setTipo("NEGOCIO")}
                  />
                  <span className="flex flex-col">
                    <span className="font-label-md text-label-md font-bold text-on-surface">
                      Negocio establecido
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Tienda o local fijo dentro de Paseo Aranjuez.
                    </span>
                  </span>
                </label>
                <label
                  className={`flex items-start gap-2 p-space-sm rounded-lg border-2 cursor-pointer transition-colors ${
                    tipo === "EMPRENDIMIENTO" ? "border-primary bg-primary-fixed/20" : "border-surface-container-high"
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo"
                    className="mt-1"
                    checked={tipo === "EMPRENDIMIENTO"}
                    onChange={() => setTipo("EMPRENDIMIENTO")}
                  />
                  <span className="flex flex-col">
                    <span className="font-label-md text-label-md font-bold text-on-surface">
                      Emprendimiento momentáneo
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Vienes temporalmente a ofrecer tus productos.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <label className={labelClase}>
              Nombre del negocio/emprendimiento
              <input
                required
                className={inputClase}
                value={nombreEmpresa}
                onChange={(e) => setNombreEmpresa(e.target.value)}
                placeholder="Ej. Helados Express"
              />
            </label>

            <label className={labelClase}>
              Categoría
              <select
                required
                className={inputClase}
                value={categoriaId}
                onChange={(e) => setCategoriaId(Number(e.target.value))}
              >
                <option value="" disabled>
                  Elige una categoría
                </option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClase}>
              Correo
              <input
                type="email"
                required
                className={inputClase}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className={labelClase}>
              Teléfono (opcional)
              <input className={inputClase} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </label>

            <label className={labelClase}>
              Contraseña
              <input
                type="password"
                required
                className={inputClase}
                value={passwordReg}
                onChange={(e) => setPasswordReg(e.target.value)}
              />
            </label>
            <label className={labelClase}>
              Confirmar contraseña
              <input
                type="password"
                required
                className={inputClase}
                value={passwordConfirmacion}
                onChange={(e) => setPasswordConfirmacion(e.target.value)}
              />
            </label>

            {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
            <button
              type="submit"
              disabled={cargando}
              className="h-12 rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm disabled:opacity-60"
            >
              {cargando ? "Creando cuenta..." : "Crear cuenta"}
            </button>
            <button
              type="button"
              className="font-label-md text-label-md text-on-surface-variant hover:underline text-center"
              onClick={() => {
                setError(null);
                setPaso("credenciales");
              }}
            >
              Ya tengo cuenta — volver
            </button>
          </form>
        )}

        {paso === "codigo" && (
          <form onSubmit={enviarCodigo} className="flex flex-col gap-space-md">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Enviamos un código de 6 dígitos a <strong>{emailPendiente}</strong>. En desarrollo se imprime
              en la consola del servidor backend (no llega un correo real).
            </p>
            <label className={labelClase}>
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
              onClick={() => {
                setError(null);
                setPaso("credenciales");
              }}
            >
              Volver
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
