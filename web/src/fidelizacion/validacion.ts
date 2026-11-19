// Validación en la página, antes de enviar: dice en pocas palabras qué falta.
// Las mismas reglas (y los mismos textos) que el servidor, que sigue siendo quien decide.

import { BOLIVIA } from "./paises";

const NOMBRE = /^\p{L}+(?:[ '’\-.]+\p{L}+)*\.?$/u;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@.]+$/;

/** Deja pasar solo lo que puede llevar un celular: números (y, con «Otro país», el + del código). */
export function soloCelular(pais: string, texto: string): string {
  if (pais === "") {
    const limpio = texto.replace(/[^\d+ ]/g, "");
    return (limpio.slice(0, 1) + limpio.slice(1).replace(/\+/g, "")).slice(0, 20);
  }
  return texto.replace(/\D/g, "").slice(0, pais === BOLIVIA ? 8 : 13);
}

export function errorCelular(pais: string, numero: string): string | null {
  const texto = numero.trim();
  const digitos = texto.replace(/\D/g, "");
  if (!texto) return "Escribe tu celular.";
  if (pais === BOLIVIA) {
    if (digitos.length < 8) return "Celular incompleto.";
    return /^[67]/.test(digitos) ? null : "El celular empieza con 6 o 7.";
  }
  if (pais === "") {
    if (!texto.startsWith("+")) return "Agrega el código de tu país. Ej.: +44";
    if (digitos.length < 8) return "Celular incompleto.";
    return digitos.length > 15 ? "Revisa tu celular." : null;
  }
  return digitos.length < 6 ? "Celular incompleto." : null;
}

export function errorCorreo(correo: string): string | null {
  const texto = correo.trim();
  if (!texto) return "Escribe tu correo.";
  const [usuario, dominio = ""] = texto.split("@");
  if (!texto.includes("@") || !usuario || !dominio.includes(".") || dominio.endsWith(".")) return "Correo incompleto.";
  return CORREO.test(texto) ? null : "Revisa tu correo.";
}

export function errorNombre(valor: string): string | null {
  const texto = valor.trim().replace(/\s+/g, " ");
  if (!texto) return "Completa este campo.";
  if (texto.length < 2) return "Escribe al menos 2 letras.";
  return NOMBRE.test(texto.normalize("NFC")) ? null : "Usa solo letras.";
}
