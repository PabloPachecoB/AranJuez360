// Datos de mentira: todavía no existe ningún endpoint HTTP que conecte
// backend/fidelizacion/wallet_google.py con el resto del sistema (ver
// docs/FIDELIZACION_EQUIPO.md). Mientras tanto se simula aquí para poder
// construir y probar las pantallas. Reemplazar por llamadas reales a la API
// en cuanto el backend compartido las publique.
import type { EstadoTarjeta } from "./tipos";

export const TARJETA_SIMULADA: EstadoTarjeta = {
  codigo: "PA-7K3M9X",
  puntos: 4,
  participaciones: 4,
  faltan_bs: 120,
  pendientes: 1,
  fecha_sorteo: "20 dic",
  primer_nombre: "Alan",
};

/** Simula la llamada al backend: resuelve un código de cliente a su estado de tarjeta. */
export function obtenerTarjetaSimulada(codigo: string): Promise<EstadoTarjeta> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ ...TARJETA_SIMULADA, codigo }), 500);
  });
}
