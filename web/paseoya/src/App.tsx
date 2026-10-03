import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { ProductosPage } from "./pages/ProductosPage";
import { PedidosPage } from "./pages/PedidosPage";
import { NegocioPage } from "./pages/NegocioPage";
import { PedidosProvider } from "./context/PedidosContext";
import { NegocioProvider } from "./context/NegocioContext";

function App() {
  return (
    <NegocioProvider>
      <PedidosProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-background font-body-md text-on-surface antialiased">
            <Sidebar />
            <div className="pl-72">
              <Header />
              <main className="w-full pt-16 px-space-lg py-space-lg bg-background min-h-screen">
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

export default App;
