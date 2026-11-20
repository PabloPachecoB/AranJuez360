import { encontrarComprobanteDemo, encontrarFichaDemo } from "./consulta";
import type { ResultadoComprobante, ResultadoFichaParticipante, ResultadoParticipantes } from "./tipos";

export async function cargarParticipantes(): Promise<ResultadoParticipantes> {
  if (!import.meta.env.DEV) {
    return { estado: "no_disponible" };
  }

  const datos = await import("./datosDemo");
  return {
    estado: "disponible",
    origen: "demo",
    campanias: datos.CAMPANIAS_DEMO,
    participantes: datos.PARTICIPANTES_DEMO,
    compras: datos.COMPRAS_DEMO,
  };
}

export async function cargarFichaParticipante(id: string): Promise<ResultadoFichaParticipante> {
  if (!import.meta.env.DEV) {
    return { estado: "no_disponible" };
  }

  const datos = await import("./datosDemo");
  return encontrarFichaDemo(id, datos.PARTICIPANTES_DEMO, datos.CAMPANIAS_DEMO, datos.COMPRAS_DEMO);
}

export async function cargarComprobanteDemo(participanteId: string, compraId: string): Promise<ResultadoComprobante> {
  if (!import.meta.env.DEV) {
    return { estado: "no_disponible" };
  }

  const datos = await import("./datosDemo");
  return encontrarComprobanteDemo(
    participanteId,
    compraId,
    datos.PARTICIPANTES_DEMO,
    datos.CAMPANIAS_DEMO,
    datos.COMPRAS_DEMO,
  );
}
