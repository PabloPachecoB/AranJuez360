import { useEffect, useState } from "react";

// Mientras no exista el backend real (ver docs/BASE_PROYECTO_PASEO.md), guardamos
// el estado mock en localStorage para que sobreviva recargas de página — incluidas
// las que dispara Vite al reiniciar el servidor por cambios de config durante el
// desarrollo en paralelo. Reemplazar por llamadas reales a la API cuando exista.
export function usePersistentState<T>(key: string, valorInicial: T) {
  const [valor, setValor] = useState<T>(() => {
    try {
      const guardado = localStorage.getItem(key);
      return guardado ? (JSON.parse(guardado) as T) : valorInicial;
    } catch {
      return valorInicial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(valor));
    } catch {
      // almacenamiento lleno o no disponible — no es crítico para el demo
    }
  }, [key, valor]);

  return [valor, setValor] as const;
}
