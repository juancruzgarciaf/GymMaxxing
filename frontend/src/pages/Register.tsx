import { useState, type FormEventHandler } from "react";
import logo from "../assets/logo.png";
import { USERNAME_MAX_LENGTH, limitUsername } from "../lib/textLimits";

type RegisterProps = {
  goToLogin: () => void;
};

function Register({ goToLogin }: RegisterProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tipoUsuario, setTipoUsuario] = useState("");
  const [edad, setEdad] = useState("");
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [genero, setGenero] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "ok"; text: string } | null>(null);
  const shouldShowBodyFields = tipoUsuario === "usuario" || tipoUsuario === "entrenador";

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim() || !tipoUsuario) {
      setFeedback({ type: "error", text: "Completa usuario, email, password y tipo de usuario" });
      return;
    }

    try {
      setLoading(true);
      setFeedback(null);
      const res = await fetch("http://localhost:3000/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password,
          tipo_usuario: tipoUsuario,
          edad: shouldShowBodyFields && edad.trim() ? Number(edad) : null,
          peso: shouldShowBodyFields && peso.trim() ? Number(peso) : null,
          altura: shouldShowBodyFields && altura.trim() ? Number(altura) : null,
          genero: shouldShowBodyFields ? genero || null : null,
        }),
      });

      const data = (await res.json()) as { id?: number; error?: string };

      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Error al registrarse" });
        return;
      }

      if (data.id) {
        setFeedback({ type: "ok", text: "Usuario creado. Redirigiendo al login..." });
        window.setTimeout(() => {
          goToLogin();
        }, 850);
      } else {
        setFeedback({ type: "error", text: "Respuesta invalida del servidor" });
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
    void handleRegister();
  };

  return (
    <main className="auth-shell auth-fullscreen">
      <section className="auth-full-page register-full-page">
        <div className="register-brand-panel">
          <img src={logo} alt="GymMaxxing logo" className="register-hero-logo" />
          <div className="register-motivation">
            <h1>Hoy empieza tu nueva version.</h1>
            <p>La cuenta se crea en un minuto. La disciplina empieza ahora.</p>
          </div>
        </div>

        <div className="auth-full-content register-form-panel">
          <h2>Crear cuenta</h2>
          <p className="auth-subtitle">Entrá, elegí tu rol y empezá a construir constancia.</p>
          {feedback ? <p className={`status ${feedback.type}`}>{feedback.text}</p> : null}

          <form onSubmit={submit} className="auth-form">
            <input
              className="field"
              placeholder="Username"
              maxLength={USERNAME_MAX_LENGTH}
              value={username}
              onChange={(event) => setUsername(limitUsername(event.target.value))}
            />

            <input
              className="field"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <input
              className="field"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <select
              className="field"
              value={tipoUsuario}
              onChange={(event) => {
                const nextType = event.target.value;
                setTipoUsuario(nextType);
                if (nextType === "gimnasio") {
                  setEdad("");
                  setPeso("");
                  setAltura("");
                  setGenero("");
                }
              }}
            >
              <option value="">Tipo de usuario</option>
              <option value="usuario">Usuario</option>
              <option value="entrenador">Entrenador</option>
              <option value="gimnasio">Gimnasio</option>
            </select>

            {shouldShowBodyFields ? (
              <div className="register-body-fields">
                <input
                  className="field"
                  type="number"
                  min="0"
                  placeholder="Edad"
                  value={edad}
                  onChange={(event) => setEdad(event.target.value)}
                />
                <input
                  className="field"
                  type="number"
                  min="0"
                  placeholder="Peso"
                  value={peso}
                  onChange={(event) => setPeso(event.target.value)}
                />
                <input
                  className="field"
                  type="number"
                  min="0"
                  placeholder="Altura"
                  value={altura}
                  onChange={(event) => setAltura(event.target.value)}
                />
                <select
                  className="field"
                  value={genero}
                  onChange={(event) => setGenero(event.target.value)}
                >
                  <option value="">Sexo</option>
                  <option value="hombre">Hombre</option>
                  <option value="mujer">Mujer</option>
                </select>
              </div>
            ) : null}

            <button className="btn auth-submit" type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear cuenta"}
            </button>
          </form>

          <button className="auth-link-btn" type="button" onClick={goToLogin}>
            Ya tengo cuenta
          </button>
        </div>
      </section>
    </main>
  );
}

export default Register;
