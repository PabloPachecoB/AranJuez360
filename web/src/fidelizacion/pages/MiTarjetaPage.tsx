import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, SorteoApiError } from "../api";
import { BarraProgreso } from "../components/BarraProgreso";
import { BotonesWallet } from "../components/BotonesWallet";
import { Alerta, Marco, botonClase } from "../components/Marco";
import { fechaSorteo, formatearBs, mensajeSorteo } from "../formato";
import { sesionTarjeta } from "../sesion";
import type { EstadoCampania, Tarjeta } from "../tipos";

function motivoSinWallet(estado: EstadoCampania): string | undefined {
  if (estado === "ACTIVA") return undefined;
  return estado === "CERRADA"
    ? "El sorteo terminó."
    : "Disponible cuando el sorteo esté activo.";
}

export function MiTarjetaPage() {
  const navegar = useNavigate();
  const [tarjeta, setTarjeta] = useState<Tarjeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bloqueada, setBloqueada] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [sinSesion, setSinSesion] = useState(!sesionTarjeta.obtener());
  // La sesión existía pero el servidor ya no la acepta (venció o se recuperó la tarjeta en otro dispositivo).
  const [expulsada, setExpulsada] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const saliendoRef = useRef(false);

  useEffect(() => {
    if (sinSesion) return;
    let vigente = true;
    api
      .miTarjeta()
      .then((t) => {
        if (vigente) setTarjeta(t);
      })
      .catch((err) => {
        if (!vigente) return;
        if (err instanceof SorteoApiError && err.status === 401) {
          setExpulsada(true);
          setSinSesion(true);
        } else if (err instanceof SorteoApiError && err.codigo === "cuenta_bloqueada") setBloqueada(err.message);
        else setError(err instanceof SorteoApiError ? err.message : "No se pudo cargar tu tarjeta.");
      });
    return () => {
      vigente = false;
    };
  }, [sinSesion, intento]);

  const recargar = useCallback(() => {
    setError(null);
    setIntento((n) => n + 1);
  }, []);

  if (sinSesion) return <Navigate to="/tarjeta/recuperar" replace state={expulsada ? { motivo: "sesion_cerrada" } : undefined} />;

  async function cerrarSesion() {
    if (saliendoRef.current) return;
    saliendoRef.current = true;
    setSaliendo(true);
    try {
      await api.cerrarSesion(); // invalida el token en el servidor
    } catch {
      // sin conexión o sesión ya vencida: igual se borra de este dispositivo
    }
    sesionTarjeta.borrar();
    navegar("/tarjeta", { replace: true });
  }

  const botonSalir = (
    <button type="button" onClick={cerrarSesion} disabled={saliendo} className="text-center text-on-surface-variant underline disabled:opacity-60">
      {saliendo ? "Cerrando sesión…" : "Cerrar sesión"}
    </button>
  );

  if (bloqueada) {
    return (
      <Marco titulo="Tu tarjeta">
        <div className="flex flex-col gap-4">
          <Alerta>{bloqueada}</Alerta>
          {botonSalir}
        </div>
      </Marco>
    );
  }
  if (error) {
    return (
      <Marco titulo="Mi tarjeta">
        <div className="flex flex-col gap-3">
          <Alerta>{error}</Alerta>
          <button type="button" onClick={recargar} className={botonClase}>
            Reintentar
          </button>
        </div>
      </Marco>
    );
  }
  if (!tarjeta) {
    return (
      <Marco titulo="Mi tarjeta">
        <p role="status" className="text-on-surface-variant">
          Cargando tu tarjeta…
        </p>
      </Marco>
    );
  }

  const { progreso, campania } = tarjeta;
  return (
    <Marco titulo={tarjeta.primer_nombre ? `Hola, ${tarjeta.primer_nombre}` : "Mi tarjeta"} subtitulo={campania.nombre ?? "Sorteo Paseo"}>
      <div className="flex flex-col gap-5">
        {progreso && campania.bs_por_punto ? (
          <section aria-label="Tu progreso" className="rounded-2xl bg-primary p-5 text-on-primary">
            {/* Un solo número: punto y participación son lo mismo, mostrarlos por separado hacía pensar en dos cosas. */}
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-label-md text-label-md text-white/80">Tus puntos</p>
                <p className="font-display text-display leading-none">{progreso.puntos}</p>
              </div>
              <p className="max-w-[11rem] text-right font-label-md text-label-md text-white/80">
                Cada punto es una oportunidad de ganar.
              </p>
            </div>
            <div className="mt-5">
              <BarraProgreso sobrante={progreso.sobrante} bsPorPunto={campania.bs_por_punto} faltan={progreso.faltan} />
            </div>
            <p className="mt-4 font-label-md text-label-md text-white/80">
              Tus compras: {formatearBs(progreso.total_aprobado)} · Sorteo: {fechaSorteo(campania.fecha_sorteo)}
            </p>
          </section>
        ) : (
          <p role="status" className="rounded-lg bg-surface-container-low px-4 py-3 text-on-surface-variant">
            {mensajeSorteo(campania.estado)}
          </p>
        )}

        <section aria-label="Tu código" className="flex flex-col items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
          <p className="text-center text-on-surface-variant">Muéstralo en caja al pagar</p>
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG value={tarjeta.codigo} size={176} level="M" title={`Código ${tarjeta.codigo}`} />
          </div>
          <p className="font-headline-md text-headline-md tracking-widest text-on-surface">{tarjeta.codigo}</p>
          <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
            Si no lo pueden leer, dicta el código. No lo compartas.
          </p>
        </section>

        <BotonesWallet estadoGoogle={tarjeta.pases.google} onPublicado={recargar} motivoDeshabilitado={motivoSinWallet(campania.estado)} />

        {botonSalir}
      </div>
    </Marco>
  );
}
