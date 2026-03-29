import { useState, type CSSProperties } from "react";
import logo from "../assets/logo.png";

type Usuario = {
  id: number;
  username: string;
  email: string;
  tipo_usuario: string;
};

type LoginProps = {
  goToRegister: () => void;
  onLoginSuccess: (usuario: Usuario) => void;
};

function Login({ goToRegister, onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
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
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>GymMaxxing</h1>
        <img src={logo} alt="logo" style={styles.logo} />

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

        <button style={styles.button} onClick={handleLogin}>
          Iniciar sesion
        </button>

        <p style={styles.link} onClick={goToRegister}>
          No tengo cuenta
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
    background: "linear-gradient(135deg, #ffffff, #020617)",
    fontFamily: "sans-serif",
  },
  card: {
    backgroundColor: "#111827",
    padding: "40px",
    borderRadius: "16px",
    width: "320px",
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    boxShadow: "0px 10px 30px rgba(0,0,0,0.5)",
  },
  title: {
    color: "white",
    textAlign: "center",
    marginBottom: "10px",
  },
  logo: {
    width: "190px",
    margin: "0 auto 10px auto",
    display: "block",
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
    color: "black",
    fontWeight: "bold",
    cursor: "pointer",
  },
  link: {
    color: "#93c5fd",
    textAlign: "center",
    cursor: "pointer",
  },
};

export default Login;
