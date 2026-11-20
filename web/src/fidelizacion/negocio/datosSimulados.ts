// Datos de mentira: todavía no existe el endpoint que resuelva un código a su
// cliente real ni el que registre una compra (es tarea de "Backend compartido
// de fidelización", sin asignar — ver docs/FIDELIZACION_EQUIPO.md). Esto
// simula los 3 casos que pide la issue #45: código válido, código revocado y
// compra duplicada.
import type { ClienteResuelto, CompraRegistrada } from "./tipos";

const CLIENTES_DEMO: Record<string, ClienteResuelto> = {
  "PA-TEST01": { codigo: "PA-TEST01", nombreReducido: "María G." },
  "PA-7K3M9X": { codigo: "PA-7K3M9X", nombreReducido: "Alan M." },
};

const CODIGOS_REVOCADOS = new Set(["PA-REVOCADO"]);

const comprasYaRegistradas = new Set<string>();

let historial: CompraRegistrada[] = [
  {
    id: "demo-1",
    codigo: "PA-TEST01",
    nombreReducido: "María G.",
    monto: 150,
    fecha: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    estadoSincronizacion: "sincronizado",
  },
];

/** Simula GET /sorteo-paseo/negocio/resolver/<codigo>/ — cliente real, revocado o inexistente. */
export function resolverCodigo(codigo: string): Promise<ClienteResuelto> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (CODIGOS_REVOCADOS.has(codigo)) {
        reject(new Error("Este código fue revocado. No se puede registrar la compra."));
        return;
      }
      const cliente = CLIENTES_DEMO[codigo];
      if (!cliente) {
        reject(new Error("Código no encontrado. Verifica que esté bien escrito o pide que lo vuelvan a mostrar."));
        return;
      }
      resolve(cliente);
    }, 500);
  });
}

/** Simula POST /sorteo-paseo/negocio/compras/ — detecta si ya se registró la misma compra. */
export function registrarCompra(codigo: string, nombreReducido: string, monto: number): Promise<CompraRegistrada> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const clave = `${codigo}:${monto}`;
      if (comprasYaRegistradas.has(clave)) {
        reject(new Error("Ya registraste una compra por ese mismo monto para este cliente hace un momento. ¿Seguro que no está duplicada?"));
        return;
      }
      comprasYaRegistradas.add(clave);
      const compra: CompraRegistrada = {
        id: `demo-${Date.now()}`,
        codigo,
        nombreReducido,
        monto,
        fecha: new Date().toISOString(),
        estadoSincronizacion: "sincronizado",
      };
      historial = [compra, ...historial];
      resolve(compra);
    }, 700);
  });
}

export function obtenerHistorialLocal(): CompraRegistrada[] {
  return historial;
}
