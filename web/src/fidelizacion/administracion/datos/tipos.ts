export interface CampaniaFidelizacion {
  id: string;
  nombre: string;
}

export interface ParticipanteFidelizacion {
  id: string;
  nombre: string;
  correo: string;
  celular: string;
  codigo: string;
  puntos: number;
  participaciones: number;
  montoAprobadoBs: number;
  sobranteBs: number;
  campaniaId: string;
}

export type EstadoCompraFidelizacion = "PENDIENTE" | "APROBADA" | "RECHAZADA" | "DEVUELTA";
export type EstadoImagenComprobante = "disponible" | "fallida";
export type EstadoOcrComprobante = "PENDIENTE" | "PROCESANDO" | "COMPLETADO" | "FALLIDO";

export interface CompraFidelizacion {
  id: string;
  participanteId: string;
  campaniaId: string;
  localNombre: string;
  fecha: string;
  numeroComprobante: string;
  montoBs: number;
  estado: EstadoCompraFidelizacion;
  imagenEstado: EstadoImagenComprobante;
  ocrEstado: EstadoOcrComprobante;
  ocrTexto: string | null;
  operador: string | null;
  fechaAprobacion: string | null;
}

export type ResultadoParticipantes =
  | { estado: "disponible"; origen: "demo"; campanias: CampaniaFidelizacion[]; participantes: ParticipanteFidelizacion[]; compras: CompraFidelizacion[] }
  | { estado: "no_disponible" };

export type ResultadoFichaParticipante =
  | { estado: "disponible"; origen: "demo"; participante: ParticipanteFidelizacion; campania: CampaniaFidelizacion; compras: CompraFidelizacion[] }
  | { estado: "no_encontrado" }
  | { estado: "no_disponible" };

export type ResultadoComprobante =
  | { estado: "disponible"; origen: "demo"; participante: ParticipanteFidelizacion; campania: CampaniaFidelizacion; compra: CompraFidelizacion }
  | { estado: "no_encontrado" }
  | { estado: "no_disponible" };

export type OrdenParticipantes = "puntos" | "monto";
