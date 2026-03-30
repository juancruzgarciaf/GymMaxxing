import { useState } from "react";
import "./App.css";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Rutinas from "./pages/Rutinas";
import type { Usuario } from "./types";

type AuthScreen = "login" | "register";
type MainScreen = "home" | "rutinas";

function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>("login");
  const [mainScreen, setMainScreen] = useState<MainScreen>("home");

  const handleLogout = () => {
    setUsuario(null);
    setAuthScreen("login");
    setMainScreen("home");
  };

  if (!usuario) {
    if (authScreen === "register") {
      return <Register goToLogin={() => setAuthScreen("login")} />;
    }

    return (
      <Login
        goToRegister={() => setAuthScreen("register")}
        onLoginSuccess={(loggedUser) => {
          setUsuario(loggedUser);
          setMainScreen("home");
        }}
      />
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          <p>GymMaxxing</p>
        </div>

        <nav className="topnav">
          <button
            type="button"
            className={`nav-btn ${mainScreen === "home" ? "active" : ""}`}
            onClick={() => setMainScreen("home")}
          >
            Home
          </button>
          <button
            type="button"
            className={`nav-btn ${mainScreen === "rutinas" ? "active" : ""}`}
            onClick={() => setMainScreen("rutinas")}
          >
            Rutinas
          </button>
        </nav>

        <div className="user-box">
          <span>{usuario.username}</span>
          <button type="button" className="logout-btn" onClick={handleLogout}>
            Salir
          </button>
        </div>
      </header>

      <div className="content">
        {mainScreen === "home" ? <Home usuario={usuario} /> : <Rutinas usuario={usuario} />}
      </div>
    </div>
  );
}

export default App;
