import { useEffect, useState } from "react";
import { api, apiForm } from "../api";
import { useApi } from "../ui";

const CAMPOS = [
  ["lema", "Lema", "Frase corta bajo tu nombre"],
  ["telefono", "Teléfono", ""],
  ["whatsapp", "WhatsApp", "8 dígitos, ej. 71234567"],
  ["piso", "Piso", "Ej. 2, PB"],
  ["local", "Local / oficina", "Ej. 210, K3"],
  ["referencia", "Cómo llegar", "Ej. Frente a los ascensores"],
  ["facebook", "Facebook (URL)", "https://facebook.com/…"],
  ["instagram", "Instagram (URL)", "https://instagram.com/…"],
  ["sitio_web", "Sitio web (URL)", "https://…"],
];

const TEXTOS = {
  OFICINA: "Cuéntale a los visitantes a qué se dedica tu oficina, dónde estás y cómo contactarte.",
  EMPRENDIMIENTO: "Presenta tu emprendimiento: qué haces, dónde te encuentran y cómo contactarte.",
  NEGOCIO: "Así te verán los clientes en la app y en tu página del Paseo.",
};

/** Ficha pública de la empresa: datos, logo, portada y redes. */
export default function MiFicha({ empresa, onCambio }) {
  const perfil = useApi("/mi-empresa/");
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (perfil.data) setForm(perfil.data);
  }, [perfil.data]);

  if (!form) return <div className="empty">Cargando…</div>;

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setMsg(null);
    setErrores({});
    try {
      const body = { descripcion: form.descripcion || "" };
      CAMPOS.forEach(([k]) => { body[k] = form[k] || ""; });
      const data = await api("/mi-empresa/", { method: "PATCH", body });
      setForm(data);
      onCambio?.(data);
      setMsg("Ficha guardada. Ya se ve en la app.");
    } catch (err) {
      setErrores({ ...err.fields, general: err.message });
    } finally {
      setGuardando(false);
    }
  };

  const subir = async (campo, archivo) => {
    if (!archivo) return;
    const datos = new FormData();
    datos.append(campo, archivo);
    try {
      const data = await apiForm("/mi-empresa/", datos);
      setForm(data);
      onCambio?.(data);
      setMsg(campo === "logo" ? "Logo actualizado." : "Portada actualizada.");
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mi ficha</h1>
          <p>{TEXTOS[empresa.tipo]}</p>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 14 }}>
        <h2>Imagen</h2>
        <div className="imagenes">
          <label className="subida">
            {form.logo ? <img src={form.logo} alt="Logo" className="logo-prev" /> : <div className="logo-prev vacio">Logo</div>}
            <span className="btn ghost small">Cambiar logo</span>
            <input type="file" accept="image/*" hidden onChange={(e) => subir("logo", e.target.files[0])} />
          </label>
          <label className="subida ancho">
            {form.portada ? <img src={form.portada} alt="Portada" className="portada-prev" /> : <div className="portada-prev vacio">Portada (foto horizontal)</div>}
            <span className="btn ghost small">Cambiar portada</span>
            <input type="file" accept="image/*" hidden onChange={(e) => subir("portada", e.target.files[0])} />
          </label>
        </div>
      </section>

      <form className="card" onSubmit={guardar}>
        <h2>Datos</h2>
        <p className="sub">{form.nombre} · {form.categoria_nombre || "Sin categoría"} · {form.email_contacto}</p>
        <div className="crud-grid">
          <label className="campo ancho">
            <span>{empresa.tipo === "OFICINA" ? "¿A qué se dedican?" : "Descripción"}</span>
            <textarea className="input" rows={4} value={form.descripcion || ""}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </label>
          {CAMPOS.map(([k, label, ayuda]) => (
            <label key={k} className="campo">
              <span>{label}</span>
              <input className="input" value={form[k] || ""} placeholder={ayuda}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              {errores[k] && <small className="error">{[].concat(errores[k]).join(" ")}</small>}
            </label>
          ))}
        </div>
        {errores.general && <p className="error">{errores.general}</p>}
        <button className="btn" disabled={guardando}>{guardando ? "Guardando…" : "Guardar ficha"}</button>
        {msg && <span className="muted" style={{ marginLeft: 10 }}>{msg}</span>}
      </form>
    </>
  );
}
