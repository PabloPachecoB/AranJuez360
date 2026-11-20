// Contrato de la primera entrega del Sorteo Paseo (ver docs/fidelizacion/PLAN_ENTREGA_1_REGISTRO_Y_CUENTA.md).

export type Canal = "CORREO" | "CELULAR";

/** Por qué no hay una campaña activa: pausada, cerrada o todavía no existe. */
export type EstadoCampania = "ACTIVA" | "PAUSADA" | "CERRADA" | "SIN_CAMPANIA";

export interface CampaniaPublica {
  activa: boolean;
  estado: EstadoCampania;
  nombre: string | null;
  bs_por_punto: string | null;
  fecha_sorteo: string | null;
  canales: Canal[];
  /** Enlace público a los términos; null mientras el Paseo no lo publique. */
  terminos_url: string | null;
}

export interface DatosRegistro {
  nombres: string;
  apellidos: string;
  correo: string;
  celular: string;
  canal: Canal;
  acepta_terminos: boolean;
}

/** Respuesta de registro, reenvío y recuperación: el destino llega enmascarado. */
export interface Desafio {
  desafio: string;
  canal: Canal;
  destino: string;
  vence_en_minutos: number;
}

export interface Progreso {
  total_aprobado: string;
  puntos: number;
  participaciones: number;
  sobrante: string;
  faltan: string;
  pendientes: number;
}

export interface Tarjeta {
  codigo: string;
  primer_nombre: string;
  campania: Omit<CampaniaPublica, "canales" | "terminos_url">;
  /** Null mientras no haya una campaña activa. */
  progreso: Progreso | null;
  pases: { google: EstadoPase; apple: EstadoPase | "NO_DISPONIBLE" };
}

export type EstadoPase = "SIN_EMITIR" | "PENDIENTE" | "SINCRONIZADO" | "ERROR";

export interface RespuestaVerificar {
  sesion: string;
  tarjeta: Tarjeta;
}

export interface RespuestaGoogleWallet {
  url: string;
  estado: EstadoPase;
}

/** Códigos de error estables del backend. */
export type CodigoError =
  | "qr_invalido"
  | "campania_inactiva"
  | "desafio_invalido"
  | "codigo_incorrecto"
  | "codigo_vencido"
  | "codigo_agotado"
  | "demasiados_intentos"
  | "contacto_en_uso"
  | "contacto_invalido"
  | "contacto_registrado"
  | "sin_tarjeta"
  | "espera_reenvio"
  | "limite_envios"
  | "canal_no_disponible"
  | "sesion_invalida"
  | "wallet_no_configurado"
  | "wallet_error"
  | "apple_pendiente"
  | "cuenta_bloqueada"
  | "demasiadas_peticiones"
  | "envio_fallido"
  | "servicio_no_disponible"
  | "red";

export interface ApiSorteo {
  campania(): Promise<CampaniaPublica>;
  registro(datos: DatosRegistro): Promise<Desafio>;
  verificar(desafio: string, codigo: string): Promise<RespuestaVerificar>;
  reenviar(desafio: string): Promise<Desafio>;
  recuperar(contacto: string): Promise<Desafio>;
  miTarjeta(): Promise<Tarjeta>;
  googleWallet(): Promise<RespuestaGoogleWallet>;
  /** Cierra la sesión en el servidor (en todos los dispositivos). */
  cerrarSesion(): Promise<void>;
}
