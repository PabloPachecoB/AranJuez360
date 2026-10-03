import { useState } from "react";
import { api } from "./api";
import { Estado, useApi } from "./ui";

/**
 * Tabla + formulario de alta/edición/baja para un recurso del admin.
 *
 * campos: [{ k, label, tipo: "text"|"textarea"|"number"|"decimal"|"select"|"datetime"|"date"|"time"|"checkbox",
 *            opciones: [[valor, texto]], requerido, ayuda }]
 * columnas: [{ label, render: (fila) => nodo, num }]
 */
export default function Crud({ titulo, subtitulo, endpoint, campos, columnas, inicial, nombreFila = (f) => f.nombre,
  textoNuevo = "Agregar", acciones }) {
  const lista = useApi(endpoint);
  const [form, setForm] = useState(null); // null = cerrado; { id?, ...valores }
  const [errores, setErrores] = useState({});
  const [msg, setMsg] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const filas = Array.isArray(lista.data) ? lista.data : lista.data?.results || [];
  const base = endpoint.split("?")[0];

  const abrir = (fila) => {
    setErrores({});
    setMsg(null);
    if (!fila) return setForm({ ...inicial });
    const valores = { id: fila.id };
    campos.forEach((c) => {
      let v = fila[c.k];
      if (c.tipo === "datetime" && v) v = aLocal(v);
      valores[c.k] = v ?? (c.tipo === "checkbox" ? false : "");
    });
    setForm(valores);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErrores({});
    const body = {};
    campos.forEach((c) => {
      const v = form[c.k];
      const vacio = v === "" || v === undefined || v === null;
      if (c.tipo === "checkbox") body[c.k] = Boolean(v);
      // Texto vacío va como "" (el backend no acepta null ahí); números, fechas y selects vacíos, como null.
      else if (!c.tipo || c.tipo === "text" || c.tipo === "textarea") body[c.k] = vacio ? "" : v;
      else body[c.k] = vacio ? null : v;
    });
    try {
      if (form.id) await api(`${base}${form.id}/`, { method: "PATCH", body });
      else await api(base, { method: "POST", body });
      setMsg(form.id ? "Cambios guardados." : "Creado correctamente.");
      setForm(null);
      lista.recargar();
    } catch (err) {
      setErrores({ ...err.fields, general: err.message });
    } finally {
      setEnviando(false);
    }
  };

  const eliminar = async (fila) => {
    if (!window.confirm(`¿Eliminar "${nombreFila(fila)}"? No se puede deshacer.`)) return;
    try {
      await api(`${base}${fila.id}/`, { method: "DELETE" });
      lista.recargar();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const set = (c) => (e) => setForm({ ...form, [c.k]: c.tipo === "checkbox" ? e.target.checked : e.target.value });

  return (
    <section className="card" style={{ marginBottom: 14 }}>
      <div className="page-head" style={{ marginBottom: 10 }}>
        <div>
          <h2>{titulo}</h2>
          {subtitulo && <p className="sub" style={{ margin: 0 }}>{subtitulo}</p>}
        </div>
        <button className="btn" onClick={() => (form ? setForm(null) : abrir(null))}>
          {form ? "Cancelar" : textoNuevo}
        </button>
      </div>

      {form && (
        <form onSubmit={guardar} className="crud-form">
          <div className="crud-grid">
            {campos.map((c) => (
              <label key={c.k} className={`campo ${c.tipo === "textarea" ? "ancho" : ""} ${c.tipo === "checkbox" ? "check" : ""}`}>
                <span>{c.label}{c.requerido ? " *" : ""}</span>
                {c.tipo === "textarea" ? (
                  <textarea className="input" rows={3} value={form[c.k] ?? ""} onChange={set(c)} required={c.requerido} />
                ) : c.tipo === "select" ? (
                  <select className="select" value={form[c.k] ?? ""} onChange={set(c)} required={c.requerido}>
                    {!c.requerido && <option value="">—</option>}
                    {(c.opciones || []).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                ) : c.tipo === "checkbox" ? (
                  <input type="checkbox" checked={Boolean(form[c.k])} onChange={set(c)} />
                ) : (
                  <input
                    className="input"
                    type={{ datetime: "datetime-local", date: "date", time: "time", number: "number", decimal: "number" }[c.tipo] || "text"}
                    step={c.tipo === "decimal" ? "0.01" : undefined}
                    min={c.tipo === "number" || c.tipo === "decimal" ? "0" : undefined}
                    value={form[c.k] ?? ""}
                    onChange={set(c)}
                    required={c.requerido}
                  />
                )}
                {c.ayuda && <small className="muted">{c.ayuda}</small>}
                {errores[c.k] && <small className="error">{[].concat(errores[c.k]).join(" ")}</small>}
              </label>
            ))}
          </div>
          {errores.general && <p className="error">{errores.general}</p>}
          <button className="btn" disabled={enviando}>{enviando ? "Guardando…" : form.id ? "Guardar cambios" : "Crear"}</button>
        </form>
      )}
      {msg && <p className="muted">{msg}</p>}

      <Estado cargando={lista.cargando && !lista.data} error={lista.error} vacio={false}>
        {filas.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>{columnas.map((c) => <th key={c.label} className={c.num ? "num" : ""}>{c.label}</th>)}<th /></tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id}>
                    {columnas.map((c) => <td key={c.label} className={c.num ? "num" : ""}>{c.render(f)}</td>)}
                    <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                      {acciones?.(f)}
                      <button className="btn ghost small" onClick={() => abrir(f)}>Editar</button>{" "}
                      <button className="btn ghost small" onClick={() => eliminar(f)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">Todavía no hay registros. Usa “{textoNuevo}”.</div>
        )}
      </Estado>
    </section>
  );
}

/** ISO con zona → valor de <input type="datetime-local"> en hora local. */
function aLocal(iso) {
  const d = new Date(iso);
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

export const activo = (f) => <span className={`pill ${f.activo ? "on" : "off"}`}>{f.activo ? "● Activo" : "○ Inactivo"}</span>;
