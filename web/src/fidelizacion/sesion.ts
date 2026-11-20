// La sesión del titular de la tarjeta es independiente de la de los paneles (admin, negocio, caja).
// El almacenamiento del navegador puede fallar (modo privado, datos bloqueados): todo va en try/catch.

import type { Desafio } from "./tipos";

const CLAVE_SESION = "paseo_tarjeta_sesion";
const CLAVE_DESAFIO = "paseo_tarjeta_desafio";

export interface DesafioPendiente extends Desafio {
  /** Cuándo se pidió el código, para la cuenta regresiva de reenvío. */
  creado_en: number;
}

function leer(almacen: Storage | undefined, clave: string): string | null {
  try {
    return almacen?.getItem(clave) ?? null;
  } catch {
    return null;
  }
}

function escribir(almacen: Storage | undefined, clave: string, valor: string | null) {
  try {
    if (valor === null) almacen?.removeItem(clave);
    else almacen?.setItem(clave, valor);
  } catch {
    // sin almacenamiento: la página sigue funcionando, solo se pierde la sesión al recargar
  }
}

export const sesionTarjeta = {
  obtener: () => leer(globalThis.localStorage, CLAVE_SESION),
  guardar: (token: string) => escribir(globalThis.localStorage, CLAVE_SESION, token),
  borrar: () => escribir(globalThis.localStorage, CLAVE_SESION, null),
};

export const desafioPendiente = {
  obtener(): DesafioPendiente | null {
    const crudo = leer(globalThis.sessionStorage, CLAVE_DESAFIO);
    if (!crudo) return null;
    try {
      const d = JSON.parse(crudo) as DesafioPendiente;
      return d && typeof d.desafio === "string" ? d : null;
    } catch {
      return null;
    }
  },
  guardar(d: Desafio) {
    const pendiente: DesafioPendiente = { ...d, creado_en: Date.now() };
    escribir(globalThis.sessionStorage, CLAVE_DESAFIO, JSON.stringify(pendiente));
  },
  borrar: () => escribir(globalThis.sessionStorage, CLAVE_DESAFIO, null),
};
