import { useState } from "react"

function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")


//aca conecto con el back
  const handleLogin = async () => {
    try {
      const res = await fetch("http://localhost:8080/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password
        })
      })
  
      const data = await res.json()
  
      console.log("Respuesta backend:", data)
  
      // guardamos token (si hay)
      if (data.token) {
        localStorage.setItem("token", data.token)
      }
  
    } catch (error) {
      console.error("Error en login:", error)
    }
  }

  return (
    <div>
      <h1>Login</h1>

      <input
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={handleLogin}>
        Iniciar sesión
      </button>
    </div>
  )
}

export default Login