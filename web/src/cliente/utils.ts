export function lista<T>(response: T[] | { results: T[] } | null | undefined): T[] {
  if (!response) return [];
  return Array.isArray(response) ? response : response.results;
}

export function formatoPuntos(valor: string | number | null | undefined) {
  return new Intl.NumberFormat("es-BO", { maximumFractionDigits: 2 }).format(Number(valor || 0));
}

export function formatoFecha(valor: string | null | undefined, opciones: Intl.DateTimeFormatOptions = {}) {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", ...opciones }).format(fecha);
}

export function formatoBolivianos(valor: string | number | null | undefined) {
  return new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", maximumFractionDigits: 2 }).format(Number(valor || 0));
}