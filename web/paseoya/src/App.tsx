import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { ProductosPage } from "./pages/ProductosPage";
import { PedidosPage } from "./pages/PedidosPage";
import { NegocioPage } from "./pages/NegocioPage";
import { LoginPage } from "./pages/LoginPage";
import { PedidosProvider } from "./context/PedidosContext";
import { NegocioProvider } from "./context/NegocioContext";
import { AuthProvider, useAuth } from "./context/AuthContext";

function PanelAutenticado() {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <NegocioProvider>
      <PedidosProvider>
        <BrowserRouter>
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
        </BrowserRouter>
      </PedidosProvider>
    </NegocioProvider>
  );
}

function Contenido() {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-surface-variant font-body-md text-body-md">
        Cargando...
      </div>
    );
  }

  return usuario ? <PanelAutenticado /> : <LoginPage />;
}

function App() {
  return (
    <AuthProvider>
      <Contenido />
    </AuthProvider>
  );
}

export default App;
