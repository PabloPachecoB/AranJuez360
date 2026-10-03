import { api, apiForm } from "./client";

export interface DiaHorario {
  dia: number;
  dia_nombre: string;
  abre: string | null;
  cierra: string | null;
  cerrado: boolean;
}

export interface NegocioApi {
  id: number;
  nombre: string;
  tipo: string;
  categoria_nombre: string | null;
  email_contacto: string;
  telefono: string;
  descripcion: string;
  piso: string;
  local: string;
  referencia: string;
  logo: string | null;
  activo: boolean;
  horarios: DiaHorario[];
}

// nombre/tipo/email_contacto son de solo lectura en el backend (los pone el
// admin al crear la empresa) — por eso no están en este tipo de entrada.
export type NegocioInput = Partial<
  Pick<NegocioApi, "telefono" | "descripcion" | "piso" | "local" | "referencia" | "activo">
>;

export function obtenerMiEmpresa() {
  return api<NegocioApi>("/mi-empresa/");
}

export function actualizarMiEmpresa(datos: NegocioInput, logo?: File | null) {
  if (logo) {
    const fd = new FormData();
    for (const [clave, valor] of Object.entries(datos)) {
      if (valor === null || valor === undefined) continue;
      fd.append(clave, String(valor));
    }
    fd.append("logo", logo);
    return apiForm<NegocioApi>("/mi-empresa/", fd, "PATCH");
  }
  return api<NegocioApi>("/mi-empresa/", { method: "PATCH", body: datos });
}
