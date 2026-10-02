import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { ProductosPage } from "./pages/ProductosPage";
import { PedidosPage } from "./pages/PedidosPage";
import { NegocioPage } from "./pages/NegocioPage";
import { PedidosProvider } from "./context/PedidosContext";
import "./App.css";

function App() {
  return (
    <PedidosProvider>
      <BrowserRouter>
        <div className="layout">
          <Sidebar />
          <main className="contenido">
            <Routes>
              <Route path="/" element={<Navigate to="/productos" replace />} />
              <Route path="/productos" element={<ProductosPage />} />
              <Route path="/pedidos" element={<PedidosPage />} />
              <Route path="/negocio" element={<NegocioPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </PedidosProvider>
  );
}

export default App;
