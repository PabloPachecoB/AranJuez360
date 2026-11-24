import type { CampaniaFidelizacion, CompraFidelizacion, ParticipanteFidelizacion } from "./tipos";

export const CAMPANIAS_DEMO: CampaniaFidelizacion[] = [
  { id: "sorteo-paseo-demo", nombre: "Sorteo Paseo · DEMO" },
  { id: "temporada-demo", nombre: "Temporada de premios · DEMO" },
];

function crearParticipante(indice: number, campaniaId: string): ParticipanteFidelizacion {
  const correlativo = String(indice + 1).padStart(3, "0");
  const montoAprobadoBs = indice === 49 ? 0 : 425 + (indice * 83);
  const puntos = Math.floor(montoAprobadoBs / 200);

  return {
    id: `demo-${correlativo}`,
    nombre: `Participante DEMO ${correlativo}`,
    correo: `participante.demo.${correlativo}@example.test`,
    celular: `DEMO 700 000 ${correlativo}`,
    codigo: `DEMO-${correlativo}`,
    puntos,
    participaciones: puntos,
    montoAprobadoBs,
    sobranteBs: montoAprobadoBs % 200,
    campaniaId,
  };
}

export const PARTICIPANTES_DEMO: ParticipanteFidelizacion[] = [
  ...Array.from({ length: 25 }, (_, indice) => crearParticipante(indice, CAMPANIAS_DEMO[0].id)),
  ...Array.from({ length: 25 }, (_, indice) => crearParticipante(indice + 25, CAMPANIAS_DEMO[1].id)),
];

function fechaCompra(indice: number, secuencia: number) {
  return new Date(Date.UTC(2026, 0, 1 + (indice * 4) + secuencia)).toISOString().slice(0, 10);
}

type CompraBaseDemo = Omit<CompraFidelizacion, "imagenEstado" | "ocrEstado" | "ocrTexto">;

function crearCompras(participante: ParticipanteFidelizacion, indice: number): CompraBaseDemo[] {
  if (participante.montoAprobadoBs === 0) return [];

  const montoDevuelto = indice % 8 === 0 ? 60 + ((indice % 5) * 10) : 0;
  const base = Math.floor(participante.montoAprobadoBs / 6);
  const resto = participante.montoAprobadoBs % 6;
  const correlativo = String(indice + 1).padStart(3, "0");
  const localNombre = ["Cafetería DEMO", "Librería DEMO", "Mercado DEMO"][indice % 3];
  const compras: CompraBaseDemo[] = Array.from({ length: 6 }, (_, secuencia) => {
    const fecha = fechaCompra(indice, secuencia);
    return {
      id: `demo-compra-${correlativo}-${secuencia + 1}`,
      participanteId: participante.id,
      campaniaId: participante.campaniaId,
      localNombre,
      fecha,
      numeroComprobante: `DEMO-${correlativo}-${String(secuencia + 1).padStart(2, "0")}`,
      montoBs: base + (secuencia < resto ? 1 : 0),
      estado: "APROBADA",
      operador: "Operador DEMO",
      fechaAprobacion: `${fecha}T16:00:00.000Z`,
    };
  });

  if (montoDevuelto) {
    const fecha = fechaCompra(indice, 7);
    compras.push({
      id: `demo-compra-${correlativo}-devuelta`,
      participanteId: participante.id,
      campaniaId: participante.campaniaId,
      localNombre,
      fecha,
      numeroComprobante: `DEMO-${correlativo}-DEV`,
      montoBs: montoDevuelto,
      estado: "DEVUELTA",
      operador: "Operador DEMO",
      fechaAprobacion: `${fecha}T16:00:00.000Z`,
    });
  }

  if (indice % 5 === 1) {
    const fecha = fechaCompra(indice, 8);
    compras.push({
      id: `demo-compra-${correlativo}-pendiente`,
      participanteId: participante.id,
      campaniaId: participante.campaniaId,
      localNombre,
      fecha,
      numeroComprobante: `DEMO-${correlativo}-PEN`,
      montoBs: 175,
      estado: "PENDIENTE",
      operador: null,
      fechaAprobacion: null,
    });
  }

  if (indice % 7 === 2) {
    const fecha = fechaCompra(indice, 9);
    compras.push({
      id: `demo-compra-${correlativo}-rechazada`,
      participanteId: participante.id,
      campaniaId: participante.campaniaId,
      localNombre,
      fecha,
      numeroComprobante: `DEMO-${correlativo}-REC`,
      montoBs: 210,
      estado: "RECHAZADA",
      operador: "Operador DEMO",
      fechaAprobacion: null,
    });
  }

  return compras.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
}

const COMPRAS_BASE_DEMO: CompraBaseDemo[] = PARTICIPANTES_DEMO.flatMap((participante, indice) =>
  crearCompras(participante, indice),
);

function lecturaDemo(compra: CompraBaseDemo): Pick<CompraFidelizacion, "imagenEstado" | "ocrEstado" | "ocrTexto"> {
  if (compra.id === "demo-compra-001-2") {
    return { imagenEstado: "disponible", ocrEstado: "COMPLETADO", ocrTexto: null };
  }
  if (compra.id === "demo-compra-001-3") {
    return { imagenEstado: "disponible", ocrEstado: "PROCESANDO", ocrTexto: null };
  }
  if (compra.id === "demo-compra-002-pendiente") {
    return {
      imagenEstado: "fallida",
      ocrEstado: "COMPLETADO",
      ocrTexto: `COMPROBANTE DEMO ${compra.numeroComprobante} · ${compra.localNombre} · Bs ${compra.montoBs}`,
    };
  }
  if (compra.id === "demo-compra-003-rechazada") {
    return { imagenEstado: "disponible", ocrEstado: "FALLIDO", ocrTexto: null };
  }
  if (compra.estado === "PENDIENTE") {
    return { imagenEstado: "disponible", ocrEstado: "PENDIENTE", ocrTexto: null };
  }
  return {
    imagenEstado: "disponible",
    ocrEstado: "COMPLETADO",
    ocrTexto: `COMPROBANTE DEMO ${compra.numeroComprobante} · ${compra.localNombre} · ${compra.fecha} · Bs ${compra.montoBs}`,
  };
}

export const COMPRAS_DEMO: CompraFidelizacion[] = COMPRAS_BASE_DEMO.map((compra) => ({
  ...compra,
  ...lecturaDemo(compra),
}));
