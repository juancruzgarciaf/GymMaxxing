import { useState } from "react"

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
        body: JSON.stringify({
          email,
          password
        })
      })

      // 🔍 Primero obtenemos texto (sirve para debug)
      const text = await res.text()
      console.log("Respuesta cruda:", text)

      // 🔒 Intentamos parsear a JSON SOLO si es válido
      let data
      try {
        data = JSON.parse(text)
      } catch {
        alert("El backend no devolvió JSON válido")
        return
      }

      console.log("Respuesta backend:", data)

      // ✅ Manejo de respuesta
      if (data.usuario) {
        localStorage.setItem("token", data.token)
        alert("Login exitoso")
      } else {
        alert(data.error || "Credenciales incorrectas")
      }

    } catch (error) {
      console.error("Error:", error)
      alert("No se pudo conectar al backend")
    }
  }

  return (
    <div>
      <h1>Login</h1>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={handleLogin}>
        Iniciar sesión
      </button>
    </div>
  )
}

export default Login