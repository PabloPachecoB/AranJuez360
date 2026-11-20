import { useEffect, useState } from "react";
import { qs } from "../api";
import { Estado, useApi } from "../ui";
import { fecha, hace } from "../format";

/** Línea de tiempo de lo que pasa en el Paseo: quién hizo qué y cuándo (compras, pedidos, canjes, visitas...). */
export default function Auditoria() {
  const [tipo, setTipo] = useState("");
  const datos = useApi(`/admin/reportes/auditoria/${qs({ tipo })}`);

  useEffect(() => {
    const id = setInterval(datos.recargar, 10000);
    return () => clearInterval(id);
  }, [datos.recargar]);

  const eventos = datos.data?.eventos || [];
  const tipos = datos.data?.tipos || [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Auditoría</h1>
          <p>Los últimos movimientos del Paseo, con quién los hizo. Se arma con lo que registra cada módulo y se actualiza solo.</p>
        </div>
      </div>

      <div className="filters">
        <div className="segmented" style={{ flexWrap: "wrap" }}>
          <button aria-pressed={tipo === ""} onClick={() => setTipo("")}>Todo</button>
          {tipos.map((t) => <button key={t.valor} aria-pressed={tipo === t.valor} onClick={() => setTipo(t.valor)}>{t.nombre}</button>)}
        </div>
      </div>

      <div className="card">
        <Estado cargando={datos.cargando && !datos.data} error={datos.error} vacio={false}>
          {eventos.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Cuándo</th><th>Módulo</th><th>Qué pasó</th><th>Detalle</th><th>Quién</th></tr></thead>
                <tbody>
                  {eventos.map((e, i) => (
                    <tr key={`${e.cuando}-${i}`}>
                      <td style={{ whiteSpace: "nowrap" }}>{hace(e.cuando)}<div className="muted">{fecha(e.cuando, true)}</div></td>
                      <td><span className="pill">{e.tipo_nombre}</span></td>
                      <td><strong>{e.titulo}</strong></td>
                      <td style={{ maxWidth: 380 }}>{e.detalle || "—"}</td>
                      <td>{e.actor || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty">Todavía no hay movimientos de este tipo.</div>}
        </Estado>
      </div>
    </>
  );
}
