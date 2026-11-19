import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api, SorteoApiError } from "../api";
import { Alerta, Aviso, Ayuda, Marco, botonClase, inputClase, labelClase } from "../components/Marco";
import { SelectorPais } from "../components/SelectorPais";
import { enlaceSeguro } from "../formato";
import { BOLIVIA, ayudaCelular, celularConCodigo } from "../paises";
import { desafioPendiente, sesionTarjeta } from "../sesion";
import type { Canal, CampaniaPublica } from "../tipos";
import { errorCelular, errorCorreo, errorNombre, soloCelular } from "../validacion";

export function RegistroPage() {
  const navegar = useNavigate();
  const [campania, setCampania] = useState<CampaniaPublica | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [form, setForm] = useState({ nombres: "", apellidos: "", correo: "", celular: "" });
  const [pais, setPais] = useState<string>(BOLIVIA);
  const [canal, setCanal] = useState<Canal>("CORREO");
  const [terminos, setTerminos] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [yaTiene, setYaTiene] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const enCurso = useRef(false); // frena el doble toque: el estado se actualiza tarde y dejaría pasar una segunda petición

  useEffect(() => {
    let vigente = true;
    api
      .campania()
      .then((c) => {
        if (!vigente) return;
        setCampania(c);
        setErrorCarga(null);
      })
      .catch((err) => {
        if (vigente) setErrorCarga(err instanceof SorteoApiError ? err.message : "No se pudo cargar el sorteo.");
      });
    return () => {
      vigente = false;
    };
  }, [intento]);

  if (sesionTarjeta.obtener()) return <Navigate to="/tarjeta/mi" replace />;

  // Si la información del sorteo no carga, el formulario sigue disponible: solo se pierde el aviso de canales.
  const canales = campania?.canales ?? ["CORREO"];
  const urlTerminos = enlaceSeguro(campania?.terminos_url);
  /** Guarda el valor y quita el error de ese campo: se vuelve a revisar al salir de él o al enviar. */
  function cambiar(k: keyof typeof form, valor: string) {
    setForm((f) => ({ ...f, [k]: valor }));
    setErrores((e) => (e[k] ? { ...e, [k]: "" } : e));
  }
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => cambiar(k, e.target.value);

  function revisar(k: keyof typeof form): string | null {
    if (k === "correo") return errorCorreo(form.correo);
    if (k === "celular") return errorCelular(pais, form.celular);
    return errorNombre(form[k]);
  }
  /** Al salir de un campo ya escrito, dice qué le falta sin esperar al envío. */
  const alSalir = (k: keyof typeof form) => () => {
    if (form[k].trim()) setErrores((e) => ({ ...e, [k]: revisar(k) ?? "" }));
  };

  function cambiarPais(nuevo: string) {
    setPais(nuevo);
    cambiar("celular", soloCelular(nuevo, form.celular));
  }

  function reintentarCarga() {
    setErrorCarga(null);
    setIntento((n) => n + 1);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enCurso.current) return;
    setError(null);
    setYaTiene(false);
    // Primero en la página: se dice qué falta sin ir al servidor.
    const locales: Record<string, string> = {};
    for (const k of ["nombres", "apellidos", "correo", "celular"] as const) {
      const falta = revisar(k);
      if (falta) locales[k] = falta;
    }
    if (!terminos) locales.acepta_terminos = "Debes aceptar los términos y condiciones.";
    setErrores(locales);
    if (Object.keys(locales).length) return;
    enCurso.current = true;
    setEnviando(true);
    try {
      const d = await api.registro({ ...form, celular: celularConCodigo(pais, form.celular), canal, acepta_terminos: terminos });
      desafioPendiente.guardar(d);
      navegar("/tarjeta/verificar");
    } catch (err) {
      if (err instanceof SorteoApiError) {
        setErrores(err.campos);
        setError(Object.keys(err.campos).length ? null : err.message);
        setYaTiene(err.codigo === "contacto_registrado");
      } else setError("No se pudo crear tu tarjeta. Prueba de nuevo.");
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  }

  const campo = (k: string) => errores[k] && <small className="text-error">{errores[k]}</small>;
  const celular = ayudaCelular(pais);

  return (
    <Marco
      titulo="Tu tarjeta del Sorteo Paseo"
      subtitulo={
        campania?.activa && campania.bs_por_punto
          ? `Cada Bs ${Number(campania.bs_por_punto)} en compras = 1 punto para el sorteo.`
          : "Crea tu tarjeta y guárdala en tu celular."
      }
    >
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        {errorCarga && (
          <div className="flex flex-col gap-2">
            <Aviso>{errorCarga} Puedes seguir.</Aviso>
            <button type="button" onClick={reintentarCarga} className="self-start font-semibold text-secondary underline">
              Reintentar
            </button>
          </div>
        )}
        <label className={labelClase}>
          Nombres
          <input className={inputClase} value={form.nombres} onChange={set("nombres")} onBlur={alSalir("nombres")} autoComplete="given-name" aria-describedby="ayuda-nombres" required />
          <Ayuda id="ayuda-nombres">Como en tu carnet.</Ayuda>
          {campo("nombres")}
        </label>
        <label className={labelClase}>
          Apellidos
          <input className={inputClase} value={form.apellidos} onChange={set("apellidos")} onBlur={alSalir("apellidos")} autoComplete="family-name" required />
          {campo("apellidos")}
        </label>
        <label className={labelClase}>
          Correo
          <input
            className={inputClase}
            type="email"
            placeholder="tunombre@gmail.com"
            value={form.correo}
            onChange={set("correo")}
            onBlur={alSalir("correo")}
            autoComplete="email"
            required
          />
          {campo("correo")}
        </label>

        <div className={labelClase}>
          <label htmlFor="celular">Celular</label>
          <div className="flex gap-2">
            <SelectorPais valor={pais} onCambio={cambiarPais} />
            <input
              id="celular"
              className={`${inputClase} min-w-0 flex-1`}
              type="tel"
              inputMode={pais === "" ? "tel" : "numeric"}
              placeholder={celular.ejemplo}
              value={form.celular}
              onChange={(e) => cambiar("celular", soloCelular(pais, e.target.value))}
              onBlur={alSalir("celular")}
              autoComplete="tel-national"
              aria-describedby="ayuda-celular"
              required
            />
          </div>
          <Ayuda id="ayuda-celular">{celular.ayuda}</Ayuda>
          {campo("celular")}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-label-md text-label-md font-semibold text-on-surface">¿Dónde te enviamos tu código?</legend>
          {canales.map((c) => (
            <label
              key={c}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3"
            >
              <input type="radio" name="canal" checked={canal === c} onChange={() => setCanal(c)} />
              <span>{c === "CORREO" ? "A mi correo" : "A mi celular"}</span>
            </label>
          ))}
          <Ayuda id="ayuda-canal">
            {canales.length === 1 ? "Por ahora, solo por correo. " : ""}
            Con ese dato podrás recuperar tu tarjeta.
          </Ayuda>
          {campo("canal")}
        </fieldset>

        <label className="flex items-start gap-3 text-on-surface-variant">
          <input type="checkbox" className="mt-1" checked={terminos} onChange={(e) => setTerminos(e.target.checked)} />
          <span>
            Acepto los{" "}
            {urlTerminos ? (
              <a href={urlTerminos} target="_blank" rel="noopener noreferrer" className="font-semibold text-secondary underline">
                términos y condiciones
              </a>
            ) : (
              "términos y condiciones"
            )}
            .
          </span>
        </label>
        {campo("acepta_terminos")}

        {error && (
          <Alerta>
            {error}
            {yaTiene && (
              <>
                {" "}
                <Link to="/tarjeta/recuperar" className="font-semibold underline">
                  Entrar
                </Link>
              </>
            )}
          </Alerta>
        )}
        <button type="submit" disabled={enviando} className={botonClase}>
          {enviando ? "Enviando código…" : "Crear mi tarjeta"}
        </button>
        <p className="text-center text-on-surface-variant">
          ¿Ya tienes tarjeta?{" "}
          <Link to="/tarjeta/recuperar" className="font-semibold text-secondary underline">
            Entrar
          </Link>
        </p>
      </form>
    </Marco>
  );
}
