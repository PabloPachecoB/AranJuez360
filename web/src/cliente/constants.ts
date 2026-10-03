export const NIVELES_CLIENTE = [
  { nombre: "Bronce", desde: 0, multiplicador: "1×", color: "#a45c3d" },
  { nombre: "Plata", desde: 500, multiplicador: "1.1×", color: "#61717c" },
  { nombre: "Oro", desde: 1000, multiplicador: "1.2×", color: "#b07a19" },
  { nombre: "Platinum", desde: 2000, multiplicador: "1.5×", color: "#091734" },
] as const;

export const UMBRALES_RECOMPENSA = [300, 500, 700, 1000, 1500] as const;

export function nivelParaSaldo(saldo: number) {
  const indice = NIVELES_CLIENTE.reduce((actual, nivel, i) => (saldo >= nivel.desde ? i : actual), 0);
  const actual = NIVELES_CLIENTE[indice];
  const siguiente = NIVELES_CLIENTE[indice + 1] ?? null;
  const progreso = siguiente ? Math.min(1, (saldo - actual.desde) / (siguiente.desde - actual.desde)) : 1;
  return { actual, siguiente, progreso };
}