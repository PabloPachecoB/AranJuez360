import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { obtenerPaseQr, type PaseQr } from "../api";
import { CabeceraCliente, EstadoDatos, Superficie } from "../components/ClienteUi";

export function ClientePasePage() {
  const [pase, setPase] = useState<PaseQr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      try {
        const resultado = await obtenerPaseQr();
        if (vigente) {
          setPase(resultado);
          setSegundos(resultado.vigencia_segundos);
          setError(null);
        }
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudo generar el pase.");
      } finally {
        if (vigente) setCargando(false);
      }
    }
    void cargar();
    const intervalo = window.setInterval(() => { void cargar(); }, 90_000);
    return () => { vigente = false; window.clearInterval(intervalo); };
  }, []);

  useEffect(() => {
    const intervalo = window.setInterval(() => setSegundos((actual) => Math.max(0, actual - 1)), 1000);
    return () => window.clearInterval(intervalo);
  }, []);

  async function activarPantallaCompleta() {
    setPantallaCompleta(true);
    try { await document.documentElement.requestFullscreen?.(); } catch { /* El navegador puede bloquear fullscreen. */ }
    try {
      const navegador = navigator as Navigator & { wakeLock?: { request: (tipo: "screen") => Promise<{ release: () => Promise<void> }> } };
      wakeLock.current = await navegador.wakeLock?.request("screen") ?? null;
    } catch { wakeLock.current = null; }
  }

  async function cerrarPantallaCompleta() {
    setPantallaCompleta(false);
    await wakeLock.current?.release().catch(() => undefined);
    wakeLock.current = null;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  }

  async function copiarCodigo() {
    if (!pase) return;
    await navigator.clipboard?.writeText(pase.token);
    setSegundos(pase.vigencia_segundos);
  }

  return (
    <div className="animate-cliente-in">
      <CabeceraCliente eyebrow="Identificación personal" titulo="Mi pase digital" descripcion="Muestra este QR al ingresar al Paseo. Se renueva automáticamente para proteger tu cuenta." />
      <EstadoDatos cargando={cargando} error={error} onRetry={() => { setCargando(true); void obtenerPaseQr().then((resultado) => { setPase(resultado); setError(null); }).catch((err: unknown) => setError(err instanceof Error ? err.message : "No se pudo generar el pase.")).finally(() => setCargando(false)); }}>
        {pase && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.75fr)]">
            <Superficie className="flex flex-col items-center text-center">
              <div className="border border-outline-variant/40 bg-white p-5 sm:p-7">
                <QRCodeSVG value={pase.token} size={260} level="H" includeMargin bgColor="#ffffff" fgColor="#091734" />
              </div>
              <p className="mt-4 font-label-md text-label-md font-bold text-secondary">PASE PERSONAL · SE RENUEVA CADA {Math.round(pase.vigencia_segundos / 60)} MIN</p>
              <button type="button" onClick={() => void activarPantallaCompleta()} className="mt-5 inline-flex min-h-11 items-center gap-2 bg-primary px-5 font-label-md text-label-md font-bold text-on-primary hover:bg-primary-container">
                <span className="material-symbols-outlined" aria-hidden="true">fullscreen</span> Abrir para escaneo
              </button>
            </Superficie>
            <div className="flex flex-col gap-4">
              <Superficie>
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-label-md text-label-md font-bold uppercase text-on-surface-variant">Código de respaldo</p><p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">Si no pueden leer el QR, copia o dicta este token mientras siga vigente.</p></div>
                  <span className="material-symbols-outlined text-secondary" aria-hidden="true">pin</span>
                </div>
                <code className="mt-5 block break-all border-l-2 border-secondary bg-surface-container-low p-3 font-mono text-sm leading-6 text-on-surface">{pase.token}</code>
                <button type="button" onClick={() => void copiarCodigo()} className="mt-4 inline-flex min-h-10 items-center gap-2 font-label-md text-label-md font-bold text-primary hover:underline"><span className="material-symbols-outlined" aria-hidden="true">content_copy</span> Copiar código</button>
              </Superficie>
              <Superficie className="bg-surface-container-low">
                <div className="flex gap-3"><span className="material-symbols-outlined text-secondary" aria-hidden="true">light_mode</span><div><h2 className="font-headline-sm text-headline-sm">Pantalla lista para escanear</h2><p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">El modo de escaneo mantiene la pantalla despierta cuando el navegador lo permite. Sube el brillo del dispositivo si hace falta.</p></div></div>
              </Superficie>
            </div>
          </div>
        )}
      </EstadoDatos>

      {pantallaCompleta && pase && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-white p-5 text-center" role="dialog" aria-modal="true" aria-label="Pase de escaneo">
          <div className="flex flex-col items-center">
            <QRCodeSVG value={pase.token} size={Math.min(window.innerWidth - 48, 340)} level="H" includeMargin bgColor="#ffffff" fgColor="#091734" />
            <p className="mt-4 font-label-md text-label-md font-bold uppercase text-primary">Pase personal · {segundos > 0 ? `se actualiza en ${segundos}s` : "actualizando"}</p>
            <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">Si la pantalla se ve oscura, ajusta el brillo desde el dispositivo.</p>
            <button type="button" onClick={() => void cerrarPantallaCompleta()} className="mt-6 inline-flex min-h-11 items-center gap-2 border border-primary px-5 font-label-md text-label-md font-bold text-primary">
              <span className="material-symbols-outlined" aria-hidden="true">close</span> Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}