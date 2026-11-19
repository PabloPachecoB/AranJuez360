/** Mismos campos que `EstadoTarjeta` en backend/fidelizacion/wallet_google.py — ver ese archivo si cambian. */
export interface EstadoTarjeta {
  codigo: string;
  puntos: number;
  participaciones: number;
  faltan_bs: number;
  pendientes: number;
  fecha_sorteo: string;
  primer_nombre?: string;
}

export type MedioVerificacion = "correo" | "celular";

export interface RegistroForm {
  nombres: string;
  apellidos: string;
  correo: string;
  celular: string;
  verificar_con: MedioVerificacion;
}
