import { useEffect, useRef, useState } from "react";
import { obtenerHistorialLocal, registrarCompra, resolverCodigo } from "./datosSimulados";
import type { ClienteResuelto, CompraRegistrada } from "./tipos";
import { useEscanerQR } from "./useEscanerQR";

type Paso = "buscar" | "formulario" | "confirmar" | "resultado";

const inputClase =
  "h-12 px-4 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all";
const labelClase = "flex flex-col gap-1.5 font-label-md text-label-md text-on-surface font-semibold";
const botonPrimario =
  "h-12 px-space-lg rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm disabled:opacity-60";
const botonSecundario =
  "h-12 px-space-lg rounded-lg border-2 border-outline-variant text-on-surface font-label-md text-label-md";

/**
 * Escáner y aprobación de compras del Sorteo Paseo para NEGOCIO y CAJERO (issue
 * #45). Resolver código y registrar compra usan datos simulados (falta el
 * "Backend compartido de fidelización", sin asignar) — ver datosSimulados.ts.
 */
export function EscanearPage() {
  const [paso, setPaso] = useState<Paso>("buscar");
  const [modoEntrada, setModoEntrada] = useState<"camara" | "manual">("camara");
  const [codigoManual, setCodigoManual] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [cliente, setCliente] = useState<ClienteResuelto | null>(null);

  const [monto, setMonto] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);

  const [registrando, setRegistrando] = useState(false);
  const [errorRegistro, setErrorRegistro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<CompraRegistrada | null>(null);
  const [historial, setHistorial] = useState<CompraRegistrada[]>([]);

  const yaDetectado = useRef(false);

  async function buscarCodigo(codigo: string) {
    if (!codigo || buscando) return;
    setBuscando(true);
    setErrorBusqueda(null);
    try {
      const encontrado = await resolverCodigo(codigo.trim());
      setCliente(encontrado);
      setPaso("formulario");
    } catch (err) {
      setErrorBusqueda(err instanceof Error ? err.message : "No se pudo verificar el código.");
      yaDetectado.current = false; // deja que la cámara vuelva a intentar
    } finally {
      setBuscando(false);
    }
  }

  const { videoRef, estado: estadoCamara } = useEscanerQR(
    paso === "buscar" && modoEntrada === "camara",
    (valor) => {
      if (yaDetectado.current) return;
      yaDetectado.current = true;
      buscarCodigo(valor);
    },
  );

  useEffect(() => {
    if (paso === "buscar") {
      yaDetectado.current = false;
      setHistorial(obtenerHistorialLocal());
    }
  }, [paso]);

  useEffect(() => {
    return () => {
      if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    };
  }, [fotoUrl]);

  function reiniciar() {
    setPaso("buscar");
    setCliente(null);
    setCodigoManual("");
    setMonto("");
    setFoto(null);
    setFotoUrl(null);
    setErrorRegistro(null);
    setResultado(null);
  }

  async function confirmarAprobacion() {
    if (!cliente) return;
    setRegistrando(true);
    setErrorRegistro(null);
    try {
      const compra = await registrarCompra(cliente.codigo, cliente.nombreReducido, Number(monto));
      setResultado(compra);
      setHistorial(obtenerHistorialLocal());
      setPaso("resultado");
    } catch (err) {
      setErrorRegistro(err instanceof Error ? err.message : "No se pudo registrar la compra.");
    } finally {
      setRegistrando(false);
    }
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-space-lg">
      <h1 className="font-headline-sm text-headline-sm text-primary">Fidelización (Wallet)</h1>

      {paso === "buscar" && (
        <div className="flex flex-col gap-space-md">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModoEntrada("camara")}
              className={`flex-1 h-10 rounded-lg font-label-md text-label-md ${modoEntrada === "camara" ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant"}`}
            >
              Escanear QR
            </button>
            <button
              type="button"
              onClick={() => setModoEntrada("manual")}
              className={`flex-1 h-10 rounded-lg font-label-md text-label-md ${modoEntrada === "manual" ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant"}`}
            >
              Escribir código
            </button>
          </div>

          {modoEntrada === "camara" && (
            <div className="rounded-xl overflow-hidden bg-black aspect-square flex items-center justify-center">
              {estadoCamara === "activa" && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              )}
              {estadoCamara === "pidiendo-permiso" && (
                <p className="font-body-sm text-body-sm text-white text-center px-space-md">
                  Pidiendo permiso de cámara...
                </p>
              )}
              {estadoCamara === "permiso-denegado" && (
                <p className="font-body-sm text-body-sm text-white text-center px-space-md">
                  No diste permiso de cámara. Usa "Escribir código" o dale permiso desde la configuración del
                  navegador.
                </p>
              )}
              {estadoCamara === "sin-soporte" && (
                <p className="font-body-sm text-body-sm text-white text-center px-space-md">
                  Este navegador no soporta escanear QR directamente. Usa "Escribir código".
                </p>
              )}
              {estadoCamara === "error" && (
                <p className="font-body-sm text-body-sm text-white text-center px-space-md">
                  No se pudo abrir la cámara. Usa "Escribir código".
                </p>
              )}
            </div>
          )}

          {modoEntrada === "manual" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                buscarCodigo(codigoManual);
              }}
              className="flex flex-col gap-space-md"
            >
              <label className={labelClase}>
                Código del cliente
                <input
                  className={inputClase}
                  required
                  autoFocus
                  placeholder="PA-XXXXXXX"
                  value={codigoManual}
                  onChange={(e) => setCodigoManual(e.target.value.toUpperCase())}
                />
              </label>
              <button type="submit" disabled={buscando} className={botonPrimario}>
                {buscando ? "Verificando..." : "Buscar cliente"}
              </button>
            </form>
          )}

          {buscando && modoEntrada === "camara" && (
            <p className="font-body-sm text-body-sm text-on-surface-variant text-center">Verificando código...</p>
          )}
          {errorBusqueda && <p className="font-body-sm text-body-sm text-error text-center">{errorBusqueda}</p>}

          {historial.length > 0 && (
            <div className="flex flex-col gap-2 mt-space-md">
              <h2 className="font-label-md text-label-md text-on-surface-variant uppercase">
                Historial de este local
              </h2>
              {historial.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-space-sm bg-surface-container-low rounded-lg"
                >
                  <div>
                    <p className="font-body-sm text-body-sm text-on-surface">{c.nombreReducido}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {new Date(c.fecha).toLocaleString("es-BO")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-label-md text-label-md text-on-surface">Bs {c.monto}</p>
                    <p className="font-body-sm text-body-sm text-secondary">
                      {c.estadoSincronizacion === "sincronizado" ? "Sincronizado" : "Error de sincronización"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {paso === "formulario" && cliente && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPaso("confirmar");
          }}
          className="flex flex-col gap-space-md"
        >
          <div className="p-space-sm bg-primary-fixed/20 rounded-lg">
            <p className="font-label-md text-label-md text-on-surface-variant">Cliente</p>
            <p className="font-headline-sm text-headline-sm text-on-surface">{cliente.nombreReducido}</p>
          </div>
          <label className={labelClase}>
            Monto de la compra (Bs)
            <input
              type="number"
              min={1}
              step="0.01"
              required
              className={inputClase}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </label>
          <label className={labelClase}>
            Foto del comprobante
            <input
              type="file"
              accept="image/*"
              capture="environment"
              required
              onChange={(e) => {
                const archivo = e.target.files?.[0] ?? null;
                setFoto(archivo);
                setFotoUrl(archivo ? URL.createObjectURL(archivo) : null);
              }}
            />
          </label>
          <div className="flex gap-space-sm">
            <button type="button" onClick={reiniciar} className={botonSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={!foto} className={botonPrimario}>
              Continuar
            </button>
          </div>
        </form>
      )}

      {paso === "confirmar" && cliente && (
        <div className="flex flex-col gap-space-md">
          <h2 className="font-label-md text-label-md text-on-surface-variant uppercase">Confirmar aprobación</h2>
          <div className="p-space-md bg-surface-container-low rounded-lg flex flex-col gap-2">
            <div className="flex justify-between">
              <span className="font-body-md text-body-md text-on-surface-variant">Cliente</span>
              <span className="font-body-md text-body-md text-on-surface font-semibold">{cliente.nombreReducido}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-body-md text-body-md text-on-surface-variant">Monto</span>
              <span className="font-body-md text-body-md text-on-surface font-semibold">Bs {monto}</span>
            </div>
            {fotoUrl && <img src={fotoUrl} alt="Comprobante" className="rounded-lg max-h-48 object-cover self-center" />}
          </div>
          {errorRegistro && <p className="font-body-sm text-body-sm text-error">{errorRegistro}</p>}
          <div className="flex gap-space-sm">
            <button type="button" onClick={reiniciar} className={botonSecundario}>
              Cancelar
            </button>
            <button type="button" onClick={confirmarAprobacion} disabled={registrando} className={botonPrimario}>
              {registrando ? "Aprobando..." : "Confirmar aprobación"}
            </button>
          </div>
        </div>
      )}

      {paso === "resultado" && resultado && (
        <div className="flex flex-col items-center gap-space-md text-center">
          <span aria-hidden="true" className="material-symbols-outlined text-primary text-[48px]">
            check_circle
          </span>
          <p className="font-headline-sm text-headline-sm text-on-surface">Compra aprobada</p>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {resultado.nombreReducido} — Bs {resultado.monto}
          </p>
          <p className="font-body-sm text-body-sm text-secondary">Pase sincronizado</p>
          <button type="button" onClick={reiniciar} className={botonPrimario}>
            Registrar otra compra
          </button>
        </div>
      )}
    </div>
  );
}
