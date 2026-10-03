import { useEffect, useState } from "react";
import { api } from "../api";
import { useApi } from "../components/ui";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const TEXTOS = {
  OFICINA: ["Horario de atención", "Cuándo atiendes a tus visitantes. Las visitas se agendan dentro de este horario."],
  EMPRENDIMIENTO: ["Días y horarios en el Paseo", "Marca los días que vas a estar y en qué horario; los demás, como cerrado."],
  NEGOCIO: ["Horarios", "Tu horario de atención al público."],
};

/** Semana completa: abre/cierra por día o cerrado. */
export default function Horarios({ empresa }) {
  const actuales = useApi("/mi-empresa/horarios/");
  const [semana, setSemana] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!actuales.data) return;
    setSemana(DIAS.map((_, dia) => {
      const h = actuales.data.find((x) => x.dia === dia);
      return h
        ? { dia, abre: h.abre?.slice(0, 5) || "", cierra: h.cierra?.slice(0, 5) || "", cerrado: h.cerrado }
        : { dia, abre: "10:00", cierra: "20:00", cerrado: true };
    }));
  }, [actuales.data]);

  if (!semana) return <div className="empty">Cargando…</div>;
  const set = (dia, cambio) => setSemana(semana.map((h) => (h.dia === dia ? { ...h, ...cambio } : h)));

  const guardar = async () => {
    setMsg(null);
    try {
      await api("/mi-empresa/horarios/", {
        method: "PUT",
        body: semana.map((h) => (h.cerrado ? { dia: h.dia, cerrado: true, abre: null, cierra: null } : { ...h, cerrado: false })),
      });
      setMsg("Horarios guardados.");
    } catch (err) {
      setMsg(err.message);
    }
  };

  const [titulo, texto] = TEXTOS[empresa.tipo];
  return (
    <>
      <div className="page-head"><div><h1>{titulo}</h1><p>{texto}</p></div></div>
      <section className="card">
        <table>
          <thead><tr><th>Día</th><th>Abre</th><th>Cierra</th><th>{empresa.tipo === "EMPRENDIMIENTO" ? "No estaré" : "Cerrado"}</th></tr></thead>
          <tbody>
            {semana.map((h) => (
              <tr key={h.dia}>
                <td><strong>{DIAS[h.dia]}</strong></td>
                <td><input className="input" type="time" value={h.abre} disabled={h.cerrado} onChange={(e) => set(h.dia, { abre: e.target.value })} /></td>
                <td><input className="input" type="time" value={h.cierra} disabled={h.cerrado} onChange={(e) => set(h.dia, { cierra: e.target.value })} /></td>
                <td><input type="checkbox" checked={h.cerrado} onChange={(e) => set(h.dia, { cerrado: e.target.checked })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 14 }}>
          <button className="btn" onClick={guardar}>Guardar horarios</button>
          {msg && <span className="muted" style={{ marginLeft: 10 }}>{msg}</span>}
        </div>
      </section>
    </>
  );
}
