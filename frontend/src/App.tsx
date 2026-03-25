import { useState } from "react"
import Login from "./pages/Login"
import Register from "./pages/Register"

function App() {
  const [screen, setScreen] = useState("login")

  return (
    <>
      {screen === "login" && (
        <Login goToRegister={() => setScreen("register")} />
      )}

      {screen === "register" && (
        <Register goToLogin={() => setScreen("login")} />
      )}
    </>
  )
}

export default App