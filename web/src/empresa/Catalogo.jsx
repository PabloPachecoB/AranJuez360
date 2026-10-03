import { useState } from "react";
import { apiForm } from "../api";
import Crud, { activo } from "../components/Crud";
import { useApi } from "../components/ui";

const TEXTOS = {
  NEGOCIO: ["Productos y menú", "Lo que vendes. Agrúpalos por sección (ej. Bebidas, Postres, Celulares).", "Agregar producto", "Bebidas"],
  EMPRENDIMIENTO: ["Productos y menú", "Describe tus productos; el menú es opcional.", "Agregar producto", "Dulces"],
  OFICINA: ["Servicios", "Los servicios que ofreces a tus visitantes.", "Agregar servicio", "Servicios"],
};
const bs = (v) => (Number(v) ? `Bs ${Number(v).toLocaleString("es-BO")}` : "—");

/** Productos / menú / servicios de la empresa, con foto. */
export default function Catalogo({ empresa }) {
  const [titulo, subtitulo, textoNuevo, seccionEjemplo] = TEXTOS[empresa.tipo];
  const [version, setVersion] = useState(0);
  const [msg, setMsg] = useState(null);

  const subirFoto = async (producto, archivo) => {
    if (!archivo) return;
    const datos = new FormData();
    datos.append("foto", archivo);
    try {
      await apiForm(`/mi-empresa/productos/${producto.id}/`, datos);
      setMsg(`Foto de "${producto.nombre}" actualizada.`);
      setVersion((v) => v + 1);
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <>
      <div className="page-head"><div><h1>{titulo}</h1><p>{subtitulo}</p></div></div>
      {msg && <p className="muted">{msg}</p>}
      <Crud
        key={version}
        titulo={titulo}
        endpoint="/mi-empresa/productos/"
        textoNuevo={textoNuevo}
        inicial={{ nombre: "", seccion: seccionEjemplo, precio: "", descripcion: "", activo: true }}
        campos={[
          { k: "nombre", label: "Nombre", requerido: true },
          { k: "seccion", label: "Sección", ayuda: `Ej. ${seccionEjemplo}` },
          { k: "precio", label: empresa.tipo === "OFICINA" ? "Precio desde (Bs)" : "Precio (Bs)", tipo: "decimal", requerido: true },
          { k: "descripcion", label: "Descripción", tipo: "textarea" },
          { k: "activo", label: "Visible", tipo: "checkbox" },
        ]}
        columnas={[
          { label: "Foto", render: (f) => (f.foto ? <img src={f.foto} alt="" className="mini" /> : <span className="muted">—</span>) },
          { label: "Nombre", render: (f) => <strong>{f.nombre}</strong> },
          { label: "Sección", render: (f) => f.seccion || <span className="muted">—</span> },
          { label: "Precio", render: (f) => bs(f.precio), num: true },
          { label: "Estado", render: activo },
        ]}
        acciones={(f) => (
          <label className="btn ghost small" style={{ marginRight: 4 }}>
            Foto
            <input type="file" accept="image/*" hidden onChange={(e) => subirFoto(f, e.target.files[0])} />
          </label>
        )}
      />
    </>
  );
}

/** Ofertas vigentes que salen en la app (Promociones para hoy). */
export function Ofertas() {
  const productos = useApi("/mi-empresa/productos/");
  const opciones = (productos.data?.results || productos.data || []).map((p) => [p.id, p.nombre]);
  const hoy = new Date().toISOString().slice(0, 10);
  return (
    <>
      <div className="page-head"><div><h1>Ofertas</h1><p>Aparecen en “Promociones para hoy” de la app mientras estén vigentes.</p></div></div>
      <Crud
        titulo="Mis ofertas"
        endpoint="/mi-empresa/ofertas/"
        textoNuevo="Agregar oferta"
        nombreFila={(f) => f.titulo}
        inicial={{ titulo: "", producto: "", precio_oferta: "", inicio: hoy, fin: hoy, descripcion: "", activo: true }}
        campos={[
          { k: "titulo", label: "Título", requerido: true, ayuda: "Ej. 2x1 en capuchinos" },
          { k: "producto", label: "Producto", tipo: "select", opciones },
          { k: "precio_oferta", label: "Precio de oferta (Bs)", tipo: "decimal" },
          { k: "inicio", label: "Desde", tipo: "date", requerido: true },
          { k: "fin", label: "Hasta", tipo: "date", requerido: true },
          { k: "descripcion", label: "Descripción", tipo: "textarea" },
          { k: "activo", label: "Activa", tipo: "checkbox" },
        ]}
        columnas={[
          { label: "Oferta", render: (f) => <strong>{f.titulo}</strong> },
          { label: "Precio", render: (f) => bs(f.precio_oferta), num: true },
          { label: "Vigencia", render: (f) => `${f.inicio} → ${f.fin}` },
          { label: "Estado", render: activo },
        ]}
      />
    </>
  );
}

/** Galería del mini-sitio. */
export function Fotos() {
  const fotos = useApi("/mi-empresa/fotos/");
  const [msg, setMsg] = useState(null);
  const lista = fotos.data?.results || fotos.data || [];

  const subir = async (archivos) => {
    setMsg(null);
    try {
      for (const archivo of archivos) {
        const datos = new FormData();
        datos.append("imagen", archivo);
        await apiForm("/mi-empresa/fotos/", datos, "POST");
      }
      fotos.recargar();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const borrar = async (foto) => {
    if (!window.confirm("¿Eliminar esta foto?")) return;
    try {
      await apiForm(`/mi-empresa/fotos/${foto.id}/`, null, "DELETE");
      fotos.recargar();
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Fotos</h1><p>Muestra tu local, oficina o productos. Se ven en tu página y en la app.</p></div>
        <label className="btn">
          Subir fotos
          <input type="file" accept="image/*" multiple hidden onChange={(e) => subir([...e.target.files])} />
        </label>
      </div>
      {msg && <p className="error">{msg}</p>}
      <section className="card">
        {lista.length ? (
          <div className="galeria">
            {lista.map((f) => (
              <figure key={f.id}>
                <img src={f.imagen} alt={f.titulo || "Foto"} />
                <button className="btn ghost small" onClick={() => borrar(f)}>Eliminar</button>
              </figure>
            ))}
          </div>
        ) : <div className="empty">Aún no subiste fotos.</div>}
      </section>
    </>
  );
}
