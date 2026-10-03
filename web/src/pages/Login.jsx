import { useState } from "react";
import { useAuth } from "../auth";

export default function Login() {
  const { iniciarSesion } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try { await iniciarSesion(email.trim().toLowerCase(), password); }
    catch (err) { setError(err.message); }
    finally { setCargando(false); }
  };
  return (
    <div className="login">
      <form className="card" onSubmit={enviar}>
        <h1>Paseo Aranjuez 360</h1>
        <p className="muted" style={{ margin: 0 }}>Ingresa a tu cuenta</p>
        <label htmlFor="email">Correo</label>
        <input id="email" className="input" type="email" autoComplete="username" required
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="password">Contraseña</label>
        <input id="password" className="input" type="password" autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={cargando}>{cargando ? "Un momento…" : "Entrar"}</button>
      </form>
    </div>
  );
}
