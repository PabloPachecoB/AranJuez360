import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { publicarEnWallet } from "./api";
import { obtenerTarjetaSimulada } from "./datosSimulados";
import type { EstadoTarjeta } from "./tipos";

/**
 * Pantalla de puntos y progreso del Sorteo Paseo (tarea "Completar Google Wallet
 * en Android", issue #42). Los puntos/participaciones todavía son datos simulados
 * (falta el "Backend compartido de fidelización", sin asignar) pero el botón de
 * Wallet sí publica un pase real, vía POST /api/v1/sorteo-paseo/wallet/publicar/.
 */
export function MiTarjetaPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [tarjeta, setTarjeta] = useState<EstadoTarjeta | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [errorWallet, setErrorWallet] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    obtenerTarjetaSimulada(codigo).then(setTarjeta);
  }, [codigo]);

  async function agregarAWallet() {
    if (!tarjeta) return;
    setPublicando(true);
    setErrorWallet(null);
    try {
      const { enlace_wallet } = await publicarEnWallet(tarjeta);
      window.open(enlace_wallet, "_blank");
    } catch {
      setErrorWallet("No se pudo conectar con Google Wallet. Intenta de nuevo.");
    } finally {
      setPublicando(false);
    }
  }

  if (!tarjeta) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-on-surface-variant font-body-md text-body-md">
        Cargando tu tarjeta...
      </main>
    );
  }

  const saludo = tarjeta.primer_nombre ? `Hola, ${tarjeta.primer_nombre}.` : "Tu tarjeta Sorteo Paseo";

  return (
    <main className="min-h-screen flex flex-col items-center bg-background px-space-md py-space-lg gap-space-lg">
      <div className="flex flex-col items-center gap-1 text-center">
        <img src="/logo-360.svg" alt="Paseo Aranjuez 360" className="w-48 max-w-full" />
        <p className="font-headline-sm text-headline-sm text-primary">{saludo}</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl shadow-lg p-space-lg flex flex-col gap-space-md text-on-primary" style={{ background: "#0B1F3A" }}>
        <div className="flex justify-between">
          <div>
            <p className="font-label-md text-label-md opacity-80">Puntos</p>
            <p className="font-headline-sm text-headline-sm">{tarjeta.puntos}</p>
          </div>
          <div className="text-right">
            <p className="font-label-md text-label-md opacity-80">Participaciones</p>
            <p className="font-headline-sm text-headline-sm">{tarjeta.participaciones}</p>
          </div>
        </div>
        <div className="flex justify-between font-body-sm text-body-sm opacity-90">
          <span>Te faltan Bs {tarjeta.faltan_bs}</span>
          <span>{tarjeta.pendientes} compra{tarjeta.pendientes !== 1 ? "s" : ""} pendiente{tarjeta.pendientes !== 1 ? "s" : ""}</span>
        </div>
        <div className="font-body-sm text-body-sm opacity-90">Sorteo: {tarjeta.fecha_sorteo}</div>
        <div className="self-center bg-white p-space-sm rounded-lg">
          {/* Placeholder de QR: el código real lo genera el backend junto al pase. */}
          <p className="font-label-md text-label-md text-center" style={{ color: "#0B1F3A" }}>
            {tarjeta.codigo}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={agregarAWallet}
        disabled={publicando}
        className="h-12 px-space-lg rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm disabled:opacity-60 flex items-center gap-2"
      >
        {publicando ? "Conectando con Google Wallet..." : "Agregar a Google Wallet"}
      </button>
      {errorWallet && <p className="font-body-sm text-body-sm text-error">{errorWallet}</p>}
      <p className="font-body-sm text-body-sm text-on-surface-variant text-center max-w-sm">
        Los puntos de arriba son de ejemplo (falta el backend de compras) pero el botón sí publica un
        pase real en tu Google Wallet. Cada Bs 200 en compras validadas es 1 punto y 1 participación; lo
        que sobra se guarda para la siguiente compra.
      </p>
    </main>
  );
}
