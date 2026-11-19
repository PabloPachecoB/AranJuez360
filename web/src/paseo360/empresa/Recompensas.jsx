import { useMemo, useState } from "react";
import { api } from "../api";
import { Estado, useApi } from "../ui";

const CATEGORIAS = [["PRODUCTO", "Producto"], ["DESCUENTO", "Descuento"], ["OTRO", "Otro"]];
const VACIA = { id: null, nombre: "", categoria: "PRODUCTO", valor_bs: "", costo_puntos: "", descripcion: "", activo: true };
const n = (v, dec = 0) => Number(v || 0).toLocaleString("es-BO", { maximumFractionDigits: dec });
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "short" }) : "—");

/** Monedas sugeridas para un premio de `valor` Bs (misma fórmula que el backend). */
function sugerido(valor, conv) {
  if (!valor || !conv?.valor_moneda_bs) return 0;
  return Math.ceil((Number(valor) / Number(conv.valor_moneda_bs) * Number(conv.margen_producto)) / 10) * 10;
}

/** Monedas que da una compra de `monto` según los rangos vigentes. */
function monedasPorCompra(monto, conv) {
  const rango = (conv?.rangos_compra || []).find((r) =>
    Number(r.monto_minimo) <= monto && (r.monto_maximo == null || monto <= Number(r.monto_maximo)));
  return rango ? Number(rango.monedas) : 0;
}

/**
 * El negocio pone sus productos en el sistema de canje. Solo aquí (y en el panel del Paseo)
 * se ve la equivalencia en Bs: los clientes únicamente ven monedas.
 */
export default function Recompensas() {
  const conv = useApi("/puntos/conversion/").data;
  const lista = useApi("/mi-empresa/recompensas/");
  const canjes = useApi("/mi-empresa/canjes/");
  const productos = useApi("/mi-empresa/productos/");
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [msg, setMsg] = useState(null);

  const premios = lista.data?.results || lista.data || [];
  const misProductos = productos.data?.results || productos.data || [];
  const porCompra100 = monedasPorCompra(100, conv);
  const costo = Number(form?.costo_puntos || 0);
  const calculo = useMemo(() => ({
    sugerido: sugerido(form?.valor_bs, conv),
    valorEnMonedas: conv ? costo * Number(conv.valor_moneda_bs) : 0,
    compras: porCompra100 ? Math.ceil(costo / porCompra100) : null,
    visitas: conv?.puntos_por_visita ? Math.ceil(costo / Number(conv.puntos_por_visita)) : null,
  }), [form?.valor_bs, costo, conv, porCompra100]);

  const desdeProducto = (id) => {
    const p = misProductos.find((x) => String(x.id) === id);
    if (!p) return;
    const valor = p.precio;
    setForm({ ...form, nombre: p.nombre, valor_bs: valor, costo_puntos: String(sugerido(valor, conv)) });
  };

  const guardar = async (e) => {
    e.preventDefault();
    setErrores({});
    const body = {
      nombre: form.nombre, categoria: form.categoria, descripcion: form.descripcion || "",
      costo_puntos: form.costo_puntos, valor_bs: form.valor_bs === "" ? null : form.valor_bs, activo: form.activo,
    };
    try {
      if (form.id) await api(`/mi-empresa/recompensas/${form.id}/`, { method: "PATCH", body });
      else await api("/mi-empresa/recompensas/", { method: "POST", body });
      setMsg(form.id ? "Recompensa actualizada." : "Recompensa publicada: ya aparece en la app para canjear.");
      setForm(null);
      lista.recargar();
    } catch (err) {
      setErrores({ ...err.fields, general: err.message });
    }
  };

  const eliminar = async (r) => {
    if (!window.confirm(`¿Quitar "${r.nombre}" del catálogo? Si ya tiene canjes, mejor desactívala.`)) return;
    try {
      await api(`/mi-empresa/recompensas/${r.id}/`, { method: "DELETE" });
      lista.recargar();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const err = (k) => errores[k] && <small className="error">{[].concat(errores[k]).join(" ")}</small>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Recompensas</h1>
          <p>Pon tus productos en el sistema de canje del Paseo. Tus clientes los canjean con sus monedas.</p>
        </div>
        <button className="btn" onClick={() => { setForm(form ? null : VACIA); setErrores({}); }}>
          {form ? "Cancelar" : "Publicar producto"}
        </button>
      </div>

      {conv && (
        <section className="card conversion" style={{ marginBottom: 14 }}>
          <div><span className="muted">Equivalencia</span><strong>1.000 monedas = Bs {n(1000 * conv.valor_moneda_bs, 2)}</strong></div>
          <div><span className="muted">Una compra de Bs 100 da</span><strong>{n(porCompra100)} monedas</strong></div>
          <div><span className="muted">Una visita al Paseo da</span><strong>{n(conv.puntos_por_visita)} monedas</strong></div>
          <p className="sub" style={{ gridColumn: "1 / -1", margin: 0 }}>
            🔒 Solo tú y el Paseo ven esta equivalencia: los clientes solo ven monedas.
          </p>
        </section>
      )}

      {form && (
        <form className="card" onSubmit={guardar} style={{ marginBottom: 14 }}>
          <h2>{form.id ? "Editar recompensa" : "Nueva recompensa"}</h2>
          <div className="crud-grid">
            {!form.id && misProductos.length > 0 && (
              <label className="campo ancho"><span>Tomar de mis productos (opcional)</span>
                <select className="select" defaultValue="" onChange={(e) => desdeProducto(e.target.value)}>
                  <option value="">— Elegir un producto de mi catálogo —</option>
                  {misProductos.map((p) => <option key={p.id} value={p.id}>{p.nombre} · Bs {n(p.precio, 2)}</option>)}
                </select></label>
            )}
            <label className="campo"><span>Nombre *</span>
              <input className="input" required value={form.nombre} onChange={set("nombre")} />{err("nombre")}</label>
            <label className="campo"><span>Tipo</span>
              <select className="select" value={form.categoria} onChange={set("categoria")}>
                {CATEGORIAS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>{err("categoria")}</label>
            <label className="campo"><span>Valor real (Bs)</span>
              <input className="input" type="number" min="0" step="0.01" value={form.valor_bs}
                onChange={(e) => setForm({ ...form, valor_bs: e.target.value, costo_puntos: form.costo_puntos || String(sugerido(e.target.value, conv)) })} />
              <small className="muted">Solo lo ven tú y el Paseo</small></label>
            <label className="campo"><span>Costo en monedas *</span>
              <input className="input" type="number" min="1" step="1" required value={form.costo_puntos} onChange={set("costo_puntos")} />
              {calculo.sugerido > 0 && (
                <small className="muted">
                  Sugerido: {n(calculo.sugerido)}{" "}
                  <a href="#usar" onClick={(e) => { e.preventDefault(); setForm({ ...form, costo_puntos: String(calculo.sugerido) }); }}>usar</a>
                </small>
              )}{err("costo_puntos")}</label>
            <label className="campo ancho"><span>Descripción (la ve el cliente)</span>
              <input className="input" value={form.descripcion} onChange={set("descripcion")} placeholder="Ej. Válido de lunes a viernes" /></label>
            <label className="campo check"><span>Visible en la app</span>
              <input type="checkbox" checked={form.activo} onChange={set("activo")} /></label>
          </div>

          {costo > 0 && conv && (
            <div className="simulacion">
              <strong>Así funcionaría para tus clientes:</strong>
              <ul>
                <li>Verán: <b>“{form.nombre || "Tu producto"} · {n(costo)} monedas”</b> (sin precio en Bs).</li>
                <li>Equivale a <b>Bs {n(calculo.valorEnMonedas, 2)}</b>{form.valor_bs ? ` (valor real Bs ${n(form.valor_bs, 2)})` : ""}.</li>
                {calculo.compras && <li>Lo consiguen con unas <b>{calculo.compras} compras de Bs 100</b>{calculo.visitas ? ` o ${calculo.visitas} visitas` : ""}.</li>}
                <li>Al canjearlo reciben un código: lo validas en <b>Caja</b> y le entregas el producto.</li>
              </ul>
            </div>
          )}
          {errores.general && <p className="error">{errores.general}</p>}
          <button className="btn">{form.id ? "Guardar cambios" : "Publicar"}</button>
        </form>
      )}
      {msg && <p className="muted">{msg}</p>}

      <section className="card" style={{ marginBottom: 14 }}>
        <h2>Mi catálogo de canje</h2>
        <Estado cargando={lista.cargando && !lista.data} error={lista.error} vacio={false}>
          {premios.length ? (
            <div className="table-wrap"><table>
              <thead><tr><th>Recompensa</th><th className="num">Monedas</th><th className="num">Valor real</th>
                <th className="num">Canjes</th><th>Estado</th><th /></tr></thead>
              <tbody>{premios.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.nombre}</strong><div className="muted">{CATEGORIAS.find(([k]) => k === r.categoria)?.[1]}</div></td>
                  <td className="num">{n(r.costo_puntos)}</td>
                  <td className="num">{r.valor_bs ? `Bs ${n(r.valor_bs, 2)}` : "—"}</td>
                  <td className="num">{n(r.canjes)}</td>
                  <td><span className={`pill ${r.activo ? "on" : "off"}`}>{r.activo ? "● Visible" : "○ Oculta"}</span></td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    <button className="btn ghost small" onClick={() => setForm({ ...VACIA, ...r, valor_bs: r.valor_bs ?? "", descripcion: r.descripcion || "" })}>Editar</button>{" "}
                    <button className="btn ghost small" onClick={() => eliminar(r)}>Quitar</button>
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : <div className="empty">Aún no publicaste productos para canje. Usa “Publicar producto”.</div>}
        </Estado>
      </section>

      <section className="card">
        <h2>Cupones canjeados por tus clientes</h2>
        <p className="sub">Los validas en Caja con el código que el cliente muestra en su app.</p>
        <Estado cargando={canjes.cargando && !canjes.data} error={canjes.error} vacio={false}>
          {(canjes.data?.results || []).length ? (
            <div className="table-wrap"><table>
              <thead><tr><th>Cliente</th><th>Recompensa</th><th>Código</th><th>Canjeado</th><th>Estado</th></tr></thead>
              <tbody>{canjes.data.results.map((c) => (
                <tr key={c.id}>
                  <td>{c.cliente_nombre}</td><td>{c.recompensa_nombre}</td><td><code>{c.codigo}</code></td>
                  <td>{fecha(c.creado_en)}</td>
                  <td><span className={`pill ${c.estado === "USADO" ? "" : c.estado === "ACTIVO" ? "on" : "off"}`}>{c.estado_nombre}</span></td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : <div className="empty">Todavía nadie canjeó tus productos.</div>}
        </Estado>
      </section>
    </>
  );
}
