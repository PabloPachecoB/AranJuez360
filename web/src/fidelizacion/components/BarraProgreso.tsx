import { formatearBs } from "../formato";

interface Props {
  sobrante: string;
  bsPorPunto: string;
  faltan: string;
}

/** Barra hacia el siguiente punto: lo acumulado dentro del tramo de Bs por punto. */
export function BarraProgreso({ sobrante, bsPorPunto, faltan }: Props) {
  const total = Number(bsPorPunto) || 1;
  const pct = Math.max(0, Math.min(100, (Number(sobrante) / total) * 100));
  return (
    <div>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-white/20"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Avance hacia el siguiente punto"
      >
        <div className="h-full rounded-full bg-tertiary-fixed-dim transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 flex justify-between font-label-md text-label-md text-white/80">
        <span>
          {formatearBs(sobrante)} / {formatearBs(bsPorPunto)}
        </span>
        <span>Faltan {formatearBs(faltan)}</span>
      </p>
    </div>
  );
}
