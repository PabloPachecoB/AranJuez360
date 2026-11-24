/** Etiquetas de presentación; no define las transiciones de compra del backend. */
export function textoEstadoCompra(estado: string) {
  const textos: Record<string, string> = { APROBADA: "Aprobada", PENDIENTE: "Pendiente", RECHAZADA: "Rechazada", DEVUELTA: "Devuelta" };
  return textos[estado] ?? "Sin indicar";
}
