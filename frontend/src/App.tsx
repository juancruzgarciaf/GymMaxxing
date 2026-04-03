import { useState } from "react";
import "./App.css";
import type { EntrenamientoResumen, Usuario } from "./types";
import Home from "./pages/Home";
import Buscar from "./pages/Buscar";
import EntrenamientoDetalle from "./pages/EntrenamientoDetalle";
import Login from "./pages/Login";
import Perfil from "./pages/Perfil";
import Register from "./pages/Register";
import Rutinas from "./pages/Rutinas";

type AuthScreen = "login" | "register";
type MainScreen = "home" | "rutinas" | "buscar" | "perfil" | "entrenamiento";

function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>("login");
  const [mainScreen, setMainScreen] = useState<MainScreen>("home");
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [selectedTraining, setSelectedTraining] = useState<EntrenamientoResumen | null>(null);
  const [trainingReturnScreen, setTrainingReturnScreen] = useState<Exclude<MainScreen, "entrenamiento">>("home");

  const openProfile = (userId: number) => {
    setSelectedProfileId(userId);
    setMainScreen("perfil");
  };

  const openTraining = (
    training: EntrenamientoResumen,
    source: Exclude<MainScreen, "entrenamiento">
  ) => {
    setSelectedTraining(training);
    setTrainingReturnScreen(source);
    setMainScreen("entrenamiento");
  };

  const goBackFromTraining = () => {
    setMainScreen(trainingReturnScreen);
  };

  const handleLogout = () => {
    setUsuario(null);
    setAuthScreen("login");
    setMainScreen("home");
    setSelectedProfileId(null);
    setSelectedTraining(null);
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
          setSelectedProfileId(loggedUser.id);
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
            Feed
          </button>
          <button
            type="button"
            className={`nav-btn ${mainScreen === "rutinas" ? "active" : ""}`}
            onClick={() => setMainScreen("rutinas")}
          >
            Rutinas
          </button>
          <button
            type="button"
            className={`nav-btn ${mainScreen === "buscar" ? "active" : ""}`}
            onClick={() => setMainScreen("buscar")}
          >
            Buscar
          </button>
          <button
            type="button"
            className={`nav-btn ${mainScreen === "perfil" ? "active" : ""}`}
            onClick={() => openProfile(usuario.id)}
          >
            Perfil
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
        {mainScreen === "home" ? (
          <Home
            usuario={usuario}
            onOpenProfile={openProfile}
            onOpenTraining={(training) => openTraining(training, "home")}
          />
        ) : null}
        {mainScreen === "rutinas" ? <Rutinas usuario={usuario} /> : null}
        {mainScreen === "buscar" ? <Buscar usuario={usuario} onOpenProfile={openProfile} /> : null}
        {mainScreen === "perfil" ? (
          <Perfil
            usuario={usuario}
            profileUserId={selectedProfileId ?? usuario.id}
            onOpenProfile={openProfile}
            onOpenTraining={(training) => openTraining(training, "perfil")}
          />
        ) : null}
        {mainScreen === "entrenamiento" && selectedTraining ? (
          <EntrenamientoDetalle
            entrenamiento={selectedTraining}
            onBack={goBackFromTraining}
            onOpenProfile={openProfile}
          />
        ) : null}
      </div>
    </div>
  );
}

export default App;
