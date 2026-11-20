export interface ClienteResuelto {
  codigo: string;
  nombreReducido: string;
}

export type EstadoSincronizacion = "sincronizado" | "error";

export interface CompraRegistrada {
  id: string;
  codigo: string;
  nombreReducido: string;
  monto: number;
  fecha: string;
  estadoSincronizacion: EstadoSincronizacion;
}
