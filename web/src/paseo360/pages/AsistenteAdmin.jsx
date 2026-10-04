import { useEffect, useRef, useState } from "react";
import { api } from "../api";

const SUGERENCIAS = [
  "¿Cómo nos fue en los últimos 30 días?",
  "¿Qué negocios venden más y cuáles no tienen actividad?",
  "¿De qué comunidades o provincias vienen más clientes y cuánto compran?",
  "Propón una campaña para jóvenes de 18 a 24 años",
  "¿Cuáles son las horas y días más flojos? ¿Qué promoción pondrías?",
  "¿Qué clientes dejaron de venir y cómo los recuperamos?",
];

const TEMAS = {
  resumen: "resumen general", compras_por_dia: "compras por día", visitas_por_dia: "visitas por día",
  horas_pico: "horas pico", dias_semana: "días de la semana", ranking_negocios: "ranking de negocios",
  negocios_sin_actividad: "negocios sin actividad", clientes_frecuentes: "clientes frecuentes",
  clientes_dormidos: "clientes dormidos", procedencia: "procedencia", perfil_edad_ocupacion: "edad y ocupación",
  mapa_clientes: "mapa de clientes", pedidos: "pedidos", escenario_eventos: "escenario y eventos",
  movimientos_recientes: "movimientos recientes",
};

/** Texto con **negritas** y viñetas simples, sin librerías. */
function Texto({ texto }) {
  const negritas = (t) => t.split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p));
  return texto.split("\n").map((l, i) => {
    const m = l.match(/^\s*[-*•]\s+(.*)/);
    if (m) return <div key={i} style={{ paddingLeft: 14, textIndent: -14 }}>• {negritas(m[1])}</div>;
    return l.trim() ? <div key={i}>{negritas(l)}</div> : <div key={i} style={{ height: 8 }} />;
  });
}

/** Chat del administrador con un analista de IA que consulta los datos reales del Paseo. */
export default function AsistenteAdmin() {
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const fin = useRef(null);

  useEffect(() => { fin.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [mensajes, pensando]);

  const enviar = async (pregunta) => {
    const mensaje = (pregunta ?? texto).trim();
    if (!mensaje || pensando) return;
    const historial = mensajes.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    setMensajes((m) => [...m, { role: "user", content: mensaje }]);
    setTexto("");
    setPensando(true);
    try {
      const r = await api("/agente/admin/analisis/chat/", { method: "POST", body: { mensaje, historial } });
      setMensajes((m) => [...m, { role: "assistant", content: r.respuesta, consultas: r.consultas }]);
    } catch (err) {
      setMensajes((m) => [...m, { role: "assistant", error: true, content: err.message || "No se pudo consultar al asistente." }]);
    } finally {
      setPensando(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Asistente de análisis</h1>
          <p>Pregúntale por compras, clientes, procedencia, pedidos o eventos. Responde con los datos reales del Paseo, encuentra patrones y sugiere campañas. Solo lee, no cambia nada.</p>
        </div>
        {mensajes.length > 0 && <button className="btn ghost" onClick={() => setMensajes([])}>Nueva conversación</button>}
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 420 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, maxHeight: "58vh", overflowY: "auto" }}>
          {mensajes.length === 0 && (
            <div>
              <p className="sub" style={{ marginTop: 0 }}>Prueba con una de estas preguntas:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SUGERENCIAS.map((s) => <button key={s} className="btn ghost" onClick={() => enviar(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {mensajes.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "86%" }}>
              <div style={{
                padding: "10px 14px", borderRadius: 12, lineHeight: 1.5,
                background: m.role === "user" ? "var(--brand)" : m.error ? "#fdecea" : "#f1f4f7",
                color: m.role === "user" ? "#fff" : m.error ? "#a12622" : "inherit",
              }}>
                <Texto texto={m.content} />
              </div>
              {m.consultas?.length > 0 && (
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Datos consultados: {[...new Set(m.consultas.map((c) => TEMAS[c.tema] || c.tema))].join(", ")}
                </div>
              )}
            </div>
          ))}
          {pensando && <div className="muted">Analizando los datos…</div>}
          <div ref={fin} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); enviar(); }} style={{ display: "flex", gap: 8 }}>
          <input
            value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000}
            placeholder="Escribe tu pregunta…" aria-label="Pregunta para el asistente"
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--axis)", font: "inherit" }}
          />
          <button className="btn" type="submit" disabled={pensando || !texto.trim()}>Enviar</button>
        </form>
      </div>
    </>
  );
}
