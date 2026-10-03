import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";
import { iniciarLogin, registrarCliente, registrarNegocio, verificarCodigo, type TipoEmpresa } from "../api/auth";
import { listarCategorias, type CategoriaApi } from "../api/categorias";
import { ApiError } from "../api/client";
import { useAuth } from "./AuthContext";

const inputClase = "min-h-[52px] w-full min-w-0 rounded-[5px] border border-[#dedde8] bg-[#f6f6f9] px-4 py-3 text-base text-[#19182d] outline-none transition-colors placeholder:text-[#858397] focus:border-[#091734] focus:bg-white focus:ring-4 focus:ring-[#091734]/10 sm:text-sm";
const labelClase = "relative flex min-w-0 flex-col gap-2 text-xs font-bold text-[#2c2b40]";

function AuthIcon({ name, className = "h-6 w-6 shrink-0" }: { name: "eye" | "eyeOff" | "arrow"; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {name === "eye" && <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" /></>}
      {name === "eyeOff" && <><path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.4A10.6 10.6 0 0 1 12 4c5.5 0 9 6 9 6a14 14 0 0 1-2.1 2.8M6.2 6.2C4.1 7.6 3 10 3 10s3.5 6 9 6c1.2 0 2.3-.3 3.3-.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>}
      {name === "arrow" && <path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

type Paso = "credenciales" | "registro" | "registroCliente" | "codigo";

export function LoginPage() {
  const { setUsuario } = useAuth();
  const reducirMovimiento = useReducedMotion();
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
  const [nombreCliente, setNombreCliente] = useState("");
  const [apellidoCliente, setApellidoCliente] = useState("");
  const [celularCliente, setCelularCliente] = useState("");
  const [ciCliente, setCiCliente] = useState("");
  const [cumpleCliente, setCumpleCliente] = useState("");
  const [passwordCliente, setPasswordCliente] = useState("");
  const [confirmacionCliente, setConfirmacionCliente] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);

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

  async function enviarRegistroCliente(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const resp = await registrarCliente({
        first_name: nombreCliente,
        last_name: apellidoCliente,
        email,
        celular: celularCliente,
        ci: ciCliente,
        ...(cumpleCliente ? { fecha_nacimiento: cumpleCliente } : {}),
        password: passwordCliente,
        password_confirmacion: confirmacionCliente,
        acepta_terminos: true,
      });
      setDesafio(resp.desafio);
      setEmailPendiente(resp.email);
      setPaso("codigo");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la cuenta de cliente.");
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
      setUsuario(usuario);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Código inválido.");
    } finally {
      setCargando(false);
    }
  }

  const whileHover = reducirMovimiento ? undefined : { y: -1 };
  const whileTap = reducirMovimiento ? undefined : { scale: 0.99 };

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducirMovimiento ? 0 : 0.35 }}
      className="grid h-svh min-w-0 overflow-hidden bg-[#f5f6f1] font-sans text-[#19182d] tracking-normal lg:grid-cols-[minmax(300px,0.92fr)_minmax(440px,1.08fr)]"
    >
      <motion.aside
        initial={reducirMovimiento ? false : { opacity: 0, x: -18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reducirMovimiento ? 0 : 0.45, ease: "easeOut" }}
        className="relative hidden min-h-svh flex-col overflow-hidden bg-[#091734] p-8 text-white lg:flex xl:p-12"
        aria-label="Paseo Aranjuez 360"
      >
        {!reducirMovimiento && (
          <video
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
          >
            <source src="/video_dron.mp4" type="video/mp4" />
          </video>
        )}
        <div className="pointer-events-none absolute inset-0 bg-[#091734]/35" aria-hidden="true" />
        <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col items-center justify-center">
          <img src="/logo-paseo-aranjuez.svg" alt="Paseo Aranjuez" className="size-48 object-contain" />
          <div className="w-full max-w-xl text-center">
            <img src="/icon-label.svg" alt="Paseo Aranjuez 360" className="mx-auto -mt-32 h-auto max-h-[340px] w-full max-w-[560px] object-contain invert mix-blend-screen" />
            <p className="mx-auto -mt-20 max-w-md font-body-lg text-base leading-7 text-[#dfdeeb]">Un mundo de experiencias, al alcance de tus manos.</p>
          </div>
        </div>
        <div className="relative z-10 mt-auto flex flex-col items-center gap-1.5 border-t border-white/50 pt-3 text-center font-label-sm text-[0.64rem] font-bold text-[#d2d1e0]"><span>COCHABAMBA · BOLIVIA</span><span>COMUNIDAD PASEO ARANJUEZ</span></div>
      </motion.aside>

      <section className="grid h-full min-h-0 min-w-0 overflow-hidden place-items-center px-4 py-4 sm:px-8 lg:px-16 lg:py-8">
        <motion.div
          initial={reducirMovimiento ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducirMovimiento ? 0 : 0.35, delay: reducirMovimiento ? 0 : 0.08, ease: "easeOut" }}
          className={`min-h-0 max-h-full w-full overflow-y-auto overscroll-contain border border-[#e1e0e9] bg-white p-6 shadow-[0_18px_56px_rgba(9,23,52,0.08)] sm:p-10 ${paso === "registro" || paso === "registroCliente" ? "max-w-[620px]" : "max-w-[520px]"}`}
        >
          <div className="mb-8 flex justify-center lg:hidden">
            <span className="grid size-36 place-items-center bg-[#091734] p-4"><img src="/logo-paseo-aranjuez.svg" alt="Paseo Aranjuez" className="size-full object-contain" /></span>
          </div>
          <header className="mb-7">
            <span className="font-label-sm text-xs font-bold uppercase tracking-[0.08em] text-[#091734]">{paso === "credenciales" ? "Bienvenido de nuevo" : paso === "codigo" ? "Verificación segura" : "Registro"}</span>
            <h1 className="mt-2 font-headline-lg text-[1.85rem] leading-tight font-extrabold text-[#19182d] sm:text-[2.2rem]">{paso === "credenciales" ? "Inicia sesión" : paso === "codigo" ? "Confirma tu acceso" : paso === "registroCliente" ? "Registro" : "Registra tu negocio"}</h1>
            <p className="mt-2 font-body-md text-sm leading-6 text-[#686779]">{paso === "credenciales" ? "Ingresa tus datos para continuar." : paso === "codigo" ? "Un paso más y estarás dentro." : paso === "registroCliente" ? "Crea tu cuenta de cliente en unos minutos." : "Completa los datos de tu establecimiento."}</p>
          </header>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={paso}
              initial={reducirMovimiento ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducirMovimiento ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: reducirMovimiento ? 0 : 0.2, ease: "easeOut" }}
            >
              {paso === "credenciales" && (
                <form onSubmit={enviarCredenciales} className="flex flex-col gap-4">
                  <label className={labelClase}>Correo<input type="email" required autoFocus className={inputClase} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cafearanjuez@paseo.bo" autoComplete="username" /></label>
                  <label className={labelClase}>
                    Contraseña
                    <input type={mostrarPassword ? "text" : "password"} required className={`${inputClase} pr-12`} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                    <button type="button" className="absolute right-2 bottom-[0.45rem] grid size-10 place-items-center text-[#686779] hover:text-[#091734]" aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setMostrarPassword((visible) => !visible)}><AuthIcon name={mostrarPassword ? "eyeOff" : "eye"} className="h-5 w-5" /></button>
                  </label>
                  {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="alert" className="border-l-[3px] border-[#ae352b] bg-[#fff1ed] px-3 py-2.5 text-[0.82rem] leading-5 text-[#842b24]">{error}</motion.p>}
                  <motion.button type="submit" disabled={cargando} whileHover={whileHover} whileTap={whileTap} className="mt-1 flex min-h-[54px] items-center justify-center gap-4 bg-[#091734] px-4 py-3 text-center font-headline-sm text-[0.92rem] font-bold text-white transition-colors hover:bg-[#050d20] disabled:cursor-wait disabled:opacity-65">
                    {cargando ? "Enviando..." : "Iniciar sesión"}
                  </motion.button>
                  <p className="mt-1 text-center text-[0.82rem] text-[#686779]">¿Aún no tienes cuenta? <button type="button" className="font-bold text-[#091734] hover:underline" onClick={() => { setError(null); setPaso("registroCliente"); }}>Regístrate como cliente</button></p>
                  <button type="button" className="self-center text-[0.8rem] font-bold text-[#686779] hover:text-[#091734] hover:underline" onClick={() => { setError(null); setPaso("registro"); }}>¿Tienes un local? Registra tu negocio</button>
                </form>
              )}

              {paso === "registro" && (
                <form onSubmit={enviarRegistro} className="flex flex-col gap-4">
                  <p className="text-sm leading-6 text-[#686779]">Crea tu cuenta y empieza a vender en PaseoYa sin esperar aprobación.</p>
                  <div className="flex flex-col gap-2">
                    <span className={labelClase}>¿Qué eres dentro de Paseo Aranjuez?</span>
                    <div className="flex flex-col gap-2">
                      <label className={`flex cursor-pointer items-start gap-3 rounded-[5px] border px-3 py-3 transition-colors ${tipo === "NEGOCIO" ? "border-[#091734] bg-[#f0eff8]" : "border-[#dedde8]"}`}>
                        <input type="radio" name="tipo" className="mt-1 accent-[#091734]" checked={tipo === "NEGOCIO"} onChange={() => setTipo("NEGOCIO")} />
                        <span className="flex flex-col"><strong className="text-sm text-[#19182d]">Negocio establecido</strong><span className="mt-1 text-xs leading-5 text-[#686779]">Tienda o local fijo dentro de Paseo Aranjuez.</span></span>
                      </label>
                      <label className={`flex cursor-pointer items-start gap-3 rounded-[5px] border px-3 py-3 transition-colors ${tipo === "EMPRENDIMIENTO" ? "border-[#091734] bg-[#f0eff8]" : "border-[#dedde8]"}`}>
                        <input type="radio" name="tipo" className="mt-1 accent-[#091734]" checked={tipo === "EMPRENDIMIENTO"} onChange={() => setTipo("EMPRENDIMIENTO")} />
                        <span className="flex flex-col"><strong className="text-sm text-[#19182d]">Emprendimiento momentáneo</strong><span className="mt-1 text-xs leading-5 text-[#686779]">Vienes temporalmente a ofrecer tus productos.</span></span>
                      </label>
                    </div>
                  </div>
                  <label className={labelClase}>Nombre del negocio/emprendimiento<input required className={inputClase} value={nombreEmpresa} onChange={(e) => setNombreEmpresa(e.target.value)} placeholder="Ej. Helados Express" /></label>
                  <label className={labelClase}>Categoría<select required className={inputClase} value={categoriaId} onChange={(e) => setCategoriaId(Number(e.target.value))}><option value="" disabled>Elige una categoría</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
                  <label className={labelClase}>Correo<input type="email" required className={inputClase} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
                  <label className={labelClase}>Teléfono (opcional)<input className={inputClase} value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" /></label>
                  <label className={labelClase}>Contraseña<input type={mostrarPassword ? "text" : "password"} required className={`${inputClase} pr-12`} value={passwordReg} onChange={(e) => setPasswordReg(e.target.value)} autoComplete="new-password" /><button type="button" className="absolute right-2 bottom-[0.45rem] grid size-10 place-items-center text-[#686779] hover:text-[#091734]" aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setMostrarPassword((visible) => !visible)}><AuthIcon name={mostrarPassword ? "eyeOff" : "eye"} className="h-5 w-5" /></button></label>
                  <label className={labelClase}>Confirmar contraseña<input type={mostrarPassword ? "text" : "password"} required className={`${inputClase} pr-12`} value={passwordConfirmacion} onChange={(e) => setPasswordConfirmacion(e.target.value)} autoComplete="new-password" /><button type="button" className="absolute right-2 bottom-[0.45rem] grid size-10 place-items-center text-[#686779] hover:text-[#091734]" aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setMostrarPassword((visible) => !visible)}><AuthIcon name={mostrarPassword ? "eyeOff" : "eye"} className="h-5 w-5" /></button></label>
                  {error && <p role="alert" className="border-l-[3px] border-[#ae352b] bg-[#fff1ed] px-3 py-2.5 text-[0.82rem] leading-5 text-[#842b24]">{error}</p>}
                  <motion.button type="submit" disabled={cargando} whileHover={whileHover} whileTap={whileTap} className="flex min-h-[54px] items-center justify-between gap-4 bg-[#091734] px-4 py-3 font-headline-sm text-[0.92rem] font-bold text-white transition-colors hover:bg-[#050d20] disabled:cursor-wait disabled:opacity-65">{cargando ? "Creando cuenta..." : "Crear cuenta"}<AuthIcon name="arrow" className="h-5 w-5 text-[#f4c95d]" /></motion.button>
                  <button type="button" className="self-center text-[0.8rem] font-bold text-[#686779] hover:text-[#091734] hover:underline" onClick={() => { setError(null); setPaso("credenciales"); }}>Ya tengo cuenta — volver</button>
                </form>
              )}

              {paso === "registroCliente" && (
                <form onSubmit={enviarRegistroCliente} className="flex flex-col gap-4">
                  <div className="grid gap-3 sm:grid-cols-2"><label className={labelClase}>Nombre<input required maxLength={60} className={inputClase} value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} autoComplete="given-name" /></label><label className={labelClase}>Apellido<input required maxLength={60} className={inputClase} value={apellidoCliente} onChange={(e) => setApellidoCliente(e.target.value)} autoComplete="family-name" /></label></div>
                  <label className={labelClase}>Correo<input type="email" required className={inputClase} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
                  <div className="grid gap-3 sm:grid-cols-2"><label className={labelClase}>Celular boliviano<input type="tel" required pattern="(\\+591)?[67][0-9]{7}" title="8 dígitos, empieza con 6 o 7" className={inputClase} value={celularCliente} onChange={(e) => setCelularCliente(e.target.value)} placeholder="71234567" autoComplete="tel" /></label><label className={labelClase}>Carnet de identidad<input required pattern="[0-9]{5,10}(-[0-9A-Za-z]{1,2})?" title="5 a 10 dígitos; complemento opcional" className={inputClase} value={ciCliente} onChange={(e) => setCiCliente(e.target.value)} /></label></div>
                  <label className={labelClase}>Fecha de cumpleaños <span className="font-normal text-[#686779]">(opcional)</span><input type="date" className={inputClase} value={cumpleCliente} onChange={(e) => setCumpleCliente(e.target.value)} /></label>
                  <label className={labelClase}>Contraseña<input type={mostrarPassword ? "text" : "password"} required minLength={8} className={`${inputClase} pr-12`} value={passwordCliente} onChange={(e) => setPasswordCliente(e.target.value)} autoComplete="new-password" /><button type="button" className="absolute right-2 bottom-[0.45rem] grid size-10 place-items-center text-[#686779] hover:text-[#091734]" aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setMostrarPassword((visible) => !visible)}><AuthIcon name={mostrarPassword ? "eyeOff" : "eye"} className="h-5 w-5" /></button></label>
                  <label className={labelClase}>Repetir contraseña<input type={mostrarPassword ? "text" : "password"} required minLength={8} className={`${inputClase} pr-12`} value={confirmacionCliente} onChange={(e) => setConfirmacionCliente(e.target.value)} autoComplete="new-password" /><button type="button" className="absolute right-2 bottom-[0.45rem] grid size-10 place-items-center text-[#686779] hover:text-[#091734]" aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setMostrarPassword((visible) => !visible)}><AuthIcon name={mostrarPassword ? "eyeOff" : "eye"} className="h-5 w-5" /></button></label>
                  <label className="flex items-start gap-3 text-xs leading-5 text-[#686779]"><input type="checkbox" required className="mt-1 h-4 w-4 accent-[#091734]" /><span>Acepto los términos y condiciones de PaseoYa.</span></label>
                  {error && <p role="alert" className="border-l-[3px] border-[#ae352b] bg-[#fff1ed] px-3 py-2.5 text-[0.82rem] leading-5 text-[#842b24]">{error}</p>}
                  <motion.button type="submit" disabled={cargando} whileHover={whileHover} whileTap={whileTap} className="flex min-h-[54px] items-center justify-center gap-4 bg-[#091734] px-4 py-3 text-center font-headline-sm text-[0.92rem] font-bold text-white transition-colors hover:bg-[#050d20] disabled:cursor-wait disabled:opacity-65">{cargando ? "Creando cuenta…" : "Crear cuenta"}</motion.button>
                  <button type="button" className="self-center text-[0.8rem] font-bold text-[#686779] hover:text-[#091734] hover:underline" onClick={() => { setError(null); setPaso("credenciales"); }}>Ya tengo cuenta — volver</button>
                </form>
              )}

              {paso === "codigo" && (
                <form onSubmit={enviarCodigo} className="flex flex-col gap-4">
                  <p className="border-l-[3px] border-[#f4c95d] bg-[#f7f7ee] px-4 py-3 text-sm leading-6 text-[#686779]">Enviamos un código de 6 dígitos a <strong>{emailPendiente}</strong>. En desarrollo se imprime en la consola del servidor backend (no llega un correo real).</p>
                  <label className={labelClase}>Código<input required autoFocus maxLength={6} className={`${inputClase} h-[62px] text-center font-headline-md text-2xl font-extrabold`} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
                  {error && <p role="alert" className="border-l-[3px] border-[#ae352b] bg-[#fff1ed] px-3 py-2.5 text-[0.82rem] leading-5 text-[#842b24]">{error}</p>}
                  <motion.button type="submit" disabled={cargando} whileHover={whileHover} whileTap={whileTap} className="flex min-h-[54px] items-center justify-between gap-4 bg-[#091734] px-4 py-3 font-headline-sm text-[0.92rem] font-bold text-white transition-colors hover:bg-[#050d20] disabled:cursor-wait disabled:opacity-65">{cargando ? "Verificando..." : "Verificar e ingresar"}<AuthIcon name="arrow" className="h-5 w-5 text-[#f4c95d]" /></motion.button>
                  <button type="button" className="self-center text-[0.8rem] font-bold text-[#686779] hover:text-[#091734] hover:underline" onClick={() => { setError(null); setPaso("credenciales"); }}>Volver</button>
                </form>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </section>
    </motion.main>
  );
}
