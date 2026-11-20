import { api, ApiError } from "./apiClient";

async function llamar(metodo, url, body) {
  try {
    const { data } = await api.request({ method: metodo, url, data: body });
    return data;
  } catch (err) {
    throw new ApiError(err);
  }
}

const lista = (data) => data?.results ?? data ?? [];

// Directorio (público): las oficinas son empresas de tipo OFICINA.
export const getOficinas = async () => lista(await llamar("get", "/empresas/?tipo=OFICINA"));
export const getOficina = (id) => llamar("get", `/empresas/${id}/`);

// Cliente: solicitar visita y ver las suyas.
export const solicitarVisita = ({ oficina, fecha, hora, motivo }) =>
  llamar("post", "/oficinas/visitas/", { oficina, fecha, hora: hora || null, motivo });
export const getMisVisitas = async () => lista(await llamar("get", "/oficinas/visitas/"));
export const cancelarVisita = (id) => llamar("post", `/oficinas/visitas/${id}/cancelar/`);

// Portero: validar la invitación escaneada y registrar el ingreso.
export const validarInvitacion = (codigo) => llamar("get", `/porteria/invitaciones/${encodeURIComponent(codigo)}/`);
export const registrarIngresoOficina = (codigo) =>
  llamar("post", `/porteria/invitaciones/${encodeURIComponent(codigo)}/ingreso/`);
export const getInvitacionesHoy = () => llamar("get", "/porteria/invitaciones-hoy/");
export const registrarVisitaPaseo = (token) => llamar("post", "/porteria/visitas/", { token });
