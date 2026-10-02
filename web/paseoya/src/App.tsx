import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { ProductosPage } from "./pages/ProductosPage";
import { PedidosPage } from "./pages/PedidosPage";
import { ProximamentePage } from "./pages/ProximamentePage";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar />
        <main className="contenido">
          <Routes>
            <Route path="/" element={<Navigate to="/productos" replace />} />
            <Route path="/productos" element={<ProductosPage />} />
            <Route path="/pedidos" element={<PedidosPage />} />
            <Route path="/negocio" element={<ProximamentePage titulo="Mi negocio" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
