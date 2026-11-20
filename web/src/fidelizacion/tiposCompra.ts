// Tipos del formulario de compra (issue #45). Reflejan el contrato descrito en
// docs/FIDELIZACION_EQUIPO.md: el navegador NUNCA manda empresa, operador ni saldo;
// eso lo decide el servidor a partir de la sesión.

/** Cliente que se carga al escanear/escribir el código de su tarjeta de Wallet. */
export interface ClienteResuelto {
  /** Identificador interno (no es el código del QR). */
  id: string;
  /** Solo se muestra el primer nombre y las iniciales de los apellidos. */
  primer_nombre: string;
  iniciales: string;
  /** Lo que ya lleva acumulado, para mostrar contexto en el resumen. */
  puntos: number;
  sobrante_bs: number;
}

/** Datos que el negocio completa antes de aprobar. */
export interface DatosCompra {
  codigo_cliente: string;
  comprobante: string;
  /** Monto en Bs ya convertido a centavos (entero) para no arrastrar errores de decimales. */
  monto_centavos: number;
  foto: File;
  /** Mismo valor en cada reintento de la misma compra: el servidor no la acredita dos veces. */
  clave_idempotencia: string;
}

export type EstadoWallet = "SINCRONIZADA" | "PENDIENTE";

/** Lo que responde el servidor al aprobar (todo calculado por el backend). */
export interface ResultadoCompra {
  compra_id: string;
  estado: "APROBADA";
  monto_bs: number;
  /** Total aprobado de la campaña para este cliente, en Bs. */
  total_aprobado_bs: number;
  puntos_ganados: number;
  puntos_totales: number;
  participaciones: number;
  sobrante_bs: number;
  faltan_bs: number;
  wallet: EstadoWallet;
}

/** Errores estables que la guía pide manejar. */
export type CodigoErrorCompra =
  | "QR_INVALIDO"
  | "QR_REVOCADO"
  | "COMPROBANTE_DUPLICADO"
  | "MONTO_INVALIDO"
  | "SIN_PERMISO"
  | "SIN_RED";

export class ErrorCompra extends Error {
  codigo: CodigoErrorCompra;
  constructor(codigo: CodigoErrorCompra, mensaje: string) {
    super(mensaje);
    this.name = "ErrorCompra";
    this.codigo = codigo;
  }
}
