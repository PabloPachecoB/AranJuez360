import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, qs } from "../api";
import { Estado, useApi } from "../components/ui";
import { fecha, hace, ROLES } from "../format";

export default function Usuarios() {
  const [params, setParams] = useSearchParams();
  const [buscar, setBuscar] = useState(params.get("buscar") || "");
  const filtros = {
    rol: params.get("rol") || "",
    activo: params.get("activo") || "",
    sin_activar: params.get("sin_activar") || "",
    buscar: params.get("buscar") || "",
    page: params.get("page") || "",
  };
  const lista = useApi(`/admin/usuarios/${qs(filtros)}`);
  const [error, setError] = useState(null);

  const cambiar = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v); else n.delete(k);
    if (k !== "page") n.delete("page");
    setParams(n);
  };

  const alternar = async (u) => {
    setError(null);
    try {
      await api(`/admin/usuarios/${u.id}/`, { method: "PATCH", body: { is_active: !u.is_active } });
      lista.recargar();
    } catch (e) {
      setError(e.message);
    }
  };

  const pagina = Number(filtros.page || 1);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Usuarios</h1>
          <p>{lista.data ? `${lista.data.count} cuentas` : "Cuentas de la plataforma"}</p>
        </div>
      </div>

      <div className="filters">
        <form onSubmit={(e) => { e.preventDefault(); cambiar("buscar", buscar.trim()); }}>
          <input className="input" placeholder="Buscar por nombre o correo" value={buscar}
            onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar" />
        </form>
        <select className="select" value={filtros.rol} onChange={(e) => cambiar("rol", e.target.value)} aria-label="Rol">
          <option value="">Todos los roles</option>
          {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="select" value={filtros.activo} onChange={(e) => cambiar("activo", e.target.value)} aria-label="Estado">
          <option value="">Activos e inactivos</option>
          <option value="true">Solo activos</option>
          <option value="false">Solo inactivos</option>
        </select>
        <select className="select" value={filtros.sin_activar} onChange={(e) => cambiar("sin_activar", e.target.value)} aria-label="Activación">
          <option value="">Todas las cuentas</option>
          <option value="true">Sin activar (contraseña temporal)</option>
        </select>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="card">
        <Estado cargando={lista.cargando && !lista.data} error={lista.error} vacio={lista.data?.count === 0}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th><th>Correo</th><th>Rol</th><th>Empresa</th><th>Estado</th>
                  <th>Alta</th><th>Último ingreso</th><th></th>
                </tr>
              </thead>
              <tbody>
                {(lista.data?.results || []).map((u) => (
                  <tr key={u.id}>
                    <td>{u.rol === "CLIENTE" ? <Link to={`/clientes/${u.id}`}>{u.nombre}</Link> : u.nombre}</td>
                    <td>{u.email}</td>
                    <td><span className="pill">{ROLES[u.rol]}</span></td>
                    <td>{u.empresa_nombre || <span className="muted">—</span>}</td>
                    <td>
                      <span className={`pill ${u.is_active ? "on" : "off"}`}>{u.is_active ? "● Activo" : "○ Inactivo"}</span>
                      {u.debe_cambiar_password && <span className="pill" style={{ marginLeft: 4 }}>Sin activar</span>}
                    </td>
                    <td>{fecha(u.date_joined)}</td>
                    <td>{hace(u.last_login)}</td>
                    <td>
                      <button className="btn ghost small" onClick={() => alternar(u)}>
                        {u.is_active ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="filters" style={{ marginTop: 12, marginBottom: 0, justifyContent: "flex-end" }}>
            <button className="btn ghost small" disabled={!lista.data?.previous} onClick={() => cambiar("page", String(pagina - 1))}>Anterior</button>
            <span className="muted" style={{ alignSelf: "center" }}>Página {pagina}</span>
            <button className="btn ghost small" disabled={!lista.data?.next} onClick={() => cambiar("page", String(pagina + 1))}>Siguiente</button>
          </div>
        </Estado>
      </div>
    </>
  );
}
