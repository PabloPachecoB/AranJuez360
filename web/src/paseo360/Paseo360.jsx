import "./estilos.css";

/** Contenedor de las pantallas de Paseo 360: aplica sus estilos sin chocar con Tailwind. */
export default function Paseo360({ children }) {
  return <div className="p360">{children}</div>;
}
