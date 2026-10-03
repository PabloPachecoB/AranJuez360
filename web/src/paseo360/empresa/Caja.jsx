import { useEffect, useState } from "react";
import { api, qs } from "../api";
import { Estado, useApi } from "../ui";

const FILTROS = [["PENDIENTE", "Por aprobar"], ["APROBADA", "Aprobadas"], ["RECHAZADA", "Rechazadas"]];
const ACTUALIZAR_CADA_MS = 10000;

const bs = (v) => `Bs ${Number(v || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monedas = (v) => Number(v || 0).toLocaleString("es-BO", { maximumFractionDigits: 2 });
const hora = (iso) => (iso ? new Date(iso).toLocaleString("es-BO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

/**
 * Caja del negocio: compras que los clientes registraron escaneando el QR de caja.
 * El cajero compara con el ticket (NIT y monto) y aprueba o rechaza; recién al aprobar
 * se acreditan las monedas.
 */
export default function Caja() {
  const [estado, setEstado] = useState("PENDIENTE");
  const lista = useApi(`/caja/solicitudes/${qs({ estado })}`);
  const [msg, setMsg] = useState(null);
  const [trabajando, setTrabajando] = useState(null);

  // Las solicitudes llegan mientras la caja atiende: se refresca sola.
  useEffect(() => {
    const id = setInterval(() => lista.recargar(), ACTUALIZAR_CADA_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const responder = async (s, accion) => {
    let body;
    if (accion === "rechazar") {
      const motivo = window.prompt("¿Por qué se rechaza? (lo verá el cliente)", "El monto no coincide con el ticket");
      if (motivo === null) return;
      body = { motivo };
    }
    setTrabajando(s.id);
    setMsg(null);
    try {
      const r = await api(`/caja/solicitudes/${s.id}/${accion}/`, { method: "POST", body });
      setMsg(accion === "aprobar"
        ? `✓ Aprobada: ${r.cliente_nombre} ganó ${monedas(r.puntos)} monedas.`
        : `Solicitud de ${r.cliente_nombre} rechazada.`);
      lista.recargar();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setTrabajando(null);
    }
  };

  const filas = lista.data?.results || [];
  const pendientes = estado === "PENDIENTE" ? filas.length : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Caja {pendientes ? <span className="pill on">{pendientes} por aprobar</span> : null}</h1>
          <p>Compras registradas por tus clientes con tu QR. Revisa el ticket (NIT y monto) antes de aprobar.</p>
        </div>
        <div className="segmented">
          {FILTROS.map(([k, t]) => <button key={k} aria-pressed={estado === k} onClick={() => setEstado(k)}>{t}</button>)}
        </div>
      </div>
      {msg && <p className="muted">{msg}</p>}

      <div className="card">
        <Estado cargando={lista.cargando && !lista.data} error={lista.error} vacio={false}>
          {filas.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th><th>NIT</th><th className="num">Monto</th><th>Registrada</th>
                    {estado === "APROBADA" && <th className="num">Monedas</th>}
                    {estado === "RECHAZADA" && <th>Motivo</th>}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filas.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.cliente_nombre}</strong></td>
                      <td>{s.nit}</td>
                      <td className="num"><strong>{bs(s.monto)}</strong></td>
                      <td>{hora(s.creado_en)}</td>
                      {estado === "APROBADA" && <td className="num">+{monedas(s.puntos)}</td>}
                      {estado === "RECHAZADA" && <td className="muted">{s.motivo_rechazo || "—"}</td>}
                      <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                        {s.estado === "PENDIENTE" && (
                          <>
                            <button className="btn small" disabled={trabajando === s.id} onClick={() => responder(s, "aprobar")}>Aprobar</button>{" "}
                            <button className="btn ghost small" disabled={trabajando === s.id} onClick={() => responder(s, "rechazar")}>Rechazar</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              {estado === "PENDIENTE" ? "No hay compras por aprobar. Se actualiza solo cada 10 segundos." : "No hay solicitudes en esta lista."}
            </div>
          )}
        </Estado>
      </div>
    </>
  );
}
