import { Navigate, Route, Routes } from "react-router-dom";
import "./cliente.css";
import { ClienteLayout } from "./components/ClienteLayout";
import {
  ClienteInicioPage,
  ClientePasePage,
  ClientePuntosPage,
  ClienteRecompensasPage,
  ClienteCuponesPage,
  ClienteMovimientosPage,
  ClienteExplorarPage,
  ClientePerfilPage,
} from "./pages/ClientePages";

export function ClienteApp() {
  return (
    <Routes>
      <Route element={<ClienteLayout />}>
        <Route index element={<ClienteInicioPage />} />
        <Route path="pase" element={<ClientePasePage />} />
        <Route path="puntos" element={<ClientePuntosPage />} />
        <Route path="recompensas" element={<ClienteRecompensasPage />} />
        <Route path="cupones" element={<ClienteCuponesPage />} />
        <Route path="movimientos" element={<ClienteMovimientosPage />} />
        <Route path="explorar" element={<ClienteExplorarPage />} />
        <Route path="perfil" element={<ClientePerfilPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
