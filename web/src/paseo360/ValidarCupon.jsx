import { useState } from "react";
import { api } from "./api";

const fecha = (iso) => (iso ? new Date(iso).toLocaleString("es-BO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

/**
 * Validar el cupón que muestra el cliente al canjear un premio con monedas.
 * Un negocio solo ve y entrega los cupones de sus propios premios; el admin, los del Paseo.
 */
export default function ValidarCupon({ titulo = "Validar cupón", ayuda }) {
  const [codigo, setCodigo] = useState("");
  const [cupon, setCupon] = useState(null);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  const buscar = async (e) => {
    e.preventDefault();
    setMsg(null);
    setError(null);
    setCupon(null);
    if (!codigo.trim()) return;
    try {
      setCupon(await api(`/canjes/validar/${encodeURIComponent(codigo.trim())}/`));
    } catch (err) {
      setError(err.message);
    }
  };

  const entregar = async () => {
    try {
      const r = await api(`/canjes/validar/${encodeURIComponent(cupon.codigo)}/`, { method: "POST" });
      setCupon(r);
      setMsg(`✓ Entregado: ${r.recompensa_nombre} a ${r.cliente_nombre}.`);
      setCodigo("");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="card" style={{ marginBottom: 14 }}>
      <h2>{titulo}</h2>
      <p className="sub">{ayuda || "El cliente muestra el código de su cupón en la app. Revísalo y entrégale el premio."}</p>
      <form className="filters" onSubmit={buscar} style={{ marginBottom: 0 }}>
        <input className="input codigo-cupon" placeholder="Código del cupón (ej. K7QM2XPA)" value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={12} aria-label="Código del cupón" />
        <button className="btn">Buscar</button>
      </form>
      {error && <p className="error">{error}</p>}
      {cupon && (
        <div className={`cupon ${cupon.estado === "ACTIVO" ? "activo" : ""}`}>
          <div>
            <strong>{cupon.recompensa_nombre}</strong>
            <div className="muted">
              {cupon.cliente_nombre} · canjeado el {fecha(cupon.creado_en)} · {Number(cupon.monedas).toLocaleString("es-BO")} monedas
            </div>
            {cupon.estado === "USADO" && <div className="error">Ya entregado el {fecha(cupon.usado_en)}</div>}
            {cupon.estado === "ANULADO" && <div className="error">Cupón anulado</div>}
          </div>
          {cupon.estado === "ACTIVO" && <button className="btn" onClick={entregar}>Entregar premio</button>}
        </div>
      )}
      {msg && <p className="muted">{msg}</p>}
    </section>
  );
}
