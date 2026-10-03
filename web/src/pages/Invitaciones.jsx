import { useState } from "react";
import { api, qs } from "../api";
import { Estado, useApi } from "../components/ui";
import { fecha, TIPOS } from "../format";

const VACIA = { email: "", tipo: "NEGOCIO", nombre_sugerido: "", categoria: "", empresa: "", mensaje: "" };
const FILTROS = [["PENDIENTE", "Pendientes"], ["ACEPTADA", "Aceptadas"], ["ANULADA", "Anuladas"], ["", "Todas"]];
const COLOR = { Pendiente: "", Aceptada: "on", Anulada: "off", Vencida: "off" };

/** Alta de empresas por invitación: solo quien recibe el correo puede crear su cuenta y su ficha. */
export default function Invitaciones() {
  const [estado, setEstado] = useState("PENDIENTE");
  const lista = useApi(`/admin/invitaciones-empresa/${qs({ estado })}`);
  const categorias = useApi("/categorias/");
  const empresas = useApi("/admin/empresas/");
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [msg, setMsg] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErrores({});
    setMsg(null);
    try {
      const body = { ...form, categoria: form.categoria || null, empresa: form.empresa || null };
      const r = await api("/admin/invitaciones-empresa/", { method: "POST", body });
      setMsg(`Invitación enviada a ${r.email}. Tiene 7 días para crear su cuenta.`);
      setForm(null);
      setEstado("PENDIENTE");
      lista.recargar();
    } catch (err) {
      setErrores({ ...err.fields, general: err.message });
    } finally {
      setEnviando(false);
    }
  };

  const accion = async (inv, tipo) => {
    setMsg(null);
    if (tipo === "anular" && !window.confirm(`¿Anular la invitación de ${inv.email}? El enlace dejará de funcionar.`)) return;
    try {
      await api(`/admin/invitaciones-empresa/${inv.id}/${tipo}/`, { method: "POST" });
      setMsg(tipo === "reenviar" ? `Reenviada a ${inv.email} con un enlace nuevo (7 días más).` : "Invitación anulada.");
      lista.recargar();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const filas = lista.data?.results || [];
  const encargado = Boolean(form?.empresa);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Invitaciones</h1>
          <p>Invita por correo a negocios, emprendimientos y oficinas. Solo quien recibe la invitación puede registrarse y llenar su información.</p>
        </div>
        <button className="btn" onClick={() => { setForm(form ? null : VACIA); setErrores({}); }}>
          {form ? "Cancelar" : "Nueva invitación"}
        </button>
      </div>

      {form && (
        <form className="card" onSubmit={enviar} style={{ marginBottom: 14 }}>
          <h2>Nueva invitación</h2>
          <p className="sub">Le llegará un correo con un enlace para crear su cuenta con su propia contraseña. Vence en 7 días.</p>
          <div className="crud-grid">
            <label className="campo"><span>Correo del responsable *</span>
              <input className="input" type="email" required value={form.email} onChange={set("email")} />
              {errores.email && <small className="error">{[].concat(errores.email).join(" ")}</small>}</label>
            <label className="campo"><span>¿Para una empresa que ya existe?</span>
              <select className="select" value={form.empresa} onChange={set("empresa")}>
                <option value="">No, es una empresa nueva</option>
                {(empresas.data?.results || []).map((e) => <option key={e.id} value={e.id}>Encargado de {e.nombre}</option>)}
              </select></label>
            {!encargado && (
              <>
                <label className="campo"><span>Tipo *</span>
                  <select className="select" value={form.tipo} onChange={set("tipo")}>
                    {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select></label>
                <label className="campo"><span>Nombre de la empresa</span>
                  <input className="input" value={form.nombre_sugerido} onChange={set("nombre_sugerido")} placeholder="Lo podrá corregir" /></label>
                <label className="campo"><span>Categoría</span>
                  <select className="select" value={form.categoria} onChange={set("categoria")}>
                    <option value="">Sin categoría</option>
                    {(categorias.data || []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select></label>
              </>
            )}
            <label className="campo ancho"><span>Mensaje (opcional)</span>
              <input className="input" value={form.mensaje} onChange={set("mensaje")} placeholder="Ej. ¡Bienvenidos al Paseo! Completen su ficha antes del lunes." /></label>
          </div>
          {errores.general && <p className="error">{errores.general}</p>}
          <button className="btn" disabled={enviando}>{enviando ? "Enviando…" : "Enviar invitación"}</button>
        </form>
      )}
      {msg && <p className="muted">{msg}</p>}

      <div className="filters">
        <div className="segmented">
          {FILTROS.map(([k, t]) => <button key={k} aria-pressed={estado === k} onClick={() => setEstado(k)}>{t}</button>)}
        </div>
      </div>

      <div className="card">
        <Estado cargando={lista.cargando && !lista.data} error={lista.error} vacio={false}>
          {filas.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Correo</th><th>Para</th><th>Tipo</th><th>Enviada</th><th>Vence</th><th>Estado</th><th /></tr></thead>
                <tbody>
                  {filas.map((i) => (
                    <tr key={i.id}>
                      <td><strong>{i.email}</strong></td>
                      <td>{i.empresa_nombre || i.nombre_sugerido || <span className="muted">Empresa nueva</span>}
                        {i.aceptada_por_nombre && <div className="muted">Aceptó: {i.aceptada_por_nombre}</div>}</td>
                      <td><span className="pill">{i.tipo_nombre}</span></td>
                      <td>{fecha(i.creado_en)}</td>
                      <td>{i.estado === "PENDIENTE" ? fecha(i.expira_en, true) : "—"}</td>
                      <td><span className={`pill ${COLOR[i.estado_nombre] || ""}`}>{i.estado_nombre}</span></td>
                      <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                        {i.estado === "PENDIENTE" && (
                          <>
                            <button className="btn ghost small" onClick={() => accion(i, "reenviar")}>Reenviar</button>{" "}
                            <button className="btn ghost small" onClick={() => accion(i, "anular")}>Anular</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty">No hay invitaciones en esta lista.</div>}
        </Estado>
      </div>
    </>
  );
}
