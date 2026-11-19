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

export type ChartRow = Record<string, string | number> & { fecha?: string };

interface TooltipRow {
  payload: ChartRow;
  value?: string | number;
}

interface TooltipRendererProps {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string | number;
}

interface TooltipLine {
  label: string;
  valor: string;
  color: string;
}

function Caja({ titulo, filas }: { titulo: string; filas: TooltipLine[] }) {
  return (
    <div className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-space-md py-space-sm text-body-sm text-on-surface shadow-lg">
      <div className="mb-1 font-label-md text-label-md text-on-surface-variant">{titulo}</div>
      {filas.map((fila) => (
        <div className="flex items-center gap-space-sm" key={fila.label}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: fila.color }} />
          <span>{fila.label}: <strong>{fila.valor}</strong></span>
        </div>
      ))}
    </div>
  );
}

/** Rellena con 0 los días sin datos para que la serie no salte días. */
export function completarDias(
  filas: ChartRow[] | null | undefined,
  desde: string,
  hasta: string,
  campos: string[],
): ChartRow[] {
  const porFecha = Object.fromEntries((filas || []).map((fila) => [fila.fecha, fila]));
  const salida: ChartRow[] = [];
  for (let dia = new Date(`${desde}T00:00:00`); isoLocal(dia) <= hasta; dia.setDate(dia.getDate() + 1)) {
    const key = isoLocal(dia);
    const fila: ChartRow = { fecha: key };
    campos.forEach((campo) => { fila[campo] = Number(porFecha[key]?.[campo] ?? 0); });
    salida.push(fila);
  }
  return salida;
}

interface ExtraSerie {
  campo: string;
  nombre: string;
  formato: (value: unknown) => string;
}

interface SerieDiariaProps {
  data: ChartRow[];
  campo: string;
  nombre: string;
  color: string;
  extra?: ExtraSerie[];
}

/** Serie diaria de área con valores adicionales en el tooltip. */
export function SerieDiaria({ data, campo, nombre, color, extra = [] }: SerieDiariaProps) {
  return (
    <div className="h-60 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id={`g-${campo}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-outline-variant)" />
          <XAxis dataKey="fecha" stroke="var(--color-outline-variant)" tick={{ fill: "var(--color-on-surface-variant)", fontSize: 11 }} tickLine={false} tickFormatter={(value: string) => fecha(value)} minTickGap={28} />
          <YAxis stroke="var(--color-outline-variant)" tick={{ fill: "var(--color-on-surface-variant)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          <Tooltip
            cursor={{ stroke: "var(--color-outline)" }}
            content={(props) => {
              const { active, payload, label } = props as unknown as TooltipRendererProps;
              const primera = payload?.[0];
              if (!active || !primera) return null;
              return (
                <Caja
                  titulo={fecha(String(label ?? ""))}
                  filas={[
                    { label: nombre, valor: num(primera.payload[campo]), color },
                    ...extra.map((linea) => ({
                      label: linea.nombre,
                      valor: linea.formato(primera.payload[linea.campo]),
                      color: "var(--color-outline)",
                    })),
                  ]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey={campo}
            name={nombre}
            stroke={color}
            strokeWidth={2}
            fill={`url(#g-${campo})`}
            activeDot={{ r: 5, stroke: "var(--color-surface-container-lowest)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface BarrasProps {
  data: ChartRow[];
  x: string;
  y: string;
  nombre: string;
  color: string;
  formatoX?: (value: string | number) => string;
}

/** Barras verticales para horas pico y días de la semana. */
export function Barras({ data, x, y, nombre, color, formatoX = String }: BarrasProps) {
  return (
    <div className="h-60 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--color-outline-variant)" />
          <XAxis dataKey={x} stroke="var(--color-outline-variant)" tick={{ fill: "var(--color-on-surface-variant)", fontSize: 11 }} tickLine={false} tickFormatter={formatoX} interval={0} />
          <YAxis stroke="var(--color-outline-variant)" tick={{ fill: "var(--color-on-surface-variant)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          <Tooltip
            cursor={{ fill: "var(--color-surface-container-low)" }}
            content={(props) => {
              const { active, payload, label } = props as unknown as TooltipRendererProps;
              const primera = payload?.[0];
              if (!active || !primera) return null;
              return (
                <Caja
                  titulo={formatoX(label ?? "")}
                  filas={[{ label: nombre, valor: num(primera.value), color }]}
                />
              );
            }}
          />
          <Bar dataKey={y} name={nombre} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
