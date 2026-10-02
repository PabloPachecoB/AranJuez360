import { useState } from "react";
import { api, qs } from "../api";
import { Estado, useApi } from "../components/ui";
import { fecha, TIPOS } from "../format";

const NUEVA = { nombre: "", tipo: "NEGOCIO", categoria: "", email_contacto: "", telefono: "" };

export default function Empresas() {
  const [tipo, setTipo] = useState("");
  const lista = useApi(`/admin/empresas/${qs({ tipo })}`);
  const categorias = useApi("/categorias/");
  const [form, setForm] = useState(NUEVA);
  const [abierto, setAbierto] = useState(false);
  const [msg, setMsg] = useState(null);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);

  const crear = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErrores({});
    setMsg(null);
    try {
      const body = { ...form, categoria: form.categoria || null };
      const empresa = await api("/admin/empresas/", { method: "POST", body });
      setMsg(`Empresa creada. Enviamos las credenciales a ${empresa.email_contacto}.`);
      setForm(NUEVA);
      setAbierto(false);
      lista.recargar();
    } catch (err) {
      setErrores({ ...err.fields, general: err.message });
    } finally {
      setEnviando(false);
    }
  };

  const accion = async (empresa, tipoAccion) => {
    setMsg(null);
    try {
      if (tipoAccion === "acceso") {
        const r = await api(`/admin/empresas/${empresa.id}/reenviar-acceso/`, { method: "POST" });
        setMsg(`Nueva contraseña temporal enviada a ${r.email}.`);
      } else {
        await api(`/admin/empresas/${empresa.id}/`, { method: "PATCH", body: { activo: !empresa.activo } });
        lista.recargar();
      }
    } catch (err) {
      setMsg(err.message);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Empresas</h1>
          <p>Negocios, emprendimientos y oficinas del Paseo</p>
        </div>
        <button className="btn" onClick={() => setAbierto(!abierto)}>{abierto ? "Cancelar" : "Registrar empresa"}</button>
      </div>

      {abierto && (
        <form className="card" onSubmit={crear} style={{ marginBottom: 14 }}>
          <h2>Nueva empresa</h2>
          <p className="sub">La empresa recibirá por correo su usuario y una contraseña temporal para completar su ficha.</p>
          <div className="filters">
            <input className="input" placeholder="Nombre" required value={form.nombre} onChange={set("nombre")} aria-label="Nombre" />
            <select className="select" value={form.tipo} onChange={set("tipo")} aria-label="Tipo">
              {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="select" value={form.categoria} onChange={set("categoria")} aria-label="Categoría">
              <option value="">Sin categoría</option>
              {(categorias.data || []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <input className="input" type="email" placeholder="Correo del responsable" required
              value={form.email_contacto} onChange={set("email_contacto")} aria-label="Correo" />
            <input className="input" placeholder="Teléfono (opcional)" value={form.telefono} onChange={set("telefono")} aria-label="Teléfono" />
            <button className="btn" disabled={enviando}>{enviando ? "Creando…" : "Crear y enviar acceso"}</button>
          </div>
          {errores.general && <p className="error">{errores.general}</p>}
        </form>
      )}
      {msg && <p className="muted">{msg}</p>}

      <div className="filters">
        <select className="select" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Filtrar por tipo">
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="card">
        <Estado cargando={lista.cargando && !lista.data} error={lista.error} vacio={lista.data?.count === 0}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Empresa</th><th>Tipo</th><th>Categoría</th><th>Ubicación</th><th>Correo</th><th>Ficha</th><th>Estado</th><th>Alta</th><th></th></tr>
              </thead>
              <tbody>
                {(lista.data?.results || []).map((e) => (
                  <tr key={e.id}>
                    <td><strong>{e.nombre}</strong></td>
                    <td><span className="pill">{TIPOS[e.tipo]}</span></td>
                    <td>{e.categoria_nombre || <span className="muted">—</span>}</td>
                    <td>{e.piso ? `Piso ${e.piso} · ${e.local}` : <span className="muted">Sin completar</span>}</td>
                    <td>{e.email_contacto}</td>
                    <td>{e.ficha_completa ? <span className="pill on">✓ Completa</span> : <span className="pill">Incompleta</span>}</td>
                    <td><span className={`pill ${e.activo ? "on" : "off"}`}>{e.activo ? "● Activa" : "○ Inactiva"}</span></td>
                    <td>{fecha(e.creado_en)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn ghost small" onClick={() => accion(e, "acceso")}>Reenviar acceso</button>{" "}
                      <button className="btn ghost small" onClick={() => accion(e, "estado")}>{e.activo ? "Desactivar" : "Activar"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Estado>
      </div>
    </>
  );
}
