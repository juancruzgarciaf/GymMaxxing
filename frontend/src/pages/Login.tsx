import { useEffect, useState, type FormEventHandler } from "react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import showcase from "../assets/login-showcase.png";
import logo from "../assets/logo.png";
import type { Usuario } from "../types";

type LoginProps = {
  goToRegister: () => void;
  onLoginSuccess: (usuario: Usuario, token: string) => void;
};

function Login({ goToRegister, onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "ok"; text: string } | null>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timer = window.setTimeout(() => {
      setFeedback(null);
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [feedback]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setFeedback({ type: "error", text: "Completa email y password" });
      return;
    }

    try {
      setLoading(true);
      setFeedback(null);
      const res = await fetch("http://localhost:3000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as { usuario?: Usuario; token?: string; error?: string };

      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Credenciales incorrectas" });
        return;
      }

      if (data.usuario && data.token) {
        onLoginSuccess(data.usuario, data.token);
      } else {
        setFeedback({ type: "error", text: "No se pudo iniciar sesion." });
      }
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", text: "Error conectando al backend" });
    } finally {
      setLoading(false);
    }
  };

  const submit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    void handleLogin();
  };

  const handleGoogleLogin = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setFeedback({ type: "error", text: "Google no devolvio una credencial valida" });
      return;
    }

    try {
      setLoading(true);
      setFeedback(null);
      const res = await fetch("http://localhost:3000/auth/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      const data = (await res.json()) as { usuario?: Usuario; token?: string; error?: string };

      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "No se pudo iniciar sesion con Google" });
        return;
      }

      if (data.usuario && data.token) {
        onLoginSuccess(data.usuario, data.token);
      } else {
        setFeedback({ type: "error", text: "Google no devolvio los datos de sesion." });
      }
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", text: "Error conectando Google con el backend" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell auth-fullscreen">
      <section className="auth-full-page login-full-page">
        <div className="auth-full-content login-full-content">
          <div className="auth-logo-wrap">
            <img src={logo} alt="GymMaxxing logo" className="auth-logo login-logo" />
          </div>
          <h2>Iniciar sesión</h2>
          <p className="auth-subtitle">Bienvenido de nuevo.</p>
          {feedback ? <p className={`status ${feedback.type}`}>{feedback.text}</p> : null}

          <form onSubmit={submit} className="auth-form login-auth-form">
            <label className="login-field-group">
              <span>Email</span>
              <input
                className="field"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="login-field-group">
              <span>Contraseña</span>
              <input
                className="field"
                type="password"
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="btn auth-submit" type="submit" disabled={loading}>
              {loading ? "Ingresando..." : "Iniciar sesión"}
            </button>
          </form>

          {googleClientId ? (
            <div className="google-login-wrap">
              <GoogleLogin
                onSuccess={(credentialResponse) => {
                  void handleGoogleLogin(credentialResponse);
                }}
                onError={() => {
                  setFeedback({ type: "error", text: "No se pudo iniciar sesion con Google" });
                }}
                text="signin_with"
                shape="rectangular"
                width="360"
              />
            </div>
          ) : null}

          <button className="auth-link-btn" type="button" onClick={goToRegister}>
            No tengo cuenta
          </button>
        </div>
        <div className="login-image-panel">
          <img src={showcase} alt="Vista de la app" className="login-full-image" />
        </div>
      </section>
    </main>
  );
}

export default Login;
