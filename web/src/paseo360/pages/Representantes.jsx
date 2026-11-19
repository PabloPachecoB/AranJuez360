import { useState } from "react";
import { api, qs } from "../api";
import { Estado, useApi } from "../ui";
import { fecha, hace } from "../format";

const TIPO = { NEGOCIO: "Negocio / emprendimiento", OFICINA: "Oficina", CAJERO: "Cajero" };

/** Quién responde por cada negocio, emprendimiento u oficina: contacto, último ingreso y acceso. */
export default function Representantes() {
  const [rol, setRol] = useState("NEGOCIO,OFICINA");
  const [buscar, setBuscar] = useState("");
  const [pagina, setPagina] = useState(1);
  const lista = useApi(`/admin/usuarios/${qs({ rol, buscar, page: pagina })}`);
  const [msg, setMsg] = useState(null);
  const filas = lista.data?.results || [];
  const paginas = Math.max(1, Math.ceil((lista.data?.count || 0) / 20));

  const acceso = async (u) => {
    setMsg(null);
    try {
      await api(`/admin/empresas/${u.empresa}/reenviar-acceso/`, { method: "POST" });
      setMsg(`Se envió una contraseña temporal a ${u.email}.`);
      lista.recargar();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const alternar = async (u) => {
    setMsg(null);
    try {
      await api(`/admin/usuarios/${u.id}/`, { method: "PATCH", body: { is_active: !u.is_active } });
      lista.recargar();
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Representantes</h1>
          <p>Las personas que manejan cada establecimiento: contacto, último ingreso y acceso.</p>
        </div>
      </div>

      <div className="filters">
        <div className="segmented">
          {[["NEGOCIO,OFICINA", "Todos"], ["NEGOCIO", "Negocios"], ["OFICINA", "Oficinas"], ["CAJERO", "Cajeros"]].map(([k, t]) => (
            <button key={k} aria-pressed={rol === k} onClick={() => { setRol(k); setPagina(1); }}>{t}</button>
          ))}
        </div>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Buscar nombre o correo…" value={buscar}
          onChange={(e) => { setBuscar(e.target.value); setPagina(1); }} />
      </div>
      {msg && <p className="muted">{msg}</p>}

      <div className="card">
        <Estado cargando={lista.cargando && !lista.data} error={lista.error} vacio={false}>
          {filas.length ? (
            <>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Establecimiento</th><th>Representante</th><th>Contacto</th><th>Último ingreso</th><th>Estado</th><th /></tr></thead>
                  <tbody>
                    {filas.map((u) => (
                      <tr key={u.id}>
                        <td><strong>{u.empresa_nombre || "—"}</strong><div className="muted">{TIPO[u.rol] || u.rol}</div></td>
                        <td>{u.nombre}</td>
                        <td>{u.email}<div className="muted">{u.celular || "sin celular"}</div></td>
                        <td>{u.last_login ? <>{hace(u.last_login)}<div className="muted">{fecha(u.last_login, true)}</div></> : <span className="muted">Nunca entró</span>}</td>
                        <td>
                          <span className={`pill ${u.is_active ? "on" : "off"}`}>{u.is_active ? "● Activo" : "○ Inactivo"}</span>
                          {u.debe_cambiar_password && <div className="muted">sin activar</div>}
                        </td>
                        <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                          {u.empresa && u.rol !== "CAJERO" && <button className="btn ghost small" onClick={() => acceso(u)}>Reenviar acceso</button>}{" "}
                          <button className="btn ghost small" onClick={() => alternar(u)}>{u.is_active ? "Desactivar" : "Activar"}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paginas > 1 && (
                <div className="filters" style={{ marginTop: 12, justifyContent: "center", alignItems: "center" }}>
                  <button className="btn ghost small" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>← Anterior</button>
                  <span className="muted">Página {pagina} de {paginas} · {lista.data.count} representantes</span>
                  <button className="btn ghost small" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Siguiente →</button>
                </div>
              )}
            </>
          ) : <div className="empty">No hay representantes con ese filtro.</div>}
        </Estado>
      </div>
    </>
  );
}
