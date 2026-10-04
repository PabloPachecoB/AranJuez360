import { useState } from "react";
import { api, qs } from "../api";
import { Estado, useApi } from "../ui";

const FILTROS = [
  ["PENDIENTE", "Por responder"],
  ["APROBADA", "Aprobadas"],
  ["USADA", "Ingresaron"],
  ["", "Todas"],
];
const COLORES = { PENDIENTE: "", APROBADA: "on", USADA: "", RECHAZADA: "off", CANCELADA: "off" };
const hoy = () => new Date().toISOString().slice(0, 10);
const VACIA = { modo: "app", cliente: "", visitante_nombre: "", visitante_ci: "", visitante_celular: "", fecha: hoy(), hora: "", motivo: "" };

function fechaHora(v) {
  const [a, m, d] = v.fecha.split("-");
  return `${d}/${m}/${a}${v.hora ? ` · ${v.hora.slice(0, 5)}` : ""}`;
}

/** Bandeja de la oficina: solicitudes de visitantes, invitaciones y el QR por WhatsApp. */
export default function Visitas() {
  const [estado, setEstado] = useState("PENDIENTE");
  const lista = useApi(`/mi-oficina/visitas/${qs({ estado })}`);
  const [form, setForm] = useState(null);
  const [creada, setCreada] = useState(null);
  const [msg, setMsg] = useState(null);
  const [errores, setErrores] = useState({});

  const responder = async (v, accion) => {
    setMsg(null);
    let body;
    if (accion === "rechazar") {
      const motivo = window.prompt("Motivo del rechazo (opcional):", "");
      if (motivo === null) return;
      body = { motivo };
    }
    try {
      const r = await api(`/mi-oficina/visitas/${v.id}/${accion}/`, { method: "POST", body });
      setMsg(accion === "aprobar" ? `Visita de ${r.visitante_nombre} aprobada.` : "Solicitud rechazada.");
      if (accion === "aprobar" && !r.tiene_app) setCreada(r);
      lista.recargar();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const invitar = async (e) => {
    e.preventDefault();
    setErrores({});
    const { modo, ...datos } = form;
    const body = modo === "app"
      ? { cliente: datos.cliente, fecha: datos.fecha, hora: datos.hora || null, motivo: datos.motivo }
      : { ...datos, cliente: "", hora: datos.hora || null };
    try {
      const r = await api("/mi-oficina/visitas/", { method: "POST", body });
      setCreada(r);
      setForm(null);
      setEstado("APROBADA");
      lista.recargar();
    } catch (err) {
      setErrores({ ...err.fields, general: err.message });
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const filas = lista.data?.results || [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Visitas</h1>
          <p>Aprueba a quien quiere visitarte o invita tú. El guardia escanea el QR en la entrada.</p>
        </div>
        <button className="btn" onClick={() => { setForm(form ? null : VACIA); setCreada(null); }}>
          {form ? "Cancelar" : "Invitar a alguien"}
        </button>
      </div>

      {form && (
        <form className="card" onSubmit={invitar} style={{ marginBottom: 14 }}>
          <h2>Nueva invitación</h2>
          <div className="segmented" style={{ margin: "8px 0 12px" }}>
            <button type="button" aria-pressed={form.modo === "app"} onClick={() => setForm({ ...form, modo: "app" })}>Tiene la app</button>
            <button type="button" aria-pressed={form.modo === "whatsapp"} onClick={() => setForm({ ...form, modo: "whatsapp" })}>No tiene app (WhatsApp)</button>
          </div>
          <div className="crud-grid">
            {form.modo === "app" ? (
              <label className="campo"><span>Correo o CI del cliente *</span>
                <input className="input" value={form.cliente} onChange={set("cliente")} required /></label>
            ) : (
              <>
                <label className="campo"><span>Nombre completo *</span>
                  <input className="input" value={form.visitante_nombre} onChange={set("visitante_nombre")} required /></label>
                <label className="campo"><span>Celular (WhatsApp) *</span>
                  <input className="input" value={form.visitante_celular} onChange={set("visitante_celular")} placeholder="71234567" required /></label>
                <label className="campo"><span>CI</span>
                  <input className="input" value={form.visitante_ci} onChange={set("visitante_ci")} /></label>
              </>
            )}
            <label className="campo"><span>Fecha *</span>
              <input className="input" type="date" value={form.fecha} min={hoy()} onChange={set("fecha")} required /></label>
            <label className="campo"><span>Hora</span>
              <input className="input" type="time" value={form.hora} onChange={set("hora")} /></label>
            <label className="campo"><span>Motivo</span>
              <input className="input" value={form.motivo} onChange={set("motivo")} /></label>
          </div>
          {errores.general && <p className="error">{errores.general}</p>}
          <button className="btn">Crear invitación</button>
        </form>
      )}

      {creada && (
        <section className="card aviso-ok" style={{ marginBottom: 14 }}>
          <h2>Invitación lista: {creada.visitante_nombre}</h2>
          <p className="sub">Código <strong>{creada.codigo}</strong> · {fechaHora(creada)}</p>
          {creada.tiene_app ? (
            <p>Le aparece en “Mis visitas” de su app con el QR para el guardia.</p>
          ) : (
            <div className="filters">
              {creada.whatsapp && <a className="btn" href={creada.whatsapp} target="_blank" rel="noreferrer">Enviar QR por WhatsApp</a>}
              <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(creada.enlace)}>Copiar enlace</button>
              <a className="btn ghost" href={creada.enlace} target="_blank" rel="noreferrer">Ver invitación</a>
            </div>
          )}
        </section>
      )}
      {msg && <p className="muted">{msg}</p>}

      <div className="filters">
        <div className="segmented">
          {FILTROS.map(([k, t]) => (
            <button key={k} aria-pressed={estado === k} onClick={() => setEstado(k)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <Estado cargando={lista.cargando && !lista.data} error={lista.error} vacio={false}>
          {filas.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Visitante</th><th>CI</th><th>Cuándo</th><th>Motivo</th><th>Origen</th><th>Estado</th><th /></tr></thead>
                <tbody>
                  {filas.map((v) => (
                    <tr key={v.id}>
                      <td><strong>{v.visitante_nombre}</strong>{!v.tiene_app && <span className="muted"> · sin app</span>}</td>
                      <td>{v.visitante_ci || "—"}</td>
                      <td>{fechaHora(v)}</td>
                      <td>{v.motivo || <span className="muted">—</span>}</td>
                      <td><span className="pill">{v.origen === "SOLICITUD" ? "La pidió" : "Invitado"}</span></td>
                      <td><span className={`pill ${COLORES[v.estado]}`}>{v.estado_nombre}</span></td>
                      <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                        {v.estado === "PENDIENTE" && (
                          <>
                            <button className="btn small" onClick={() => responder(v, "aprobar")}>Aprobar</button>{" "}
                            <button className="btn ghost small" onClick={() => responder(v, "rechazar")}>Rechazar</button>
                          </>
                        )}
                        {v.estado === "APROBADA" && v.whatsapp && (
                          <a className="btn ghost small" href={v.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty">No hay visitas en esta lista.</div>}
        </Estado>
      </div>
    </>
  );
}
