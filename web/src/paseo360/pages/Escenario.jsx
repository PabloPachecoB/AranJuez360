import { useState } from "react";
import Crud, { activo } from "../Crud";
import { api, qs } from "../api";
import { Estado, useApi } from "../ui";
import { fecha } from "../format";

const FILTROS = [["PENDIENTE", "Pendientes"], ["APROBADA", "Aprobadas"], ["RECHAZADA", "Rechazadas"], ["", "Todas"]];
const COLOR = { PENDIENTE: "", APROBADA: "on", RECHAZADA: "off", CANCELADA: "off" };
const hora = (iso) => new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false });

/** Aprobar una solicitud: el admin decide si es de acceso libre o con cupos (y cuántos). */
function Aprobar({ propuesta, onListo }) {
  const [acceso, setAcceso] = useState(propuesta.acceso);
  const [cupos, setCupos] = useState(String(Math.min(propuesta.personas, propuesta.espacio_capacidad)));
  const [destacado, setDestacado] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const aprobar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await api(`/admin/propuestas/${propuesta.id}/aprobar/`, {
        method: "POST", body: { acceso, cupos: acceso === "CUPOS" ? Number(cupos) : null, destacado },
      });
      onListo(`"${propuesta.titulo}" aprobada y publicada en la app.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const rechazar = async () => {
    const motivo = window.prompt(`¿Por qué no se aprueba "${propuesta.titulo}"? (se lo enviamos por correo)`);
    if (!motivo) return;
    try {
      await api(`/admin/propuestas/${propuesta.id}/rechazar/`, { method: "POST", body: { motivo } });
      onListo(`"${propuesta.titulo}" rechazada. Se le avisó a ${propuesta.solicitante_email}.`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="aprobar">
      <label className="campo"><span>Acceso</span>
        <select className="select" value={acceso} onChange={(e) => setAcceso(e.target.value)}>
          <option value="LIBRE">Acceso libre (sin reserva)</option>
          <option value="CUPOS">Con cupos (se reserva en la app)</option>
        </select></label>
      {acceso === "CUPOS" && (
        <label className="campo"><span>Cupos (máx. {propuesta.espacio_capacidad})</span>
          <input className="input" type="number" min="1" max={propuesta.espacio_capacidad} value={cupos}
            onChange={(e) => setCupos(e.target.value)} /></label>
      )}
      <label className="campo check"><input type="checkbox" checked={destacado} onChange={(e) => setDestacado(e.target.checked)} />
        <span>Destacar en el Inicio</span></label>
      <div className="acciones">
        <button className="btn" disabled={enviando || propuesta.conflictos.some((c) => c.tipo === "evento")} onClick={aprobar}>
          {enviando ? "Publicando…" : "Aprobar y publicar"}
        </button>
        <button className="btn ghost" onClick={rechazar}>Rechazar</button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function Tarjeta({ p, onListo }) {
  const pendiente = p.estado === "PENDIENTE";
  return (
    <article className="card propuesta">
      <div className="propuesta-cabecera">
        <div>
          <span className="pill">{p.tipo_nombre}</span>{" "}
          <span className={`pill ${COLOR[p.estado]}`}>{p.estado_nombre}</span>
          <h2>{p.titulo}</h2>
          <p className="sub">por <strong>{p.artista}</strong></p>
        </div>
        <div className="cuando">
          <strong>{fecha(p.inicio)}</strong>
          <span>{hora(p.inicio)} – {hora(p.fin)}</span>
        </div>
      </div>

      <dl className="propuesta-datos">
        <div><dt>Espacio</dt><dd>{p.espacio_nombre}<br /><span className="muted">{p.espacio_lugar}</span></dd></div>
        <div><dt>Público</dt><dd>{p.personas} personas <span className="muted">(caben {p.espacio_capacidad})</span></dd></div>
        <div><dt>Pide</dt><dd>{p.acceso_nombre}</dd></div>
        <div><dt>Solicitante</dt><dd>{p.solicitante_nombre}<br /><span className="muted">{p.solicitante_email}{p.solicitante_celular ? ` · ${p.solicitante_celular}` : ""}</span></dd></div>
      </dl>
      <p>{p.descripcion}</p>
      {p.necesidades && <p><strong>Necesita:</strong> {p.necesidades}</p>}

      {pendiente && p.conflictos.length > 0 && (
        <div className="choque">
          <strong>⚠ Se cruza con:</strong>
          <ul>
            {p.conflictos.map((c, i) => (
              <li key={i}>{c.tipo === "evento" ? "Evento publicado" : "Otra solicitud"}: {c.titulo} ({hora(c.inicio)}{c.fin ? `–${hora(c.fin)}` : ""})</li>
            ))}
          </ul>
          {p.conflictos.some((c) => c.tipo === "evento") && <span>El espacio está ocupado: no se puede aprobar en este horario.</span>}
        </div>
      )}

      {pendiente && <Aprobar propuesta={p} onListo={onListo} />}
      {p.estado === "APROBADA" && (
        <p className="aviso-ok">
          Publicada · {p.cupos ? `${p.reservados} de ${p.cupos} cupos reservados` : "acceso libre"}
          {p.revisada_por_nombre ? ` · aprobó ${p.revisada_por_nombre}` : ""}
        </p>
      )}
      {p.estado === "RECHAZADA" && <p className="muted">Motivo: {p.motivo_rechazo}</p>}
    </article>
  );
}

/** Escenario abierto: la comunidad pide un espacio para presentarse y el admin aprueba según disponibilidad. */
export default function Escenario() {
  const [estado, setEstado] = useState("PENDIENTE");
  const lista = useApi(`/admin/propuestas/${qs({ estado })}`);
  const [msg, setMsg] = useState(null);
  const filas = lista.data?.results || [];

  const listo = (texto) => {
    setMsg(texto);
    lista.recargar();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Escenario abierto</h1>
          <p>Músicos, podcasts, talleres y charlas que la comunidad propone desde la app. Al aprobar, se publica como evento con acceso libre o con cupos.</p>
        </div>
      </div>

      <div className="filters">
        <div className="segmented">
          {FILTROS.map(([k, t]) => <button key={k} aria-pressed={estado === k} onClick={() => setEstado(k)}>{t}</button>)}
        </div>
      </div>
      {msg && <p className="aviso-ok">{msg}</p>}

      <Estado cargando={lista.cargando && !lista.data} error={lista.error} vacio={false}>
        {filas.length ? (
          <div className="grid propuestas">{filas.map((p) => <Tarjeta key={p.id} p={p} onListo={listo} />)}</div>
        ) : (
          <div className="card"><div className="empty">No hay solicitudes en esta lista.</div></div>
        )}
      </Estado>

      <Crud
        titulo="Espacios"
        subtitulo="Lugares que se pueden pedir desde la app. La capacidad limita el público y los cupos."
        endpoint="/admin/espacios/"
        textoNuevo="Agregar espacio"
        nombreFila={(f) => f.nombre}
        inicial={{ nombre: "", lugar: "", capacidad: 50, descripcion: "", equipamiento: "", activo: true }}
        campos={[
          { k: "nombre", label: "Nombre", requerido: true },
          { k: "lugar", label: "Ubicación", requerido: true, ayuda: "Ej. El Club, piso 3" },
          { k: "capacidad", label: "Capacidad (personas)", tipo: "number", requerido: true },
          { k: "equipamiento", label: "Equipamiento", tipo: "textarea", ayuda: "Sonido, micrófonos, proyector..." },
          { k: "descripcion", label: "Descripción", tipo: "textarea" },
          { k: "activo", label: "Disponible para solicitudes", tipo: "checkbox" },
        ]}
        columnas={[
          { label: "Espacio", render: (f) => <strong>{f.nombre}</strong> },
          { label: "Ubicación", render: (f) => f.lugar },
          { label: "Capacidad", render: (f) => f.capacidad, num: true },
          { label: "Equipamiento", render: (f) => f.equipamiento || "—" },
          { label: "Estado", render: activo },
        ]}
      />
    </>
  );
}
