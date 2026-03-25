import { useState, CSSProperties } from "react"

function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleLogin = async () => {
    try {
      const res = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()

      if (data.usuario) {
        alert("Login exitoso")
      } else {
        alert(data.error || "Credenciales incorrectas")
      }

    } catch (error) {
      console.error(error)
      alert("Error conectando al backend")
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>GymMaxxing</h1>

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
          Iniciar sesión
        </button>

        <p style={styles.link}>
          No tengo cuenta
        </p>
      </div>
    </div>
  )
}

const styles: { [key: string]: CSSProperties } = {
  container: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #0f172a, #020617)",
    fontFamily: "sans-serif"
  },
  card: {
    backgroundColor: "#111827",
    padding: "40px",
    borderRadius: "16px",
    width: "320px",
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    boxShadow: "0px 10px 30px rgba(0,0,0,0.5)"
  },
  title: {
    color: "white",
    textAlign: "center",
    marginBottom: "10px"
  },
  input: {
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#1f2933",
    color: "white"
  },
  button: {
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#22c55e",
    color: "black",
    fontWeight: "bold",
    cursor: "pointer"
  },
  link: {
    color: "#93c5fd",
    textAlign: "center",
    cursor: "pointer"
  }
}

export default Login