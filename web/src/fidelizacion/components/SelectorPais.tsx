import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { PAISES } from "../paises";

/* Banderas dibujadas (24 × 16), simplificadas para leerse en pequeño. Se dibujan en vez de usar emoji porque
   Windows no trae banderas en su fuente de emoji: ahí saldrían las letras «BO» en lugar de la bandera. */
const franjasH = (colores: string[]) =>
  colores.map((c, i) => <rect key={i} x="0" y={(16 / colores.length) * i} width="24" height={16 / colores.length} fill={c} />);
const franjasV = (colores: string[]) =>
  colores.map((c, i) => <rect key={i} x={(24 / colores.length) * i} y="0" width={24 / colores.length} height="16" fill={c} />);

const DIBUJOS: Record<string, ReactNode> = {
  BO: franjasH(["#D52B1E", "#F9E300", "#007934"]),
  AR: (
    <>
      {franjasH(["#74ACDF", "#FFFFFF", "#74ACDF"])}
      <circle cx="12" cy="8" r="1.7" fill="#F6B40E" />
    </>
  ),
  BR: (
    <>
      <rect width="24" height="16" fill="#009B3A" />
      <polygon points="12,2 21,8 12,14 3,8" fill="#FEDF00" />
      <circle cx="12" cy="8" r="3.1" fill="#002776" />
    </>
  ),
  CL: (
    <>
      <rect width="24" height="8" fill="#FFFFFF" />
      <rect y="8" width="24" height="8" fill="#D52B1E" />
      <rect width="8" height="8" fill="#0039A6" />
      <polygon points="4,1.8 4.7,3.4 6.4,3.4 5,4.5 5.5,6.2 4,5.2 2.5,6.2 3,4.5 1.6,3.4 3.3,3.4" fill="#FFFFFF" />
    </>
  ),
  CO: (
    <>
      <rect width="24" height="8" fill="#FCD116" />
      <rect y="8" width="24" height="4" fill="#003893" />
      <rect y="12" width="24" height="4" fill="#CE1126" />
    </>
  ),
  EC: (
    <>
      <rect width="24" height="8" fill="#FFDD00" />
      <rect y="8" width="24" height="4" fill="#034EA2" />
      <rect y="12" width="24" height="4" fill="#ED1C24" />
      <ellipse cx="12" cy="8" rx="2" ry="2.6" fill="#7A5C2E" stroke="#FFFFFF" strokeWidth="0.5" />
    </>
  ),
  ES: (
    <>
      <rect width="24" height="16" fill="#AA151B" />
      <rect y="4" width="24" height="8" fill="#F1BF00" />
    </>
  ),
  US: (
    <>
      <rect width="24" height="16" fill="#B22234" />
      {[1, 3, 5, 7, 9, 11].map((i) => (
        <rect key={i} y={(16 / 13) * i} width="24" height={16 / 13} fill="#FFFFFF" />
      ))}
      <rect width="10" height={(16 / 13) * 7} fill="#3C3B6E" />
    </>
  ),
  MX: (
    <>
      {franjasV(["#006847", "#FFFFFF", "#CE1126"])}
      <circle cx="12" cy="8" r="1.8" fill="#8A6D3B" />
    </>
  ),
  PY: (
    <>
      {franjasH(["#D52B1E", "#FFFFFF", "#0038A8"])}
      <circle cx="12" cy="8" r="1.6" fill="#FFFFFF" stroke="#2E7D32" strokeWidth="0.7" />
    </>
  ),
  PE: franjasV(["#D91023", "#FFFFFF", "#D91023"]),
  UY: (
    <>
      <rect width="24" height="16" fill="#FFFFFF" />
      {[1, 3, 5, 7].map((i) => (
        <rect key={i} y={(16 / 9) * i} width="24" height={16 / 9} fill="#0038A8" />
      ))}
      <rect width="9" height={(16 / 9) * 5} fill="#FFFFFF" />
      <circle cx="4.5" cy="4.4" r="2.2" fill="#FCD116" />
    </>
  ),
  VE: (
    <>
      {franjasH(["#FFCC00", "#00247D", "#CF142B"])}
      {[8.5, 10.2, 12, 13.8, 15.5].map((x, i) => (
        <circle key={x} cx={x} cy={8.6 - Math.sin(((i + 0.5) / 5) * Math.PI) * 1.4} r="0.55" fill="#FFFFFF" />
      ))}
    </>
  ),
};

function Bandera({ iso }: { iso: string }) {
  if (!DIBUJOS[iso]) {
    return (
      <span className="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden="true">
        public
      </span>
    );
  }
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6 shrink-0 rounded-[3px] ring-1 ring-black/10" aria-hidden="true">
      {DIBUJOS[iso]}
    </svg>
  );
}

interface Props {
  valor: string;
  onCambio: (codigo: string) => void;
}

/** Lista de países con bandera y código. Se maneja con toque, ratón o teclado (flechas, Enter y Escape). */
export function SelectorPais({ valor, onCambio }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const actual = PAISES.find((p) => p.codigo === valor) ?? PAISES[0];

  // Cerrar al tocar fuera.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierto]);

  function abrir() {
    setActivo(Math.max(0, PAISES.findIndex((p) => p.codigo === valor)));
    setAbierto(true);
  }

  function elegir(i: number) {
    onCambio(PAISES[i].codigo);
    setAbierto(false);
    boton.current?.focus();
  }

  function teclado(e: KeyboardEvent) {
    if (!abierto) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        abrir();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setAbierto(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => (i + 1) % PAISES.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => (i - 1 + PAISES.length) % PAISES.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      elegir(activo);
    } else if (e.key === "Tab") setAbierto(false);
  }

  return (
    <div ref={raiz} className="relative shrink-0" onKeyDown={teclado}>
      <button
        ref={boton}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={`País: ${actual.nombre}${actual.codigo ? ` ${actual.codigo}` : ""}`}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        className="flex h-12 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <Bandera iso={actual.iso} />
        <span>{actual.codigo || "Otro"}</span>
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant" aria-hidden="true">
          expand_more
        </span>
      </button>
      {abierto && (
        <ul
          role="listbox"
          aria-label="País"
          className="absolute left-0 z-10 mt-1 max-h-64 w-36 overflow-auto rounded-lg border border-outline-variant bg-surface-container-lowest py-1 shadow-lg"
        >
          {PAISES.map((p, i) => (
            <li
              key={p.nombre}
              role="option"
              aria-selected={p.codigo === valor}
              aria-label={`${p.nombre}${p.codigo ? ` ${p.codigo}` : ""}`}
              title={p.nombre}
              onClick={() => elegir(i)}
              onPointerEnter={() => setActivo(i)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 font-body-md text-body-md text-on-surface ${
                i === activo ? "bg-surface-container-high" : ""
              } ${p.codigo === valor ? "font-semibold" : ""}`}
            >
              <Bandera iso={p.iso} />
              <span>{p.codigo || "Otro"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
