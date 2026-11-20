import { useEffect, useLayoutEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";

const LARGO = 6;

interface Props {
  valor: string;
  onCambio: (valor: string) => void;
  /** Se llama al completar los 6 dígitos. */
  onCompleto?: (valor: string) => void;
  deshabilitado?: boolean;
  conError?: boolean;
  /** Cada vez que sube este número, el foco vuelve a la primera casilla (p. ej. tras un código incorrecto). */
  enfocar?: number;
}

/** Seis casillas para el código de verificación: acepta pegar, borrar y moverse con las flechas. */
export function CampoCodigo({ valor, onCambio, onCompleto, deshabilitado, conError, enfocar }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  // Valor vigente, también dentro del mismo evento: al mover el foco el estado de React todavía no se actualizó.
  const vigente = useRef(valor);
  useLayoutEffect(() => {
    vigente.current = valor;
  }, [valor]);

  useEffect(() => {
    if (enfocar) refs.current[0]?.focus();
  }, [enfocar]);

  function actualizar(nuevo: string, enfocarEn: number) {
    const limpio = nuevo.replace(/\D/g, "").slice(0, LARGO);
    vigente.current = limpio;
    onCambio(limpio);
    if (limpio.length === LARGO) onCompleto?.(limpio);
    refs.current[Math.min(enfocarEn, LARGO - 1)]?.focus();
  }

  function escribir(i: number, texto: string) {
    const digitos = texto.replace(/\D/g, "");
    if (!digitos) return;
    // El código no tiene huecos: un dígito escrito más allá del último se agrega al final.
    const actual = vigente.current;
    const pos = Math.min(i, actual.length);
    actualizar(actual.slice(0, pos) + digitos + actual.slice(pos + 1), pos + digitos.length);
  }

  function teclado(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const actual = vigente.current;
      if (actual[i]) actualizar(actual.slice(0, i) + actual.slice(i + 1), i);
      else if (i > 0) actualizar(actual.slice(0, i - 1) + actual.slice(i), i - 1);
    } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < LARGO - 1) refs.current[i + 1]?.focus();
  }

  function pegar(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    actualizar(e.clipboardData.getData("text"), LARGO);
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="Código de 6 dígitos">
      {Array.from({ length: LARGO }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={valor[i] ?? ""}
          onChange={(e) => escribir(i, e.target.value)}
          onKeyDown={(e) => teclado(i, e)}
          onPaste={pegar}
          onFocus={(e) => {
            // no se puede empezar en el medio de un hueco: el foco va a la primera casilla vacía
            if (i > vigente.current.length) refs.current[vigente.current.length]?.focus();
            else e.target.select();
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={LARGO}
          disabled={deshabilitado}
          aria-label={`Dígito ${i + 1}`}
          autoFocus={i === 0}
          // flex-1 con tope: en pantallas de 320 px las casillas se encogen y no se salen de la columna
          className={`h-14 min-w-0 max-w-11 flex-1 rounded-lg border bg-surface-container-low text-center font-headline-md text-headline-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 ${
            conError ? "border-error" : "border-outline-variant"
          }`}
        />
      ))}
    </div>
  );
}
