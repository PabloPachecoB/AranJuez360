/** Códigos de país más probables entre quienes visitan el Paseo. «Otro» deja escribir cualquiera. */
export const PAISES = [
  { codigo: "+591", iso: "BO", nombre: "Bolivia" },
  { codigo: "+54", iso: "AR", nombre: "Argentina" },
  { codigo: "+55", iso: "BR", nombre: "Brasil" },
  { codigo: "+56", iso: "CL", nombre: "Chile" },
  { codigo: "+57", iso: "CO", nombre: "Colombia" },
  { codigo: "+593", iso: "EC", nombre: "Ecuador" },
  { codigo: "+34", iso: "ES", nombre: "España" },
  { codigo: "+1", iso: "US", nombre: "Estados Unidos y Canadá" },
  { codigo: "+52", iso: "MX", nombre: "México" },
  { codigo: "+595", iso: "PY", nombre: "Paraguay" },
  { codigo: "+51", iso: "PE", nombre: "Perú" },
  { codigo: "+598", iso: "UY", nombre: "Uruguay" },
  { codigo: "+58", iso: "VE", nombre: "Venezuela" },
  { codigo: "", iso: "", nombre: "Otro país" },
] as const;
export const BOLIVIA = "+591";

/** El número como lo espera el servidor: Bolivia sin código; otro país, con el suyo delante. */
export function celularConCodigo(pais: string, numero: string): string {
  const limpio = numero.trim();
  if (pais === BOLIVIA || pais === "" || limpio.startsWith("+") || limpio.startsWith("00")) return limpio;
  return `${pais}${limpio}`;
}

/** Ayuda y ejemplo del campo de celular según el país elegido. */
export function ayudaCelular(pais: string): { ayuda: string; ejemplo: string } {
  if (pais === BOLIVIA) return { ayuda: "8 dígitos.", ejemplo: "71234567" };
  if (pais === "") return { ayuda: "Con el código de tu país. Ej.: +44 7911 123456", ejemplo: "+44 7911 123456" };
  return { ayuda: "Tu número, sin el código de país.", ejemplo: "Tu número" };
}
