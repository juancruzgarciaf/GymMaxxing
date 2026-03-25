import { useState } from "react"

function Register({ goToLogin }: { goToLogin: () => void }) {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [tipoUsuario, setTipoUsuario] = useState("usuario")

  const handleRegister = async () => {
    try {
      const res = await fetch("http://localhost:3000/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          email,
          password,
          tipo_usuario: tipoUsuario
        })
      })

      const data = await res.json()

      if (data.id) {
        alert("Usuario creado ✅")
        goToLogin() // 🔥 vuelve al login automáticamente
      } else {
        alert(data.error || "Error al registrarse")
      }

    } catch (error) {
      console.error(error)
      alert("Error conectando al backend")
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Crear cuenta</h1>

        <input style={styles.input} placeholder="Username"
          value={username} onChange={(e) => setUsername(e.target.value)} />

        <input style={styles.input} placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)} />

        <input style={styles.input} type="password" placeholder="Password"
          value={password} onChange={(e) => setPassword(e.target.value)} />

        <select style={styles.input}
          value={tipoUsuario}
          onChange={(e) => setTipoUsuario(e.target.value)}
        >
          <option value="usuario">Usuario</option>
          <option value="entrenador">Entrenador</option>
          <option value="gimnasio">Gimnasio</option>
        </select>

        <button style={styles.button} onClick={handleRegister}>
          Registrarse
        </button>

        <p style={styles.link} onClick={goToLogin}>
          Ya tengo cuenta
        </p>
      </div>
    </div>
  )
}

const styles: any = {
  container: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #0f172a, #020617)"
  },
  card: {
    backgroundColor: "#111827",
    padding: "40px",
    borderRadius: "16px",
    width: "320px",
    display: "flex",
    flexDirection: "column",
    gap: "15px"
  },
  title: {
    color: "white",
    textAlign: "center"
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
    fontWeight: "bold",
    cursor: "pointer"
  },
  link: {
    color: "#93c5fd",
    textAlign: "center",
    cursor: "pointer"
  }
}

export default Register