let siguienteSolicitud = 0;

/** Abre Jarvis en un borrador local y consume la intención una sola vez. */
export function abrirBorradorJarvis(navigation, params = {}) {
  siguienteSolicitud += 1;
  navigation.navigate("Asistente", {
    iniciarBorrador: true,
    solicitudId: `jarvis-${Date.now()}-${siguienteSolicitud}`,
    ...params,
  });
}
