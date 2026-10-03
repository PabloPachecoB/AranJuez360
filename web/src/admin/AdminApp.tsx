import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AdminMobileHeader } from "./components/AdminMobileHeader";
import { AdminSidebar } from "./components/AdminSidebar";
import { SidebarProvider } from "./components/SidebarContext";
import ClienteHistorial from "./pages/ClienteHistorial";
import Dashboard from "./pages/Dashboard";
import Empresas from "./pages/Empresas";
import Usuarios from "./pages/Usuarios";

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
        <Route path="clientes/:id" element={<ClienteHistorial />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
