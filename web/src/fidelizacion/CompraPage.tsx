// Pantalla «Fidelización» del panel de negocios (issue #45, PR 1).
// Flujo: código del cliente -> comprobante, monto y foto -> resumen -> aprobar -> resultado.
// El escáner con cámara llega en el PR 2; por ahora el código se escribe a mano.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  BS_POR_PUNTO,
  CODIGOS_DE_PRUEBA,
  MONTO_MAXIMO_BS,
  aprobarCompraSimulada,
  normalizarComprobante,
  normalizarCodigo,
  resolverClienteSimulado,
} from "./datosSimuladosCompra";
import { ErrorCompra, type ClienteResuelto, type ResultadoCompra } from "./tiposCompra";

const inputClase =
  "w-full h-12 px-4 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary transition-all";
const labelClase = "font-label-md text-label-md text-on-surface font-semibold";
const botonPrimario =
  "h-12 px-space-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity";
const botonSecundario =
  "h-12 px-space-lg rounded-lg bg-surface-container text-on-surface font-label-md text-label-md font-semibold hover:bg-surface-container-high disabled:opacity-50 transition-colors";
const tarjetaClase = "bg-surface-container-lowest rounded-xl p-space-lg shadow-[0_1px_12px_rgba(0,0,0,0.04)]";

const TIPOS_FOTO = ["image/jpeg", "image/png"];
const MAX_FOTO_BYTES = 5 * 1024 * 1024;

/** "150", "150.5" o "150,50" -> centavos enteros. null si no es un monto válido. */
function montoACentavos(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(limpio)) return null;
  const [enteros, decimales = ""] = limpio.split(".");
  return Number(enteros) * 100 + Number(decimales.padEnd(2, "0"));
}

const bs = (n: number) => `Bs ${n.toLocaleString("es-BO", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

function nuevaClave(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function Aviso({ tipo, children }: { tipo: "error" | "info"; children: React.ReactNode }) {
  const clases =
    tipo === "error"
      ? "bg-error-container text-on-error-container"
      : "bg-tertiary-fixed text-on-tertiary-fixed";
  return (
    <div role={tipo === "error" ? "alert" : "note"} className={`rounded-lg px-space-md py-space-sm font-body-sm text-body-sm ${clases}`}>
      {children}
    </div>
  );
}

export function CompraPage() {
  const { usuario } = useAuth();
  const puedeRegistrar = usuario?.rol === "NEGOCIO" || usuario?.rol === "CAJERO";

  const [codigo, setCodigo] = useState("");
  const [cliente, setCliente] = useState<ClienteResuelto | null>(null);
  const [comprobante, setComprobante] = useState("");
  const [monto, setMonto] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [vistaFoto, setVistaFoto] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [cargandoCliente, setCargandoCliente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoCompra | null>(null);

  // La misma clave en cada reintento de la misma compra: así un doble clic no suma dos veces.
  const clave = useRef(nuevaClave());
  // Candado inmediato contra doble clic (el estado de React tarda un ciclo en actualizarse).
  const enCurso = useRef(false);

  useEffect(() => {
    if (!foto) {
      setVistaFoto(null);
      return;
    }
    const url = URL.createObjectURL(foto);
    setVistaFoto(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  const montoCentavos = montoACentavos(monto);
  const comprobanteLimpio = normalizarComprobante(comprobante);
  const comprobanteValido = /^[A-Z0-9][A-Z0-9\-/.]{0,29}$/.test(comprobanteLimpio);
  const montoValido = montoCentavos !== null && montoCentavos > 0 && montoCentavos <= MONTO_MAXIMO_BS * 100;
  const listoParaResumen = comprobanteValido && montoValido && foto !== null && !errorFoto;

  function mensajeDe(err: unknown): string {
    if (err instanceof ErrorCompra) return err.message;
    return "Ocurrió un error inesperado. Inténtalo de nuevo.";
  }

  async function cargarCliente(e: FormEvent) {
    e.preventDefault();
    if (cargandoCliente) return;
    setError(null);
    setCargandoCliente(true);
    try {
      setCliente(await resolverClienteSimulado(codigo));
    } catch (err) {
      setCliente(null);
      setError(mensajeDe(err));
    } finally {
      setCargandoCliente(false);
    }
  }

  function elegirFoto(archivo: File | undefined) {
    setErrorFoto(null);
    if (!archivo) {
      setFoto(null);
      return;
    }
    if (!TIPOS_FOTO.includes(archivo.type)) {
      setFoto(null);
      setErrorFoto("La foto debe ser JPG o PNG.");
    } else if (archivo.size > MAX_FOTO_BYTES) {
      setFoto(null);
      setErrorFoto("La foto pesa más de 5 MB. Toma una más liviana.");
    } else {
      setFoto(archivo);
    }
  }

  async function aprobar() {
    if (enCurso.current || !cliente || !foto || montoCentavos === null || !confirmado) return;
    enCurso.current = true;
    setEnviando(true);
    setError(null);
    try {
      const r = await aprobarCompraSimulada({
        codigo_cliente: normalizarCodigo(codigo),
        comprobante,
        monto_centavos: montoCentavos,
        foto,
        clave_idempotencia: clave.current,
      });
      setResultado(r);
    } catch (err) {
      setError(mensajeDe(err));
      // Un duplicado o un QR revocado no se arreglan reintentando; el resto sí, con la misma clave.
      if (err instanceof ErrorCompra && err.codigo === "QR_REVOCADO") {
        setCliente(null);
        setConfirmado(false);
      }
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  }

  function otraCompra() {
    setCodigo("");
    setCliente(null);
    setComprobante("");
    setMonto("");
    setFoto(null);
    setErrorFoto(null);
    setConfirmado(false);
    setError(null);
    setResultado(null);
    clave.current = nuevaClave();
  }

  if (!puedeRegistrar) {
    return (
      <section className="max-w-2xl">
        <Aviso tipo="error">No tienes permiso para registrar compras de fidelización. Pide acceso al administrador de tu local.</Aviso>
      </section>
    );
  }

  return (
    <section className="max-w-2xl flex flex-col gap-space-lg">
      <header>
        <h1 className="font-headline-md text-headline-md text-on-surface">Fidelización</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Registra una compra del cliente. Cada {bs(BS_POR_PUNTO)} aprobados suman 1 punto y 1 participación en el sorteo; lo que sobra se conserva.
        </p>
      </header>

      <Aviso tipo="info">
        <strong>Datos simulados.</strong> Todavía no está conectada la API real: lo que apruebes aquí no se guarda y se pierde al recargar la página.
      </Aviso>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {resultado ? (
        <div className={`${tarjetaClase} flex flex-col gap-space-md`} aria-live="polite">
          <div className="flex items-center gap-space-sm text-secondary">
            <span aria-hidden="true" className="material-symbols-outlined">check_circle</span>
            <h2 className="font-headline-sm text-headline-sm">Compra aprobada</h2>
          </div>
          <dl className="grid grid-cols-2 gap-space-md font-body-md text-body-md">
            <div><dt className="text-on-surface-variant">Compra</dt><dd className="font-semibold">{resultado.compra_id}</dd></div>
            <div><dt className="text-on-surface-variant">Monto</dt><dd className="font-semibold">{bs(resultado.monto_bs)}</dd></div>
            <div><dt className="text-on-surface-variant">Puntos ganados</dt><dd className="font-semibold">+{resultado.puntos_ganados}</dd></div>
            <div><dt className="text-on-surface-variant">Puntos totales</dt><dd className="font-semibold">{resultado.puntos_totales}</dd></div>
            <div><dt className="text-on-surface-variant">Sobrante guardado</dt><dd className="font-semibold">{bs(resultado.sobrante_bs)}</dd></div>
            <div><dt className="text-on-surface-variant">Faltan para el siguiente</dt><dd className="font-semibold">{bs(resultado.faltan_bs)}</dd></div>
          </dl>
          {resultado.wallet === "SINCRONIZADA" ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              <span aria-hidden="true" className="material-symbols-outlined text-[16px] align-middle mr-1">wallet</span>
              Tarjeta de Wallet actualizada.
            </p>
          ) : (
            <Aviso tipo="info">
              La compra quedó aprobada, pero la tarjeta de Wallet todavía no se actualizó. Se reintentará sola; no hace falta registrar la compra otra vez.
            </Aviso>
          )}
          <button type="button" className={botonPrimario} onClick={otraCompra}>Registrar otra compra</button>
        </div>
      ) : !cliente ? (
        <form onSubmit={cargarCliente} className={`${tarjetaClase} flex flex-col gap-space-md`}>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">1. Cliente</h2>
          <div className="flex flex-col gap-space-xs">
            <label htmlFor="codigo" className={labelClase}>Código de la tarjeta de Wallet</label>
            <input
              id="codigo"
              className={inputClase}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ej: PA-7K3M9X"
              autoComplete="off"
              autoCapitalize="characters"
            />
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Es el código que aparece debajo del QR de la tarjeta. El escáner con cámara llegará pronto.
            </p>
          </div>
          <details className="font-body-sm text-body-sm text-on-surface-variant">
            <summary className="cursor-pointer">Códigos para probar</summary>
            <ul className="mt-space-sm flex flex-col gap-space-xs">
              {CODIGOS_DE_PRUEBA.map((c) => (
                <li key={c.codigo}>
                  <button type="button" className="underline text-primary" onClick={() => setCodigo(c.codigo)}>{c.codigo}</button>
                  {" — "}{c.detalle}
                </li>
              ))}
            </ul>
          </details>
          <button type="submit" className={botonPrimario} disabled={!codigo.trim() || cargandoCliente}>
            {cargandoCliente ? "Buscando…" : "Cargar cliente"}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-space-lg">
          <div className={`${tarjetaClase} flex items-center justify-between gap-space-md`}>
            <div>
              <p className="font-label-md text-label-md text-on-surface-variant">Cliente</p>
              <p className="font-headline-sm text-headline-sm text-on-surface">{cliente.primer_nombre} {cliente.iniciales}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {cliente.puntos} {cliente.puntos === 1 ? "punto" : "puntos"} · sobrante {bs(cliente.sobrante_bs)}
              </p>
            </div>
            <button
              type="button"
              className={botonSecundario}
              disabled={enviando}
              onClick={() => { setCliente(null); setConfirmado(false); setError(null); }}
            >
              Cambiar
            </button>
          </div>

          <div className={`${tarjetaClase} flex flex-col gap-space-md`}>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">2. Datos de la compra</h2>
            <div className="flex flex-col gap-space-xs">
              <label htmlFor="comprobante" className={labelClase}>Número de comprobante</label>
              <input
                id="comprobante"
                className={inputClase}
                value={comprobante}
                onChange={(e) => { setComprobante(e.target.value); setConfirmado(false); }}
                placeholder="Ej: F-0231"
                autoComplete="off"
              />
              {comprobante && !comprobanteValido && (
                <p className="font-body-sm text-body-sm text-error">Usa solo letras, números, guion o barra (máximo 30).</p>
              )}
            </div>
            <div className="flex flex-col gap-space-xs">
              <label htmlFor="monto" className={labelClase}>Monto de la compra (Bs)</label>
              <input
                id="monto"
                className={inputClase}
                value={monto}
                onChange={(e) => { setMonto(e.target.value); setConfirmado(false); }}
                inputMode="decimal"
                placeholder="Ej: 150 o 150,50"
                autoComplete="off"
              />
              {monto && !montoValido && (
                <p className="font-body-sm text-body-sm text-error">
                  Escribe un monto mayor a 0, con hasta 2 decimales, que no supere Bs {MONTO_MAXIMO_BS}.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-space-xs">
              <label htmlFor="foto" className={labelClase}>Foto del ticket (JPG o PNG)</label>
              <input
                id="foto"
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                className="font-body-sm text-body-sm"
                onChange={(e) => { elegirFoto(e.target.files?.[0]); setConfirmado(false); }}
              />
              {errorFoto && <p className="font-body-sm text-body-sm text-error">{errorFoto}</p>}
              {vistaFoto && (
                <img src={vistaFoto} alt="Vista previa del ticket" className="mt-space-sm max-h-56 w-auto rounded-lg object-contain self-start" />
              )}
            </div>
          </div>

          {listoParaResumen && montoCentavos !== null && (
            <div className={`${tarjetaClase} flex flex-col gap-space-md`}>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">3. Resumen</h2>
              <ul className="font-body-md text-body-md text-on-surface flex flex-col gap-space-xs">
                <li>Cliente: <strong>{cliente.primer_nombre} {cliente.iniciales}</strong></li>
                <li>Comprobante: <strong>{comprobanteLimpio}</strong></li>
                <li>Monto: <strong>{bs(montoCentavos / 100)}</strong></li>
                <li>Foto: <strong>{foto?.name}</strong></li>
              </ul>
              <label className="flex items-start gap-space-sm font-body-md text-body-md text-on-surface">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 accent-primary"
                  checked={confirmado}
                  onChange={(e) => setConfirmado(e.target.checked)}
                />
                <span>Confirmo que este ticket corresponde a una compra de mi local.</span>
              </label>
              <button type="button" className={botonPrimario} disabled={!confirmado || enviando} onClick={aprobar}>
                {enviando ? "Aprobando…" : "Verificar y aprobar compra"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
