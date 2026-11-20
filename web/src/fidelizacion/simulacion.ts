// Respuestas de ejemplo para desarrollar sin backend (VITE_SORTEO_SIMULADO=1, solo en desarrollo).
// Usan los mismos ejemplos del contrato. El código de verificación simulado es siempre 123456.

import type { ApiSorteo, CampaniaPublica, Desafio, Tarjeta } from "./tipos";

export const CODIGO_SIMULADO = "123456";

type ConstructorError = new (status: number, codigo: string, mensaje: string, campos?: Record<string, string>) => Error;

const pausa = (ms = 350) => new Promise((r) => setTimeout(r, ms));

const CAMPANIA: CampaniaPublica = {
  activa: true,
  estado: "ACTIVA",
  nombre: "Sorteo Paseo",
  bs_por_punto: "200.00",
  fecha_sorteo: "2026-12-20",
  canales: ["CORREO", "CELULAR"],
  terminos_url: null,
};

export function sesionSimulada(Error_: ConstructorError): ApiSorteo {
  let nombre = "María";
  let tieneSesion = false;
  let googleEmitido = false;

  const desafio = (canal: "CORREO" | "CELULAR"): Desafio => ({
    desafio: "00000000-0000-4000-8000-000000000001",
    canal,
    destino: canal === "CORREO" ? "m••••@ejemplo.com" : "••••••67",
    vence_en_minutos: 10,
  });

  const tarjeta = (): Tarjeta => ({
    codigo: "PA-7K3M9X",
    primer_nombre: nombre,
    campania: { activa: true, estado: "ACTIVA", nombre: CAMPANIA.nombre, bs_por_punto: CAMPANIA.bs_por_punto, fecha_sorteo: CAMPANIA.fecha_sorteo },
    progreso: { total_aprobado: "380.00", puntos: 1, participaciones: 1, sobrante: "180.00", faltan: "20.00", pendientes: 0 },
    pases: { google: googleEmitido ? "SINCRONIZADO" : "SIN_EMITIR", apple: "NO_DISPONIBLE" },
  });

  return {
    async campania() {
      await pausa();
      return CAMPANIA;
    },
    async registro(datos) {
      await pausa();
      nombre = datos.nombres.split(" ")[0] || nombre;
      return desafio(datos.canal);
    },
    async verificar(_desafio, codigo) {
      await pausa();
      if (codigo !== CODIGO_SIMULADO) {
        throw new Error_(400, "codigo_incorrecto", `Código incorrecto (en simulación usa ${CODIGO_SIMULADO}). Te quedan 4 intento(s).`);
      }
      tieneSesion = true;
      return { sesion: "sesion-simulada", tarjeta: tarjeta() };
    },
    async reenviar() {
      await pausa();
      return desafio("CORREO");
    },
    async recuperar(contacto) {
      await pausa();
      return desafio(contacto.includes("@") ? "CORREO" : "CELULAR");
    },
    async miTarjeta() {
      await pausa();
      if (!tieneSesion && !localStorage.getItem("paseo_tarjeta_sesion")) {
        throw new Error_(401, "sesion_invalida", "Tu sesión venció. Recupera tu tarjeta.");
      }
      return tarjeta();
    },
    async googleWallet() {
      await pausa(600);
      googleEmitido = true;
      return { url: "#simulado", estado: "SINCRONIZADO" };
    },
    async cerrarSesion() {
      await pausa(100);
      tieneSesion = false;
    },
  };
}
