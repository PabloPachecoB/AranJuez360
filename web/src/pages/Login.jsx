import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Login() {
  const { verificar } = useAuth();
  const [paso, setPaso] = useState(null); // respuesta del paso 1: { desafio, email, ... }
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      if (!paso) {
        setPaso(await api("/auth/login/", { method: "POST", body: { email, password } }));
      } else {
        await verificar(paso.desafio, codigo);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login">
      <form className="card" onSubmit={enviar}>
        <h1>Paseo Aranjuez 360</h1>
        <p className="muted" style={{ margin: 0 }}>Panel de administración</p>

        {!paso ? (
          <>
            <label htmlFor="email">Correo</label>
            <input id="email" className="input" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <label htmlFor="password">Contraseña</label>
            <input id="password" className="input" type="password" autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </>
        ) : (
          <>
            <p style={{ marginTop: 18 }}>
              Enviamos un código de 6 dígitos a <strong>{paso.email}</strong>. Vence en {paso.vence_en_minutos} minutos.
            </p>
            <label htmlFor="codigo">Código de verificación</label>
            <input id="codigo" className="input codigo" inputMode="numeric" autoComplete="one-time-code"
              maxLength={6} autoFocus required value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} />
          </>
        )}

        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={cargando}>
          {cargando ? "Un momento…" : paso ? "Verificar y entrar" : "Continuar"}
        </button>
        {paso && (
          <button type="button" className="btn ghost" onClick={() => { setPaso(null); setCodigo(""); setError(null); }}>
            Volver
          </button>
        )}
      </form>
    </div>
  );
}
