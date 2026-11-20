// Datos de mentira para el formulario de compra (issue #45).
// Todavía no existen las rutas reales para resolver el QR ni aprobar compras
// (issues #40 y #44, ver docs/FIDELIZACION_EQUIPO.md). Esto imita al backend para
// poder construir y probar la pantalla. Cuando la API exista, se reemplazan
// `resolverClienteSimulado` y `aprobarCompraSimulada` por llamadas con `api()`
// de src/api/client.ts, y las reglas de abajo pasan a vivir solo en el servidor.
import { ErrorCompra, type ClienteResuelto, type DatosCompra, type ResultadoCompra } from "./tiposCompra";

/** Regla de la campaña: cada Bs 200 aprobados = 1 punto = 1 participación. */
export const BS_POR_PUNTO = 200;
const CENTAVOS_POR_PUNTO = BS_POR_PUNTO * 100;
/** Tope de cordura para un solo ticket. Por encima se rechaza como monto inválido. */
export const MONTO_MAXIMO_BS = 50000;

/** Códigos de ejemplo para probar cada caso en pantalla. */
export const CODIGOS_DE_PRUEBA = [
  { codigo: "PA-7K3M9X", detalle: "válido, ya tiene 4 puntos" },
  { codigo: "PA-NUEVO1", detalle: "válido, tarjeta nueva" },
  { codigo: "PA-WALLET", detalle: "válido, Wallet queda pendiente" },
  { codigo: "PA-REVOKE", detalle: "QR revocado" },
  { codigo: "PA-SINRED", detalle: "simula falta de red" },
];

interface ClienteSimulado {
  id: string;
  primer_nombre: string;
  iniciales: string;
  acumulado_centavos: number;
  revocado?: boolean;
  wallet_falla?: boolean;
}

// Se guarda solo en memoria: al recargar la página todo vuelve a empezar.
const clientes: Record<string, ClienteSimulado> = {
  "PA-7K3M9X": { id: "cli-1", primer_nombre: "Alan", iniciales: "P. R.", acumulado_centavos: 68000 },
  "PA-NUEVO1": { id: "cli-2", primer_nombre: "María", iniciales: "C. A.", acumulado_centavos: 0 },
  "PA-WALLET": { id: "cli-3", primer_nombre: "Jhojan", iniciales: "M. T.", acumulado_centavos: 0, wallet_falla: true },
  "PA-REVOKE": { id: "cli-4", primer_nombre: "Carlos", iniciales: "L. V.", acumulado_centavos: 0, revocado: true },
};

// Comprobantes ya aprobados en este local (el local lo decide el servidor; aquí hay uno solo).
const comprobantesUsados = new Set<string>(["F-0001"]);
// Compras ya procesadas, por clave de idempotencia: reenviar la misma no suma dos veces.
const comprasPorClave = new Map<string, ResultadoCompra>();
let contadorCompras = 100;

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase();
}

export function normalizarComprobante(comprobante: string): string {
  return comprobante.trim().toUpperCase();
}

function sinRed(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Calcula puntos y sobrante a partir de lo acumulado, sin decimales flotantes. */
export function calcularAvance(acumuladoCentavos: number) {
  const puntos = Math.floor(acumuladoCentavos / CENTAVOS_POR_PUNTO);
  const sobranteCentavos = acumuladoCentavos % CENTAVOS_POR_PUNTO;
  return {
    puntos,
    sobrante_bs: sobranteCentavos / 100,
    faltan_bs: (CENTAVOS_POR_PUNTO - sobranteCentavos) / 100,
  };
}

/** Paso 2 del flujo: el servidor resuelve el código opaco y devuelve el cliente reducido. */
export async function resolverClienteSimulado(codigoCrudo: string): Promise<ClienteResuelto> {
  await pausa(500);
  if (sinRed()) throw new ErrorCompra("SIN_RED", "No hay conexión a internet. Revisa tu red e inténtalo de nuevo.");
  const codigo = normalizarCodigo(codigoCrudo);
  if (codigo === "PA-SINRED") {
    throw new ErrorCompra("SIN_RED", "No se pudo conectar con el servidor. Revisa tu red e inténtalo de nuevo.");
  }
  const cliente = clientes[codigo];
  if (!cliente) {
    throw new ErrorCompra("QR_INVALIDO", "Ese código no corresponde a ninguna tarjeta. Revisa que esté bien escrito.");
  }
  if (cliente.revocado) {
    throw new ErrorCompra("QR_REVOCADO", "Esa tarjeta fue revocada. Pide al cliente que abra su tarjeta más reciente.");
  }
  const { puntos, sobrante_bs } = calcularAvance(cliente.acumulado_centavos);
  return { id: cliente.id, primer_nombre: cliente.primer_nombre, iniciales: cliente.iniciales, puntos, sobrante_bs };
}

/** Pasos 5 y 6: aprueba la compra y acredita una sola vez. */
export async function aprobarCompraSimulada(datos: DatosCompra): Promise<ResultadoCompra> {
  await pausa(700);
  if (sinRed()) throw new ErrorCompra("SIN_RED", "No hay conexión a internet. La compra no se registró; inténtalo de nuevo.");

  // Reintento de la misma compra: se devuelve lo que ya se calculó, sin acreditar otra vez.
  const previa = comprasPorClave.get(datos.clave_idempotencia);
  if (previa) return previa;

  const cliente = clientes[normalizarCodigo(datos.codigo_cliente)];
  if (!cliente || cliente.revocado) {
    throw new ErrorCompra("QR_REVOCADO", "La tarjeta del cliente ya no es válida. Vuelve a cargar el código.");
  }
  if (!Number.isInteger(datos.monto_centavos) || datos.monto_centavos <= 0 || datos.monto_centavos > MONTO_MAXIMO_BS * 100) {
    throw new ErrorCompra("MONTO_INVALIDO", `El monto debe ser mayor a Bs 0 y no superar Bs ${MONTO_MAXIMO_BS}.`);
  }
  const comprobante = normalizarComprobante(datos.comprobante);
  if (comprobantesUsados.has(comprobante)) {
    throw new ErrorCompra("COMPROBANTE_DUPLICADO", `El comprobante ${comprobante} ya fue registrado en este local.`);
  }

  const antes = calcularAvance(cliente.acumulado_centavos).puntos;
  cliente.acumulado_centavos += datos.monto_centavos;
  comprobantesUsados.add(comprobante);
  const despues = calcularAvance(cliente.acumulado_centavos);

  contadorCompras += 1;
  const resultado: ResultadoCompra = {
    compra_id: `C-${contadorCompras}`,
    estado: "APROBADA",
    monto_bs: datos.monto_centavos / 100,
    total_aprobado_bs: cliente.acumulado_centavos / 100,
    puntos_ganados: despues.puntos - antes,
    puntos_totales: despues.puntos,
    participaciones: despues.puntos,
    sobrante_bs: despues.sobrante_bs,
    faltan_bs: despues.faltan_bs,
    // Si Wallet falla, la compra queda aprobada igual y la sincronización se reintenta aparte.
    wallet: cliente.wallet_falla ? "PENDIENTE" : "SINCRONIZADA",
  };
  comprasPorClave.set(datos.clave_idempotencia, resultado);
  return resultado;
}
