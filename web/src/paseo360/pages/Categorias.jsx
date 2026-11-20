import Crud from "../Crud";

/** Rubros con los que se clasifican los establecimientos (Comida, Ropa, Servicios...). */
export default function Categorias() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Categorías</h1>
          <p>Los rubros del directorio. Aparecen como filtros en la app y los usa Jarvis para recomendar.</p>
        </div>
      </div>
      <Crud
        titulo="Rubros del Paseo"
        subtitulo="Si borras uno, los negocios que lo tenían quedan sin categoría. «Comida» es la que habilita PaseoYa."
        endpoint="/admin/categorias/"
        textoNuevo="Agregar categoría"
        nombreFila={(f) => f.nombre}
        inicial={{ nombre: "" }}
        campos={[{ k: "nombre", label: "Nombre", requerido: true, ayuda: "Ej. Comida, Ropa, Electrónica" }]}
        columnas={[{ label: "Categoría", render: (f) => <strong>{f.nombre}</strong> }]}
      />
    </>
  );
}
