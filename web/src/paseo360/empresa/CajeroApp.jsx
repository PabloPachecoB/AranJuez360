import Paseo360 from "../Paseo360";
import { useAuth } from "../auth";
import Caja from "./Caja";

/** Panel del cajero: solo la caja de su negocio (aprobar o rechazar compras). */
export default function CajeroApp() {
  const { user, salir } = useAuth();
  return (
    <Paseo360>
      <div className="cajero">
        <header className="cajero-barra">
          <div>
            <strong>{user?.empresa_nombre || "Mi negocio"}</strong>
            <span className="muted"> · Caja · {user?.first_name || user?.email}</span>
          </div>
          <button className="btn ghost small" onClick={salir}>Cerrar sesión</button>
        </header>
        <main className="main"><Caja /></main>
      </div>
    </Paseo360>
  );
}
