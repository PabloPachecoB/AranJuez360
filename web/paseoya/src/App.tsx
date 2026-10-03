import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Sidebar } from "./empleado/components/Sidebar";
import { Header } from "./empleado/components/Header";
import { ProductosPage } from "./empleado/pages/ProductosPage";
import { PedidosPage } from "./empleado/pages/PedidosPage";
import { NegocioPage } from "./empleado/pages/NegocioPage";
import { LoginPage } from "./auth/LoginPage";
import { PedidosProvider } from "./empleado/context/PedidosContext";
import { NegocioProvider } from "./empleado/context/NegocioContext";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ClienteApp } from "./cliente/ClienteApp";
// @ts-expect-error Admin screens are existing JSX modules.
import AdminApp from "./admin/AdminApp.jsx";

function PanelAutenticado() {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <NegocioProvider>
      <PedidosProvider>
        <div className="min-h-screen bg-background font-body-md text-on-surface antialiased">
          <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
          <div className="md:pl-72">
            <Header onAbrirMenu={() => setMenuAbierto(true)} />
            <main className="w-full pt-16 px-space-md md:px-space-lg py-space-lg bg-background min-h-screen overflow-x-hidden">
              <Routes>
                <Route path="/" element={<Navigate to="/productos" replace />} />
                <Route path="/productos" element={<ProductosPage />} />
                <Route path="/pedidos" element={<PedidosPage />} />
                <Route path="/negocio" element={<NegocioPage />} />
              </Routes>
            </main>
          </div>
        </div>
      </PedidosProvider>
    </NegocioProvider>
  );
}

function Contenido() {
  const { usuario, cargando, cerrarSesion } = useAuth();

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-surface-variant font-body-md text-body-md">
        Cargando...
      </div>
    );
  }

  if (!usuario) return <LoginPage />;
  if (usuario.rol === "ADMIN") return <AdminApp />;
  if (usuario.rol === "NEGOCIO") return <PanelAutenticado />;
  if (usuario.rol === "CLIENTE") return <ClienteApp />;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-on-surface">
      <p>El panel para el rol {usuario.rol} todavía no está disponible.</p>
      <button
        type="button"
        onClick={cerrarSesion}
        className="rounded-lg bg-primary px-space-md py-space-sm text-on-primary"
      >
        Cerrar sesión
      </button>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Contenido />
    </AuthProvider>
  );
}

export default App;
