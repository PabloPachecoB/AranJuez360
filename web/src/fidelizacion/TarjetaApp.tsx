import { Navigate, Route, Routes } from "react-router-dom";
import { MiTarjetaPage } from "./pages/MiTarjetaPage";
import { RecuperarPage } from "./pages/RecuperarPage";
import { RegistroPage } from "./pages/RegistroPage";
import { VerificarPage } from "./pages/VerificarPage";

/** Páginas públicas de la tarjeta del Sorteo Paseo: no usan la sesión de los paneles. */
export default function TarjetaApp() {
  return (
    <Routes>
      <Route path="/tarjeta" element={<RegistroPage />} />
      <Route path="/tarjeta/verificar" element={<VerificarPage />} />
      <Route path="/tarjeta/recuperar" element={<RecuperarPage />} />
      <Route path="/tarjeta/mi" element={<MiTarjetaPage />} />
      <Route path="*" element={<Navigate to="/tarjeta" replace />} />
    </Routes>
  );
}
