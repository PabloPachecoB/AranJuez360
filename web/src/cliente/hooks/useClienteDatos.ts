import { useEffect, useState } from "react";
import { api } from "../../api/client";

interface Estado<T> {
  clave: string;
  data: T | null;
  error: string | null;
  cargando: boolean;
}

export function useClienteDatos<T>(path: string, auth = true) {
  const [version, setVersion] = useState(0);
  const clave = `${path}|${auth}|${version}`;
  const [estado, setEstado] = useState<Estado<T>>({ clave: "", data: null, error: null, cargando: true });

  useEffect(() => {
    let vigente = true;
    api<T>(path, { auth })
      .then((data) => {
        if (vigente) setEstado({ clave, data, error: null, cargando: false });
      })
      .catch((err: unknown) => {
        if (vigente) setEstado({ clave, data: null, error: err instanceof Error ? err.message : "No se pudo cargar la información.", cargando: false });
      });
    return () => { vigente = false; };
  }, [path, auth, clave]);

  const actualizado = estado.clave === clave;
  return {
    data: actualizado ? estado.data : null,
    error: actualizado ? estado.error : null,
    cargando: !actualizado || estado.cargando,
    recargar: () => setVersion((actual) => actual + 1),
  };
}