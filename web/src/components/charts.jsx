import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fecha, isoLocal, num } from "../format";

const EJE = { stroke: "var(--axis)", tick: { fill: "var(--muted)", fontSize: 11 }, tickLine: false };

function Caja({ titulo, filas }) {
  return (
    <div className="tt">
      <div className="tt-title">{titulo}</div>
      {filas.map((f) => (
        <div className="tt-row" key={f.label}>
          <span className="dot" style={{ background: f.color }} />
          {f.label}: <strong>{f.valor}</strong>
        </div>
      ))}
    </div>
  );
}

/** Rellena con 0 los días sin datos para que la serie no salte días. */
export function completarDias(filas, desde, hasta, campos) {
  const porFecha = Object.fromEntries((filas || []).map((f) => [f.fecha, f]));
  const out = [];
  for (let d = new Date(`${desde}T00:00:00`); isoLocal(d) <= hasta; d.setDate(d.getDate() + 1)) {
    const k = isoLocal(d);
    const base = { fecha: k };
    campos.forEach((c) => { base[c] = Number(porFecha[k]?.[c] ?? 0); });
    out.push(base);
  }
  return out;
}

/** Serie diaria (área). `extra` agrega filas al tooltip, p. ej. clientes distintos. */
export function SerieDiaria({ data, campo, nombre, color, extra = [] }) {
  return (
    <div className="chart">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id={`g-${campo}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="fecha" {...EJE} tickFormatter={(v) => fecha(v)} minTickGap={28} />
          <YAxis {...EJE} axisLine={false} allowDecimals={false} width={44} />
          <Tooltip
            cursor={{ stroke: "var(--axis)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <Caja
                  titulo={fecha(label)}
                  filas={[
                    { label: nombre, valor: num(payload[0].payload[campo]), color },
                    ...extra.map((e) => ({ label: e.nombre, valor: e.formato(payload[0].payload[e.campo]), color: "transparent" })),
                  ]}
                />
              ) : null
            }
          />
          <Area type="monotone" dataKey={campo} name={nombre} stroke={color} strokeWidth={2}
            fill={`url(#g-${campo})`} activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras verticales de una sola serie (horas pico, días de la semana). */
export function Barras({ data, x, y, nombre, color, formatoX = (v) => v }) {
  return (
    <div className="chart">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey={x} {...EJE} tickFormatter={formatoX} interval={0} />
          <YAxis {...EJE} axisLine={false} allowDecimals={false} width={44} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <Caja titulo={formatoX(label)} filas={[{ label: nombre, valor: num(payload[0].value), color }]} />
              ) : null
            }
          />
          <Bar dataKey={y} name={nombre} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
