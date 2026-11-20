import { Configuracion as ReglasMonedas } from "./Monedas";

/** Ajustes generales del Paseo. Hoy: las reglas de las monedas (valor, visitas y límites de compra). */
export default function Configuracion() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Configuración</h1>
          <p>Reglas generales que usan la app, la caja y Jarvis. Los rangos de compra, puntos de escaneo y recompensas están en Paseo Points.</p>
        </div>
      </div>
      <ReglasMonedas />
    </>
  );
}
