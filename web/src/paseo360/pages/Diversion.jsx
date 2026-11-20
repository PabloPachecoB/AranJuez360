import Crud, { activo } from "../Crud";
import { useApi } from "../ui";
import { fecha } from "../format";

const CLASIFICACIONES = [["ATP", "ATP"], ["+7", "+7"], ["+13", "+13"], ["+16", "+16"], ["+18", "+18"]];
const CATEGORIAS = [
  ["MUSICA", "Música"], ["CULTURA", "Arte y cultura"], ["INFANTIL", "Infantil"],
  ["GASTRONOMIA", "Gastronomía"], ["DEPORTE", "Deporte"], ["OTRO", "Otro"],
];
const precio = (v) => (Number(v) ? `Bs ${Number(v).toLocaleString("es-BO")}` : <span className="muted">Libre</span>);

export default function Diversion() {
  const empresas = useApi("/admin/empresas/");
  const peliculas = useApi("/admin/peliculas/");
  const espacios = useApi("/admin/espacios/");
  const opcionesEmpresas = (empresas.data?.results || []).map((e) => [e.id, e.nombre]);
  const opcionesPeliculas = (peliculas.data?.results || []).map((p) => [p.id, p.titulo]);
  const opcionesEspacios = (espacios.data?.results || []).map((e) => [e.id, e.nombre]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Diversión</h1>
          <p>Cartelera de cine y eventos que ven los clientes en la app (sección Diversión y Jarvis)</p>
        </div>
      </div>

      <Crud
        titulo="Películas"
        subtitulo="Las películas activas aparecen en la cartelera de la app."
        endpoint="/admin/peliculas/"
        textoNuevo="Agregar película"
        nombreFila={(f) => f.titulo}
        inicial={{ titulo: "", genero: "", clasificacion: "ATP", duracion_min: 90, sinopsis: "", estreno: false, activo: true }}
        campos={[
          { k: "titulo", label: "Título", requerido: true },
          { k: "genero", label: "Género" },
          { k: "clasificacion", label: "Clasificación", tipo: "select", opciones: CLASIFICACIONES, requerido: true },
          { k: "duracion_min", label: "Duración (min)", tipo: "number", requerido: true },
          { k: "cine", label: "Cine (empresa)", tipo: "select", opciones: opcionesEmpresas },
          { k: "trailer_url", label: "Tráiler (URL)" },
          { k: "sinopsis", label: "Sinopsis", tipo: "textarea" },
          { k: "estreno", label: "Estreno", tipo: "checkbox" },
          { k: "activo", label: "Activa", tipo: "checkbox" },
        ]}
        columnas={[
          { label: "Título", render: (f) => <strong>{f.titulo}</strong> },
          { label: "Género", render: (f) => f.genero || "—" },
          { label: "Clasif.", render: (f) => <span className="pill">{f.clasificacion}</span> },
          { label: "Duración", render: (f) => `${f.duracion_min} min`, num: true },
          { label: "Funciones (7 días)", render: (f) => f.funciones.length, num: true },
          { label: "Estreno", render: (f) => (f.estreno ? "★" : "") },
          { label: "Estado", render: activo },
        ]}
      />

      <Crud
        titulo="Funciones"
        subtitulo="Horarios de cada película. Las pasadas ya no se muestran en la app."
        endpoint="/admin/funciones/"
        textoNuevo="Agregar función"
        nombreFila={(f) => `función del ${fecha(f.inicio, true)}`}
        inicial={{ pelicula: "", inicio: "", sala: "Sala 1", formato: "2D", idioma: "DOB", precio: "35" }}
        campos={[
          { k: "pelicula", label: "Película", tipo: "select", opciones: opcionesPeliculas, requerido: true },
          { k: "inicio", label: "Fecha y hora", tipo: "datetime", requerido: true },
          { k: "sala", label: "Sala" },
          { k: "formato", label: "Formato", tipo: "select", opciones: [["2D", "2D"], ["3D", "3D"]], requerido: true },
          { k: "idioma", label: "Idioma", tipo: "select", opciones: [["DOB", "Doblada"], ["SUB", "Subtitulada"]], requerido: true },
          { k: "precio", label: "Precio (Bs)", tipo: "decimal" },
        ]}
        columnas={[
          { label: "Película", render: (f) => opcionesPeliculas.find(([id]) => id === f.pelicula)?.[1] || f.pelicula },
          { label: "Cuándo", render: (f) => fecha(f.inicio, true) },
          { label: "Sala", render: (f) => f.sala || "—" },
          { label: "Formato", render: (f) => `${f.formato} · ${f.idioma_nombre}` },
          { label: "Precio", render: (f) => precio(f.precio), num: true },
        ]}
      />

      <Crud
        titulo="Eventos"
        subtitulo="El evento marcado como destacado sale en el Inicio de la app. Con cupos, el público reserva desde la app y recibe una entrada con QR."
        endpoint="/admin/eventos/"
        textoNuevo="Agregar evento"
        nombreFila={(f) => f.titulo}
        inicial={{ titulo: "", categoria: "MUSICA", inicio: "", fin: "", lugar: "", precio: "", cupos: "", espacio: "", descripcion: "", destacado: false, activo: true }}
        campos={[
          { k: "titulo", label: "Título", requerido: true },
          { k: "categoria", label: "Categoría", tipo: "select", opciones: CATEGORIAS, requerido: true },
          { k: "inicio", label: "Inicio", tipo: "datetime", requerido: true },
          { k: "fin", label: "Fin", tipo: "datetime" },
          { k: "lugar", label: "Lugar", ayuda: "Ej. Terraza, piso 4" },
          { k: "precio", label: "Precio (Bs)", tipo: "decimal", ayuda: "Vacío = entrada libre" },
          { k: "cupos", label: "Cupos", tipo: "number", ayuda: "Vacío = acceso libre, sin reserva" },
          { k: "espacio", label: "Espacio (Escenario abierto)", tipo: "select", opciones: opcionesEspacios, ayuda: "Para que no se crucen horarios" },
          { k: "empresa", label: "Organiza (empresa)", tipo: "select", opciones: opcionesEmpresas },
          { k: "descripcion", label: "Descripción", tipo: "textarea" },
          { k: "destacado", label: "Destacado en el Inicio", tipo: "checkbox" },
          { k: "activo", label: "Activo", tipo: "checkbox" },
        ]}
        columnas={[
          { label: "Evento", render: (f) => <strong>{f.titulo}</strong> },
          { label: "Categoría", render: (f) => <span className="pill">{f.categoria_nombre}</span> },
          { label: "Inicio", render: (f) => fecha(f.inicio, true) },
          { label: "Lugar", render: (f) => f.lugar || "—" },
          { label: "Precio", render: (f) => precio(f.precio), num: true },
          { label: "Acceso", render: (f) => (f.cupos ? `${f.reservados}/${f.cupos} reservados` : <span className="muted">Libre</span>) },
          { label: "Destacado", render: (f) => (f.destacado ? "★" : "") },
          { label: "Estado", render: activo },
        ]}
      />
    </>
  );
}
