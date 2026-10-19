import { api, ApiError } from "./apiClient";

// Billetera Paseo — SIMULACIÓN de frontend: los saldos y pagos no se guardan ni mueven dinero.
// Lo único real es la cotización del dólar, que el backend lee del BCB y del P2P de Binance.
// Reglas tomadas de la nota de Obsidian "Billetera Paseo (saldo de regalo)": saldo de regalo en USD,
// mostrado en Bs con la cotización elegida, que se congela al pagar. Los valores de campaña son
// la PROPUESTA del plan (decisiones abiertas), no reglas aprobadas.

/** [{ id, nombre, valor, fecha, detalle, fuente, url, consultado_en, desactualizada }] (sin las que no respondieron). */
export async function getCotizaciones() {
  try {
    const { data } = await api.get("/billetera/cotizaciones/");
    return [data.oficial, data.usdt].filter(Boolean).map((c) => ({ ...c, valor: Number(c.valor) }));
  } catch (err) {
    throw new ApiError(err);
  }
}

export const CAMPANIA = {
  nombre: "Devolución Paseo",
  porcentaje: 8, // % de la compra que vuelve como saldo
  topeUsd: 100, // máximo por compra
  compraMinimaBs: 500,
  diasPendiente: 7, // por si el producto se devuelve
  diasVencimiento: 90,
  financia: "Paseo Aranjuez",
  noMismaTienda: true, // el saldo no se gasta en la tienda que lo dio
};

const DIA_MS = 24 * 60 * 60 * 1000;

// Todo el dinero se maneja en centavos enteros para no arrastrar errores de float.
export const aCentavos = (n) => Math.round(Number(n || 0) * 100);
export const usd = (c) => `USD ${(c / 100).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const bs = (c) => `Bs ${(c / 100).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const usdABs = (centUsd, tasa) => Math.round(centUsd * tasa);
export const bsAUsd = (centBs, tasa) => Math.round(centBs / tasa);

let secuencia = 0;
const nuevoId = (prefijo) => `${prefijo}-${Date.now().toString(36).toUpperCase()}${(++secuencia).toString(36).toUpperCase()}`;

export const estadoInicial = () => ({ diasAdelantados: 0, lotes: [], movimientos: [] });

export const ahora = (estado) => Date.now() + estado.diasAdelantados * DIA_MS;

/** PENDIENTE (aún no se puede gastar), DISPONIBLE, VENCIDO, AGOTADO o ANULADO. */
export function estadoLote(lote, hoy) {
  if (lote.anulado) return "ANULADO";
  if (lote.restante <= 0) return "AGOTADO";
  if (hoy >= lote.venceEn) return "VENCIDO";
  if (hoy < lote.disponibleDesde) return "PENDIENTE";
  return "DISPONIBLE";
}

export function resumen(estado) {
  const hoy = ahora(estado);
  const en15dias = hoy + 15 * DIA_MS;
  let disponible = 0;
  let pendiente = 0;
  let porVencer = 0;
  estado.lotes.forEach((l) => {
    const e = estadoLote(l, hoy);
    if (e === "DISPONIBLE") {
      disponible += l.restante;
      if (l.venceEn <= en15dias) porVencer += l.restante;
    }
    if (e === "PENDIENTE") pendiente += l.restante;
  });
  return { disponible, pendiente, porVencer };
}

/** Cuánto saldo devuelve una compra con la campaña vigente (antes de confirmarla). */
export function calcularDevolucion(montoBs, tasa) {
  const centBs = aCentavos(montoBs);
  if (centBs < aCentavos(CAMPANIA.compraMinimaBs)) {
    return { centUsd: 0, motivo: `La compra mínima de la campaña es ${bs(aCentavos(CAMPANIA.compraMinimaBs))}.` };
  }
  const bruto = Math.round((bsAUsd(centBs, tasa) * CAMPANIA.porcentaje) / 100);
  const tope = aCentavos(CAMPANIA.topeUsd);
  return { centUsd: Math.min(bruto, tope), topado: bruto > tope };
}

/** El cajero aprobó el ticket: se crea un lote PENDIENTE con su vencimiento. */
export function registrarCompra(estado, { empresa, montoBs, cotizacion }) {
  const { centUsd } = calcularDevolucion(montoBs, cotizacion.valor);
  if (!centUsd) return estado;
  const hoy = ahora(estado);
  const lote = {
    id: nuevoId("L"),
    empresaId: empresa.id,
    empresaNombre: empresa.nombre,
    monto: centUsd,
    restante: centUsd,
    creadoEn: hoy,
    disponibleDesde: hoy + CAMPANIA.diasPendiente * DIA_MS,
    venceEn: hoy + (CAMPANIA.diasPendiente + CAMPANIA.diasVencimiento) * DIA_MS,
  };
  const mov = {
    id: nuevoId("M"),
    tipo: "DEVOLUCION",
    fecha: hoy,
    centUsd,
    empresaNombre: empresa.nombre,
    detalle: `${CAMPANIA.porcentaje}% de tu compra de ${bs(aCentavos(montoBs))} · cotización ${cotizacion.nombre} ${cotizacion.valor}`,
  };
  return { ...estado, lotes: [...estado.lotes, lote], movimientos: [mov, ...estado.movimientos] };
}

/** El cliente devolvió el producto mientras el saldo seguía pendiente: el lote se anula. */
export function anularLote(estado, loteId) {
  const hoy = ahora(estado);
  const lote = estado.lotes.find((l) => l.id === loteId);
  if (!lote || estadoLote(lote, hoy) !== "PENDIENTE") return estado;
  const mov = {
    id: nuevoId("M"),
    tipo: "ANULACION",
    fecha: hoy,
    centUsd: -lote.restante,
    empresaNombre: lote.empresaNombre,
    detalle: "Devolviste el producto: el saldo pendiente se anuló.",
  };
  return {
    ...estado,
    lotes: estado.lotes.map((l) => (l.id === loteId ? { ...l, anulado: true } : l)),
    movimientos: [mov, ...estado.movimientos],
  };
}

/** Lotes que sirven para pagar en esta empresa, del que vence antes al que vence después. */
function lotesUsables(estado, empresaId) {
  const hoy = ahora(estado);
  return estado.lotes
    .filter((l) => estadoLote(l, hoy) === "DISPONIBLE")
    .filter((l) => !CAMPANIA.noMismaTienda || l.empresaId !== empresaId)
    .sort((a, b) => a.venceEn - b.venceEn);
}

/** Vista previa del pago: cuánto cubre la billetera (a la cotización congelada) y cuánto queda por QR del banco. */
export function previsualizarPago(estado, { empresa, montoBs, cotizacion }) {
  const centBs = aCentavos(montoBs);
  const necesarioUsd = bsAUsd(centBs, cotizacion.valor);
  const usables = lotesUsables(estado, empresa.id);
  const saldoUsable = usables.reduce((s, l) => s + l.restante, 0);
  const bloqueado = resumen(estado).disponible - saldoUsable; // saldo de esta misma tienda
  const usarUsd = Math.min(necesarioUsd, saldoUsable);
  const cubiertoBs = usarUsd === necesarioUsd ? centBs : usdABs(usarUsd, cotizacion.valor);
  return { centBs, usarUsd, cubiertoBs, restoBs: centBs - cubiertoBs, bloqueado, tasa: cotizacion.valor };
}

export function pagar(estado, { empresa, montoBs, cotizacion, origen }) {
  const p = previsualizarPago(estado, { empresa, montoBs, cotizacion });
  if (!p.usarUsd) return { estado, comprobante: null };
  const hoy = ahora(estado);
  let falta = p.usarUsd;
  const usados = {};
  lotesUsables(estado, empresa.id).forEach((l) => {
    if (!falta) return;
    const toma = Math.min(l.restante, falta);
    usados[l.id] = toma;
    falta -= toma;
  });
  const comprobante = {
    referencia: nuevoId("PAGO"),
    fecha: hoy,
    empresaNombre: empresa.nombre,
    origen,
    ...p,
    cotizacionNombre: cotizacion.nombre,
    cotizacionFuente: cotizacion.fuente,
  };
  const mov = {
    id: nuevoId("M"),
    tipo: "PAGO",
    fecha: hoy,
    centUsd: -p.usarUsd,
    empresaNombre: empresa.nombre,
    detalle: `${origen} · ${bs(p.cubiertoBs)} a ${p.tasa} Bs/USD${p.restoBs ? ` · resto ${bs(p.restoBs)} por QR del banco` : ""}`,
  };
  return {
    estado: {
      ...estado,
      lotes: estado.lotes.map((l) => (usados[l.id] ? { ...l, restante: l.restante - usados[l.id] } : l)),
      movimientos: [mov, ...estado.movimientos],
    },
    comprobante,
  };
}

/** Simula que pasan días: libera lotes pendientes y registra los que vencieron. */
export function adelantarDias(estado, dias) {
  const antes = ahora(estado);
  const siguiente = { ...estado, diasAdelantados: estado.diasAdelantados + dias };
  const hoy = ahora(siguiente);
  const vencidos = estado.lotes
    .filter((l) => estadoLote(l, antes) !== "VENCIDO" && !l.anulado && l.restante > 0 && l.venceEn <= hoy)
    .map((l) => ({
      id: nuevoId("M"),
      tipo: "VENCIMIENTO",
      fecha: l.venceEn,
      centUsd: -l.restante,
      empresaNombre: l.empresaNombre,
      detalle: `Venció el saldo que no usaste (${CAMPANIA.diasVencimiento} días).`,
    }));
  return { ...siguiente, movimientos: [...vencidos, ...siguiente.movimientos] };
}
