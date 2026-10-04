import { useState } from "react";
import { api, qs } from "../api";

const DIAS = [[7, "7 días"], [30, "30 días"], [90, "90 días"]];

/** Fecha local AAAA-MM-DD (la API filtra por día). */
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const rango = (dias) => {
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - (dias - 1) * 86400000);
  return { desde: iso(desde), hasta: iso(hasta) };
};

/** CSV que Excel abre bien (UTF-8 con BOM, separador de coma, comillas escapadas). */
function descargar(nombre, columnas, filas) {
  const celda = (v) => {
    const t = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const texto = [columnas.map(([, t]) => celda(t)).join(","), ...filas.map((f) => columnas.map(([k]) => celda(typeof k === "function" ? k(f) : f[k])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + texto], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

/** Todas las páginas de un listado paginado (20 por página). */
async function todas(ruta, paramsBase = {}) {
  const filas = [];
  for (let pagina = 1; pagina <= 50; pagina++) {
    const r = await api(`${ruta}${qs({ ...paramsBase, page: pagina })}`);
    filas.push(...(r.results || []));
    if (!r.next) break;
  }
  return filas;
}

const REPORTES = [
  {
    id: "pedidos", titulo: "Pedidos de comida", icono: "shopping_bag",
    texto: "Todos los pedidos de PaseoYa: negocio, cliente, productos, total, pago, retiro y estado.",
    sinPeriodo: true,
    generar: async () => {
      const filas = await todas("/admin/pedidos/");
      descargar("pedidos.csv", [
        ["codigo_retiro", "Código"], ["creado_en", "Creado"], ["empresa_nombre", "Negocio"], ["cliente_nombre", "Cliente"],
        ["cliente_email", "Correo"], [(f) => f.items.map((i) => `${i.cantidad}x ${i.producto_nombre}`).join(" | "), "Productos"],
        ["total", "Total Bs"], ["estado_display", "Estado"], [(f) => (f.pagado_en ? "Sí" : "No"), "Pagado"],
        [(f) => f.retiro_programado || "Lo antes posible", "Retiro"],
      ], filas);
      return filas.length;
    },
  },
  {
    id: "negocios", titulo: "Actividad por negocio", icono: "storefront",
    texto: "Compras aprobadas, monto, monedas entregadas, clientes y % de rechazo de cada establecimiento.",
    generar: async (p) => {
      const filas = await api(`/admin/reportes/empresas/ranking/${qs(p)}`);
      descargar("actividad_negocios.csv", [
        ["nombre", "Establecimiento"], ["tipo", "Tipo"], ["compras", "Compras"], ["rechazadas", "Rechazadas"],
        ["monto", "Monto Bs"], ["puntos", "Monedas entregadas"], ["clientes", "Clientes"], ["tasa_rechazo", "% rechazo"], ["ultima_compra", "Última compra"],
      ], filas);
      return filas.length;
    },
  },
  {
    id: "clientes", titulo: "Clientes más activos", icono: "group",
    texto: "Los 200 clientes con más visitas: compras, monto, monedas y de dónde son.",
    generar: async (p) => {
      const filas = await api(`/admin/reportes/clientes/frecuentes/${qs({ ...p, limite: 200 })}`);
      descargar("clientes_activos.csv", [
        [(f) => `${f.first_name} ${f.last_name}`.trim(), "Cliente"], ["email", "Correo"], ["procedencia_nombre", "Procedencia"],
        ["total_visitas", "Visitas"], ["total_compras", "Compras"], ["total_monto", "Monto Bs"], ["puntos_saldo", "Monedas"],
      ], filas);
      return filas.length;
    },
  },
  {
    id: "perfil", titulo: "Perfil de los clientes", icono: "diversity_3",
    texto: "Clientes por rango de edad y por ocupación, con visitas, compras y monto.",
    generar: async (p) => {
      const d = await api(`/admin/reportes/clientes/perfil/${qs(p)}`);
      const filas = [
        ...d.por_edad.map((f) => ({ ...f, grupo: "Edad" })),
        ...d.por_ocupacion.map((f) => ({ ...f, grupo: "Ocupación" })),
      ];
      descargar("perfil_clientes.csv", [
        ["grupo", "Segmento"], ["nombre", "Grupo"], ["clientes", "Clientes"], ["visitas", "Visitas"], ["compras", "Compras"], ["monto", "Monto Bs"],
      ], filas);
      return filas.length;
    },
  },
  {
    id: "procedencia", titulo: "Procedencia de los clientes", icono: "location_on",
    texto: "De dónde vienen los clientes (provincias de Cochabamba u otro lugar) y cuánto compran.",
    generar: async (p) => {
      const d = await api(`/admin/reportes/clientes/procedencia/${qs(p)}`);
      descargar("procedencia_clientes.csv", [
        ["nombre", "Procedencia"], ["clientes", "Clientes"], ["visitas", "Visitas"], ["compras", "Compras"], ["monto", "Monto Bs"], ["monedas", "Monedas"],
      ], d.procedencias);
      return d.procedencias.length;
    },
  },
  {
    id: "auditoria", titulo: "Auditoría", icono: "verified_user",
    texto: "Los últimos movimientos del Paseo con quién los hizo.",
    sinPeriodo: true,
    generar: async () => {
      const d = await api("/admin/reportes/auditoria/");
      descargar("auditoria.csv", [
        ["cuando", "Cuándo"], ["tipo_nombre", "Módulo"], ["titulo", "Qué pasó"], ["detalle", "Detalle"], ["actor", "Quién"],
      ], d.eventos);
      return d.eventos.length;
    },
  },
];

/** Reportes para llevar a Excel: se descargan como CSV con lo que ya muestra el sistema. */
export default function Reportes() {
  const [dias, setDias] = useState(30);
  const [estado, setEstado] = useState({}); // id → "cargando" | "N filas" | error

  const bajar = async (r) => {
    setEstado((e) => ({ ...e, [r.id]: "Generando…" }));
    try {
      const n = await r.generar(rango(dias));
      setEstado((e) => ({ ...e, [r.id]: n ? `✓ Descargado (${n} filas)` : "No hay datos en este periodo" }));
    } catch (err) {
      setEstado((e) => ({ ...e, [r.id]: err.message || "No se pudo generar" }));
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reportes</h1>
          <p>Descarga la información del Paseo en archivos que abre Excel. Los números son los mismos del Dashboard.</p>
        </div>
        <div className="segmented" aria-label="Periodo">
          {DIAS.map(([d, t]) => <button key={d} aria-pressed={dias === d} onClick={() => setDias(d)}>{t}</button>)}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {REPORTES.map((r) => (
          <section key={r.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span className="material-symbols-outlined" style={{ color: "var(--brand)" }}>{r.icono}</span>
              <h2 style={{ margin: 0 }}>{r.titulo}</h2>
            </div>
            <p className="sub" style={{ margin: 0, flex: 1 }}>{r.texto}</p>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>{r.sinPeriodo ? "Todo el historial" : `Últimos ${dias} días`}</p>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn" onClick={() => bajar(r)} disabled={estado[r.id] === "Generando…"}>Descargar Excel</button>
              {estado[r.id] && <span className="muted">{estado[r.id]}</span>}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
