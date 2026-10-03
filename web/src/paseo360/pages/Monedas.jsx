import { useEffect, useState } from "react";
import { api } from "../api";
import Crud, { activo } from "../Crud";
import { useApi } from "../ui";

const CATEGORIAS_RECOMPENSA = [
  ["PARQUEO", "Parqueo"], ["CINE", "Cine"], ["DESCUENTO", "Descuento"], ["PRODUCTO", "Producto"], ["OTRO", "Otro"],
];
const m = (v) => Number(v || 0).toLocaleString("es-BO", { maximumFractionDigits: 2 });

/** Reglas globales: valor de la moneda y visitas. */
function Configuracion() {
  const config = useApi("/admin/configuracion-puntos/");
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [errores, setErrores] = useState({});

  useEffect(() => {
    if (config.data) setForm(config.data);
  }, [config.data]);

  const guardar = async (e) => {
    e.preventDefault();
    setMsg(null);
    setErrores({});
    try {
      const { actualizado_en, ...body } = form;
      setForm(await api("/admin/configuracion-puntos/", { method: "PUT", body }));
      setMsg("Configuración guardada.");
    } catch (err) {
      setErrores({ ...err.fields, general: err.message });
    }
  };

  if (!form) return <section className="card" style={{ marginBottom: 14 }}><div className="empty">Cargando…</div></section>;
  const campo = (k, label, ayuda, step = "0.01") => (
    <label className="campo">
      <span>{label}</span>
      <input className="input" type="number" step={step} min="0" value={form[k] ?? ""}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
      {ayuda && <small className="muted">{ayuda}</small>}
      {errores[k] && <small className="error">{[].concat(errores[k]).join(" ")}</small>}
    </label>
  );

  return (
    <section className="card" style={{ marginBottom: 14 }}>
      <h2>Reglas de las monedas</h2>
      <p className="sub">
        1 moneda = Bs {m(form.valor_moneda_bs)} · Visita: {m(form.puntos_por_visita)} monedas cada {form.horas_entre_visitas} h
      </p>
      <form onSubmit={guardar} className="crud-form">
        <div className="crud-grid">
          {campo("valor_moneda_bs", "Valor de 1 moneda (Bs)")}
          {campo("puntos_por_visita", "Monedas por visita", "NFC de la puerta o registro del portero")}
          {campo("horas_entre_visitas", "Horas entre visitas", "Tras escanear, no vuelve a ganar hasta que pasen", "1")}
          {campo("monto_maximo_solicitud", "Monto máximo por compra (Bs)")}
          {campo("solicitudes_diarias_por_empresa", "Compras por día en un negocio", null, "1")}
          {campo("puntos_por_boliviano", "Monedas por Bs (solo sin rangos)", "Se usa únicamente si no hay rangos de compra")}
        </div>
        {errores.general && <p className="error">{errores.general}</p>}
        <button className="btn">Guardar reglas</button>
        {msg && <span className="muted" style={{ marginLeft: 10 }}>{msg}</span>}
      </form>
    </section>
  );
}

export default function Monedas() {
  const empresas = useApi("/admin/empresas/");
  const opcionesEmpresas = (empresas.data?.results || []).map((e) => [e.id, e.nombre]);
  const [copiado, setCopiado] = useState(null);

  const copiar = async (punto) => {
    try {
      await navigator.clipboard.writeText(punto.enlace);
      setCopiado(punto.id);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      window.prompt("Copia el enlace para grabarlo en el NFC:", punto.enlace);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Monedas</h1>
          <p>Cómo ganan y canjean monedas los clientes del Paseo</p>
        </div>
      </div>

      <Configuracion />

      <Crud
        titulo="Rangos de compra"
        subtitulo="Monedas que da una compra aprobada en caja según su monto."
        endpoint="/admin/rangos-compra/"
        textoNuevo="Agregar rango"
        nombreFila={(f) => `Bs ${m(f.monto_minimo)} – ${f.monto_maximo ? `Bs ${m(f.monto_maximo)}` : "más"}`}
        inicial={{ monto_minimo: "", monto_maximo: "", monedas: "", activo: true }}
        campos={[
          { k: "monto_minimo", label: "Desde (Bs)", tipo: "decimal", requerido: true },
          { k: "monto_maximo", label: "Hasta (Bs)", tipo: "decimal", ayuda: "Vacío = sin tope" },
          { k: "monedas", label: "Monedas", tipo: "decimal", requerido: true },
          { k: "activo", label: "Activo", tipo: "checkbox" },
        ]}
        columnas={[
          { label: "Desde", render: (f) => `Bs ${m(f.monto_minimo)}`, num: true },
          { label: "Hasta", render: (f) => (f.monto_maximo ? `Bs ${m(f.monto_maximo)}` : "sin tope"), num: true },
          { label: "Monedas", render: (f) => <strong>{m(f.monedas)}</strong>, num: true },
          { label: "Estado", render: activo },
        ]}
      />

      <Crud
        titulo="Puntos de escaneo (NFC / QR)"
        subtitulo="Puerta principal, juegos, cine… Copia el enlace y grábalo en el NFC (app NFC Tools) o imprímelo como QR."
        endpoint="/admin/puntos-escaneo/"
        textoNuevo="Agregar punto"
        inicial={{ nombre: "", tipo: "ACTIVIDAD", monedas: "0.50", horas_espera: 24, descripcion: "", activo: true }}
        campos={[
          { k: "nombre", label: "Nombre", requerido: true },
          { k: "tipo", label: "Tipo", tipo: "select", opciones: [["ENTRADA", "Entrada al Paseo"], ["ACTIVIDAD", "Actividad"]], requerido: true },
          { k: "monedas", label: "Monedas", tipo: "decimal", requerido: true },
          { k: "horas_espera", label: "Horas de espera", tipo: "number", ayuda: "Para Entrada se usa la regla de visitas" },
          { k: "empresa", label: "Opera (empresa)", tipo: "select", opciones: opcionesEmpresas },
          { k: "descripcion", label: "Descripción" },
          { k: "activo", label: "Activo", tipo: "checkbox" },
        ]}
        columnas={[
          { label: "Punto", render: (f) => <strong>{f.nombre}</strong> },
          { label: "Tipo", render: (f) => <span className="pill">{f.tipo === "ENTRADA" ? "Entrada" : "Actividad"}</span> },
          { label: "Monedas", render: (f) => m(f.monedas), num: true },
          { label: "Espera", render: (f) => `${f.horas_espera} h`, num: true },
          { label: "Enlace NFC/QR", render: (f) => <code style={{ fontSize: 12 }}>{f.enlace}</code> },
          { label: "Estado", render: activo },
        ]}
        acciones={(f) => (
          <>
            <button className="btn ghost small" onClick={() => copiar(f)}>{copiado === f.id ? "¡Copiado!" : "Copiar enlace"}</button>{" "}
          </>
        )}
      />

      <Crud
        titulo="Recompensas"
        subtitulo="Lo que los clientes canjean con sus monedas: parqueo, cine, descuentos y productos."
        endpoint="/admin/recompensas/"
        textoNuevo="Agregar recompensa"
        inicial={{ nombre: "", categoria: "PRODUCTO", costo_puntos: "", descripcion: "", activo: true }}
        campos={[
          { k: "nombre", label: "Nombre", requerido: true },
          { k: "categoria", label: "Categoría", tipo: "select", opciones: CATEGORIAS_RECOMPENSA, requerido: true },
          { k: "costo_puntos", label: "Costo (monedas)", tipo: "decimal", requerido: true },
          { k: "empresa", label: "Negocio (vacío = todo el Paseo)", tipo: "select", opciones: opcionesEmpresas },
          { k: "descripcion", label: "Descripción", tipo: "textarea" },
          { k: "activo", label: "Activa", tipo: "checkbox" },
        ]}
        columnas={[
          { label: "Recompensa", render: (f) => <strong>{f.nombre}</strong> },
          { label: "Categoría", render: (f) => <span className="pill">{CATEGORIAS_RECOMPENSA.find(([k]) => k === f.categoria)?.[1]}</span> },
          { label: "Costo", render: (f) => `${m(f.costo_puntos)} monedas`, num: true },
          { label: "Negocio", render: (f) => f.empresa_nombre || <span className="muted">Todo el Paseo</span> },
          { label: "Estado", render: activo },
        ]}
      />
    </>
  );
}
