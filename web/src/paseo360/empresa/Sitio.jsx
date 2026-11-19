import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const TIPOS = { NEGOCIO: "Negocio", EMPRENDIMIENTO: "Emprendimiento", OFICINA: "Oficina" };
const bs = (v) => `Bs ${Number(v).toLocaleString("es-BO")}`;

function agrupar(productos) {
  const grupos = {};
  productos.forEach((p) => { (grupos[p.seccion || "Otros"] ||= []).push(p); });
  return Object.entries(grupos);
}

function whatsapp(numero) {
  const limpio = (numero || "").replace(/\D/g, "");
  return `https://wa.me/${limpio.length === 8 ? `591${limpio}` : limpio}`;
}

/** Página pública de una empresa del Paseo (su mini-sitio con nuestro esquema). */
export default function Sitio() {
  const { id } = useParams();
  const [e, setE] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/empresas/${id}/`).then(setE).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div className="empty error">{error}</div>;
  if (!e) return <div className="empty">Cargando…</div>;
  const esOficina = e.tipo === "OFICINA";

  return (
    <div className="sitio">
      <header className="sitio-portada" style={e.portada ? { backgroundImage: `url(${e.portada})` } : undefined}>
        <div className="sitio-velo" />
        <div className="sitio-cabecera">
          {e.logo ? <img src={e.logo} alt="" className="sitio-logo" /> : <div className="sitio-logo vacio">{e.nombre.slice(0, 2)}</div>}
          <div>
            <span className="sitio-tipo">{TIPOS[e.tipo]} · {e.categoria_nombre || "Paseo Aranjuez"}</span>
            <h1>{e.nombre}</h1>
            {e.lema && <p>{e.lema}</p>}
          </div>
        </div>
      </header>

      <main className="sitio-cuerpo">
        <section className="sitio-col">
          {e.descripcion && <div className="card"><h2>{esOficina ? "A qué nos dedicamos" : "Sobre nosotros"}</h2><p>{e.descripcion}</p></div>}

          {e.ofertas?.length > 0 && (
            <div className="card">
              <h2>Ofertas vigentes</h2>
              {e.ofertas.map((o) => (
                <div key={o.id} className="sitio-item">
                  <strong>{o.titulo}</strong>
                  {o.precio_oferta && <span className="sitio-precio">{bs(o.precio_oferta)}</span>}
                </div>
              ))}
            </div>
          )}

          {e.productos?.length > 0 && (
            <div className="card">
              <h2>{esOficina ? "Servicios" : "Productos y menú"}</h2>
              {agrupar(e.productos).map(([seccion, items]) => (
                <div key={seccion}>
                  <h3 className="sitio-seccion">{seccion}</h3>
                  {items.map((p) => (
                    <div key={p.id} className="sitio-item">
                      {p.foto && <img src={p.foto} alt="" className="mini" />}
                      <div style={{ flex: 1 }}>
                        <strong>{p.nombre}</strong>
                        {p.descripcion && <div className="muted">{p.descripcion}</div>}
                      </div>
                      {Number(p.precio) > 0 && <span className="sitio-precio">{esOficina ? "desde " : ""}{bs(p.precio)}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {e.fotos?.length > 0 && (
            <div className="card"><h2>Fotos</h2>
              <div className="galeria">{e.fotos.map((f) => <figure key={f.id}><img src={f.imagen} alt={f.titulo || ""} /></figure>)}</div>
            </div>
          )}
        </section>

        <aside className="sitio-col angosta">
          <div className="card">
            <h2>Dónde estamos</h2>
            <p><strong>Paseo Aranjuez</strong><br />Piso {e.piso || "—"} · {esOficina ? "Oficina" : "Local"} {e.local || "—"}</p>
            {e.referencia && <p className="muted">{e.referencia}</p>}
          </div>
          {e.horarios?.length > 0 && (
            <div className="card">
              <h2>{esOficina ? "Horario de atención" : e.tipo === "EMPRENDIMIENTO" ? "Días y horarios" : "Horarios"}</h2>
              {e.horarios.map((h) => (
                <div key={h.dia} className="sitio-item">
                  <span>{DIAS[h.dia]}</span>
                  <span className={h.cerrado ? "muted" : ""}>{h.cerrado ? "Cerrado" : `${h.abre?.slice(0, 5)} – ${h.cierra?.slice(0, 5)}`}</span>
                </div>
              ))}
            </div>
          )}
          <div className="card">
            <h2>Contacto</h2>
            <div className="sitio-botones">
              {e.whatsapp && <a className="btn" href={whatsapp(e.whatsapp)} target="_blank" rel="noreferrer">WhatsApp</a>}
              {e.telefono && <a className="btn ghost" href={`tel:${e.telefono}`}>Llamar</a>}
              {e.facebook && <a className="btn ghost" href={e.facebook} target="_blank" rel="noreferrer">Facebook</a>}
              {e.instagram && <a className="btn ghost" href={e.instagram} target="_blank" rel="noreferrer">Instagram</a>}
              {e.sitio_web && <a className="btn ghost" href={e.sitio_web} target="_blank" rel="noreferrer">Sitio web</a>}
            </div>
            {esOficina && <p className="muted" style={{ marginTop: 10 }}>¿Quieres visitarnos? Solicita tu visita desde la app del Paseo Aranjuez.</p>}
          </div>
        </aside>
      </main>
      <footer className="sitio-pie">Paseo Aranjuez 360 · Cochabamba</footer>
    </div>
  );
}
