import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, tokens } from "../api";

const QUE_HARAS = {
  NEGOCIO: "Vas a poder llenar la ficha de tu negocio, tus productos, ofertas y atender tu caja de puntos.",
  EMPRENDIMIENTO: "Vas a poder presentar tu emprendimiento, los días que estarás en el Paseo y tus productos.",
  OFICINA: "Vas a poder presentar tu oficina, tu horario de atención, servicios y aprobar visitas.",
};

/** Enlace del correo de invitación: el invitado crea su cuenta con su propia contraseña. */
export default function Activar() {
  const { token } = useParams();
  const [inv, setInv] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ nombre_empresa: "", first_name: "", last_name: "", password: "", password_confirmacion: "" });
  const [errores, setErrores] = useState({});
  const [listo, setListo] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api(`/auth/invitacion-empresa/${token}/`)
      .then((data) => {
        setInv(data);
        setForm((f) => ({ ...f, nombre_empresa: data.nombre_sugerido || "" }));
      })
      .catch((err) => setError(err.message));
  }, [token]);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErrores({});
    try {
      setListo(await api(`/auth/invitacion-empresa/${token}/`, { method: "POST", body: form }));
    } catch (err) {
      setErrores({ ...err.fields, general: err.message });
    } finally {
      setEnviando(false);
    }
  };

  const irAlLogin = () => {
    tokens.clear(); // por si había otra sesión abierta en este navegador
    window.location.href = "/";
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const err = (k) => errores[k] && <small className="error">{[].concat(errores[k]).join(" ")}</small>;

  return (
    <div className="login">
      <div className="card" style={{ maxWidth: 440 }}>
        {error ? (
          <>
            <h1>Invitación no disponible</h1>
            <p className="error">{error}</p>
            <button className="btn" onClick={irAlLogin}>Ir a iniciar sesión</button>
          </>
        ) : !inv ? (
          <div className="empty">Cargando invitación…</div>
        ) : listo ? (
          <>
            <h1>¡Cuenta creada!</h1>
            <p><strong>{listo.empresa}</strong> ya está en Paseo Aranjuez 360.</p>
            <p className="muted">Inicia sesión con <strong>{listo.email}</strong> y tu contraseña. Te enviaremos un código a tu correo.</p>
            <button className="btn" onClick={irAlLogin}>Iniciar sesión</button>
          </>
        ) : (
          <form onSubmit={enviar}>
            <h1>Bienvenido a Paseo Aranjuez</h1>
            <p className="muted">
              {inv.empresa_nombre
                ? <>Te invitaron como encargado de <strong>{inv.empresa_nombre}</strong>.</>
                : <>Te invitaron a registrar tu <strong>{inv.tipo_nombre.toLowerCase()}</strong>{inv.categoria_nombre ? ` (${inv.categoria_nombre})` : ""}. {QUE_HARAS[inv.tipo]}</>}
            </p>
            {inv.mensaje && <p className="card" style={{ background: "var(--surface-2)", padding: 12 }}>{inv.mensaje}</p>}

            <label>Correo</label>
            <input className="input" value={inv.email} disabled />
            {!inv.empresa_nombre && (
              <>
                <label>Nombre de tu {inv.tipo_nombre.toLowerCase()}</label>
                <input className="input" required value={form.nombre_empresa} onChange={set("nombre_empresa")} />
                {err("nombre_empresa")}
              </>
            )}
            <label>Tu nombre</label>
            <input className="input" required value={form.first_name} onChange={set("first_name")} />
            {err("first_name")}
            <label>Tu apellido</label>
            <input className="input" required value={form.last_name} onChange={set("last_name")} />
            {err("last_name")}
            <label>Crea tu contraseña</label>
            <input className="input" type="password" required value={form.password} onChange={set("password")} autoComplete="new-password" />
            {err("password")}
            <label>Repite la contraseña</label>
            <input className="input" type="password" required value={form.password_confirmacion} onChange={set("password_confirmacion")} autoComplete="new-password" />
            {err("password_confirmacion")}
            {errores.general && !Object.keys(errores).some((k) => k !== "general") && <p className="error">{errores.general}</p>}
            <button className="btn" disabled={enviando}>{enviando ? "Creando…" : "Crear mi cuenta"}</button>
            <p className="muted" style={{ fontSize: 12 }}>Vence el {new Date(inv.expira_en).toLocaleString("es-BO")}</p>
          </form>
        )}
      </div>
    </div>
  );
}
