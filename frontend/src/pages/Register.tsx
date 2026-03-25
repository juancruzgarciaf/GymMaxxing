import { useState } from "react"

function Register() {
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

      const text = await res.text()
      console.log("Respuesta cruda:", text)

      let data
      try {
        data = JSON.parse(text)
      } catch {
        alert("El backend no devolvió JSON válido")
        return
      }

      console.log("Respuesta backend:", data)

      if (data.id) {
        alert("Usuario creado correctamente")
      } else {
        alert(data.error || "Error al registrarse")
      }

    } catch (error) {
      console.error("Error:", error)
      alert("No se pudo conectar al backend")
    }
  }

  return (
    <div>
      <h1>Register</h1>

      <input
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

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

      <select
        value={tipoUsuario}
        onChange={(e) => setTipoUsuario(e.target.value)}
      >
        <option value="usuario">Usuario</option>
        <option value="entrenador">Entrenador</option>
        <option value="gimnasio">Gimnasio</option>
      </select>

      <button onClick={handleRegister}>
        Registrarse
      </button>
    </div>
  )
}

export default Register