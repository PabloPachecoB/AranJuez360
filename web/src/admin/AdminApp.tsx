import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AdminMobileHeader } from "./components/AdminMobileHeader";
import { AdminSidebar } from "./components/AdminSidebar";
import { SidebarProvider } from "./components/SidebarContext";
import ClienteHistorial from "./pages/ClienteHistorial";
import Dashboard from "./pages/Dashboard";
import Empresas from "./pages/Empresas";
import MapaEspacios from "./pages/MapaInteractivoPage";
import Usuarios from "./pages/Usuarios";
import Paseo360 from "../paseo360/Paseo360";
import Diversion from "../paseo360/pages/Diversion";
import Escenario from "../paseo360/pages/Escenario";
import Invitaciones from "../paseo360/pages/Invitaciones";
import Monedas from "../paseo360/pages/Monedas";
import PedidosAdmin from "../paseo360/pages/PedidosAdmin";
import AsistenteAdmin from "../paseo360/pages/AsistenteAdmin";
import Auditoria from "../paseo360/pages/Auditoria";
import Categorias from "../paseo360/pages/Categorias";
import Configuracion from "../paseo360/pages/Configuracion";
import Equipo from "../paseo360/pages/Equipo";
import Reportes from "../paseo360/pages/Reportes";
import Representantes from "../paseo360/pages/Representantes";

function Layout() {
  return (
    <SidebarProvider>
      <div className="admin-shell min-h-screen bg-background text-on-surface md:grid md:grid-cols-[16.5rem_minmax(0,1fr)]">
        <AdminSidebar />
        <div className="min-w-0 md:col-start-2">
          <AdminMobileHeader />
          <main className="min-w-0 px-space-md py-space-lg md:px-space-xl md:py-space-xl">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function AdminApp() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="empresas" element={<Empresas />} />
        <Route path="mapa-espacios" element={<MapaEspacios />} />
        <Route path="invitaciones" element={<Paseo360><Invitaciones /></Paseo360>} />
        <Route path="monedas" element={<Paseo360><Monedas /></Paseo360>} />
        <Route path="diversion" element={<Paseo360><Diversion /></Paseo360>} />
        <Route path="pedidos" element={<Paseo360><PedidosAdmin /></Paseo360>} />
        <Route path="escenario" element={<Paseo360><Escenario /></Paseo360>} />
        <Route path="categorias" element={<Paseo360><Categorias /></Paseo360>} />
        <Route path="representantes" element={<Paseo360><Representantes /></Paseo360>} />
        <Route path="equipo" element={<Paseo360><Equipo /></Paseo360>} />
        <Route path="reportes" element={<Paseo360><Reportes /></Paseo360>} />
        <Route path="asistente" element={<Paseo360><AsistenteAdmin /></Paseo360>} />
        <Route path="auditoria" element={<Paseo360><Auditoria /></Paseo360>} />
        <Route path="configuracion" element={<Paseo360><Configuracion /></Paseo360>} />
        <Route path="clientes/:id" element={<ClienteHistorial />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
