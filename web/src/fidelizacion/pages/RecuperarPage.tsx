import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, SorteoApiError } from "../api";
import { Alerta, Aviso, Ayuda, Marco, botonClase, inputClase, labelClase } from "../components/Marco";
import { SelectorPais } from "../components/SelectorPais";
import { BOLIVIA, ayudaCelular, celularConCodigo } from "../paises";
import { desafioPendiente } from "../sesion";
import type { Canal } from "../tipos";
import { errorCelular, errorCorreo, soloCelular } from "../validacion";

const PESTANAS: { canal: Canal; texto: string; icono: string }[] = [
  { canal: "CORREO", texto: "Correo", icono: "mail" },
  { canal: "CELULAR", texto: "Celular", icono: "smartphone" },
];

export function RecuperarPage() {
  const navegar = useNavigate();
  const sesionCerrada = (useLocation().state as { motivo?: string } | null)?.motivo === "sesion_cerrada";
  const [canales, setCanales] = useState<Canal[]>(["CORREO"]);
  const [canal, setCanal] = useState<Canal>("CORREO");
  const [correo, setCorreo] = useState("");
  const [pais, setPais] = useState<string>(BOLIVIA);
  const [numero, setNumero] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enCurso = useRef(false); // frena el doble toque

  // La pestaña «Celular» solo aparece si hay cómo enviar el código al celular.
  useEffect(() => {
    let vigente = true;
    api
      .campania()
      .then((c) => {
        if (vigente) setCanales(c.canales);
      })
      .catch(() => {
        // sin esa información se entra por correo, que siempre está disponible
      });
    return () => {
      vigente = false;
    };
  }, []);

  const pestanas = PESTANAS.filter((p) => canales.includes(p.canal));
  const contacto = canal === "CORREO" ? correo.trim() : celularConCodigo(pais, numero);
  const celular = ayudaCelular(pais);

  function limpiarError() {
    setError(null);
  }

  function cambiar(nuevo: Canal) {
    setCanal(nuevo);
    limpiarError();
  }

  function cambiarPais(nuevo: string) {
    setPais(nuevo);
    setNumero((n) => soloCelular(nuevo, n));
    limpiarError();
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enCurso.current) return;
    limpiarError();
    // Primero en la página: se dice qué falta sin ir al servidor.
    const falta = canal === "CORREO" ? errorCorreo(correo) : errorCelular(pais, numero);
    if (falta) {
      setError(falta);
      return;
    }
    enCurso.current = true;
    setEnviando(true);
    try {
      desafioPendiente.guardar(await api.recuperar(contacto));
      navegar("/tarjeta/verificar");
    } catch (err) {
      setError(err instanceof SorteoApiError ? err.message : "No se pudo enviar el código. Prueba de nuevo.");
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  }

  return (
    <Marco titulo="Entra a tu tarjeta" subtitulo="Te enviamos un código para entrar.">
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        {sesionCerrada && <Aviso>Tu sesión se cerró. Pide un código para entrar.</Aviso>}

        {pestanas.length > 1 && (
          <div role="tablist" aria-label="¿Dónde te enviamos tu código?" className="grid grid-cols-2 gap-1 rounded-xl border border-outline-variant bg-surface-container-low p-1">
            {pestanas.map((p) => (
              <button
                key={p.canal}
                type="button"
                role="tab"
                id={`pestana-${p.canal}`}
                aria-selected={canal === p.canal}
                aria-controls="panel-contacto"
                onClick={() => cambiar(p.canal)}
                className={`flex h-11 items-center justify-center gap-2 rounded-lg font-body-md text-body-md font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  canal === p.canal
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  {p.icono}
                </span>
                {p.texto}
              </button>
            ))}
          </div>
        )}

        <div id="panel-contacto" role="tabpanel" aria-labelledby={`pestana-${canal}`}>
          {canal === "CORREO" ? (
            <label className={labelClase}>
              Correo
              <input
                className={inputClase}
                type="email"
                value={correo}
                onChange={(e) => {
                  setCorreo(e.target.value);
                  limpiarError();
                }}
                autoComplete="email"
                placeholder="tunombre@gmail.com"
                aria-describedby="ayuda-contacto"
                required
              />
              <Ayuda id="ayuda-contacto">El mismo de tu registro.</Ayuda>
            </label>
          ) : (
            <div className={labelClase}>
              <label htmlFor="celular">Celular</label>
              <div className="flex gap-2">
                <SelectorPais valor={pais} onCambio={cambiarPais} />
                <input
                  id="celular"
                  className={`${inputClase} min-w-0 flex-1`}
                  type="tel"
                  inputMode={pais === "" ? "tel" : "numeric"}
                  value={numero}
                  onChange={(e) => {
                    setNumero(soloCelular(pais, e.target.value));
                    limpiarError();
                  }}
                  autoComplete="tel-national"
                  placeholder={celular.ejemplo}
                  aria-describedby="ayuda-contacto"
                  required
                />
              </div>
              <Ayuda id="ayuda-contacto">{celular.ayuda} El mismo de tu registro.</Ayuda>
            </div>
          )}
        </div>

        {error && <Alerta>{error}</Alerta>}
        <button type="submit" disabled={enviando} className={botonClase}>
          {enviando ? "Enviando código…" : "Enviarme un código"}
        </button>
        <p className="text-center text-on-surface-variant">
          ¿No tienes tarjeta?{" "}
          <Link to="/tarjeta" className="font-semibold text-secondary underline">
            Crear una
          </Link>
        </p>
      </form>
    </Marco>
  );
}
