import { useState, type CSSProperties } from "react";

type RegisterProps = {
  goToLogin: () => void;
};

function Register({ goToLogin }: RegisterProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tipoUsuario, setTipoUsuario] = useState("usuario");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "ok"; text: string } | null>(null);

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      setFeedback({ type: "error", text: "Completa usuario, email y password" });
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

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Crear cuenta</h1>
        {feedback ? (
          <p
            style={{
              ...styles.feedback,
              ...(feedback.type === "error" ? styles.feedbackError : styles.feedbackOk),
            }}
          >
            {feedback.text}
          </p>
        ) : null}

        <input
          style={styles.input}
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          style={styles.input}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <select
          style={styles.input}
          value={tipoUsuario}
          onChange={(e) => setTipoUsuario(e.target.value)}
        >
          <option value="usuario">Usuario</option>
          <option value="entrenador">Entrenador</option>
          <option value="gimnasio">Gimnasio</option>
        </select>

        <button style={styles.button} onClick={handleRegister} disabled={loading}>
          {loading ? "Creando..." : "Registrarse"}
        </button>

        <p style={styles.link} onClick={goToLogin}>
          Ya tengo cuenta
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #0f172a, #020617)",
  },
  card: {
    backgroundColor: "#111827",
    padding: "40px",
    borderRadius: "16px",
    width: "320px",
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  title: {
    color: "white",
    textAlign: "center",
  },
  input: {
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#1f2933",
    color: "white",
  },
  button: {
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#22c55e",
    fontWeight: "bold",
    cursor: "pointer",
  },
  feedback: {
    margin: 0,
    borderRadius: "8px",
    padding: "10px 12px",
    fontSize: "0.92rem",
  },
  feedbackError: {
    border: "1px solid #7a2f35",
    backgroundColor: "#2b1a1d",
    color: "#ffc0c6",
  },
  feedbackOk: {
    border: "1px solid #2d6042",
    backgroundColor: "#172821",
    color: "#b9f2d1",
  },
  link: {
    color: "#93c5fd",
    textAlign: "center",
    cursor: "pointer",
  },
};

export default Register;
