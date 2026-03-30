import { useState, type FormEventHandler } from "react";
import showcase from "../assets/login-showcase.png";
import logo from "../assets/logo.png";
import type { Usuario } from "../types";

type LoginProps = {
  goToRegister: () => void;
  onLoginSuccess: (usuario: Usuario) => void;
};

function Login({ goToRegister, onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      alert("Completa email y password");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("http://localhost:3000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as { usuario?: Usuario; error?: string };

      if (!res.ok) {
        alert(data.error || "Credenciales incorrectas");
        return;
      }

      if (data.usuario) {
        onLoginSuccess(data.usuario);
      } else {
        alert("No se pudo iniciar sesion.");
      }
    } catch (error) {
      console.error(error);
      alert("Error conectando al backend");
    } finally {
      setLoading(false);
    }
  };

  const submit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    void handleLogin();
  };

  return (
    <main className="auth-shell">
      <section className="auth-grid">
        <article className="auth-showcase-panel">
          <img src={showcase} alt="Vista de la app" className="auth-showcase-image" />
        </article>

        <article className="auth-panel auth-form-panel">
          <div className="auth-brand-head">
            <span className="brand-dot" />
            <strong>GymMaxxing</strong>
          </div>
          <div className="auth-logo-wrap">
            <img src={logo} alt="GymMaxxing logo" className="auth-logo" />
          </div>
          <h2>Iniciar sesion</h2>
          <p className="auth-subtitle">Bienvenido de nuevo.</p>

          <form onSubmit={submit} className="auth-form">
            <input
              className="field"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="field"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="btn auth-submit" type="submit" disabled={loading}>
              {loading ? "Ingresando..." : "Iniciar sesion"}
            </button>
          </form>

          <button className="auth-link-btn" type="button" onClick={goToRegister}>
            No tengo cuenta
          </button>
        </article>
      </section>
    </main>
  );
}

export default Login;
