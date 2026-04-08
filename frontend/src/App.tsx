import { useState } from "react";
import "./App.css";
import logo from "./assets/logo.png";
import {
  fetchSessionSeed,
  saveTrainingSeedAsRoutine,
} from "./lib/trainingTransfer";
import type { EntrenamientoResumen, TrainingSeed, Usuario } from "./types";
import Entrenamiento from "./pages/Entrenamiento";
import Home from "./pages/Home";
import Buscar from "./pages/Buscar";
import EntrenamientoDetalle from "./pages/EntrenamientoDetalle";
import Login from "./pages/Login";
import Perfil from "./pages/Perfil";
import Register from "./pages/Register";
import RutinaCompartida from "./pages/RutinaCompartida";
import Rutinas from "./pages/Rutinas";

type AuthScreen = "login" | "register";
type MainScreen =
  | "home"
  | "rutinas"
  | "rutinaCompartida"
  | "buscar"
  | "perfil"
  | "entrenamientoLibre"
  | "entrenamiento";

const getSharedRoutineIdFromUrl = () => {
  const raw = new URLSearchParams(window.location.search).get("sharedRoutineId");
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>("login");
  const [mainScreen, setMainScreen] = useState<MainScreen>("home");
  const [sharedRoutineId, setSharedRoutineId] = useState<number | null>(getSharedRoutineIdFromUrl);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [selectedTraining, setSelectedTraining] = useState<EntrenamientoResumen | null>(null);
  const [trainingReturnScreen, setTrainingReturnScreen] = useState<Exclude<MainScreen, "entrenamiento">>("home");
  const [trainingSeed, setTrainingSeed] = useState<TrainingSeed | null>(null);
  const [trainingSeedKey, setTrainingSeedKey] = useState(0);

  const dismissSharedRoutine = () => {
    if (sharedRoutineId == null) {
      return;
    }

    setSharedRoutineId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("sharedRoutineId");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const navigateTo = (screen: Exclude<MainScreen, "entrenamiento">) => {
    if (screen !== "rutinaCompartida") {
      dismissSharedRoutine();
    }
    setMainScreen(screen);
  };

  const openProfile = (userId: number) => {
    dismissSharedRoutine();
    setSelectedProfileId(userId);
    setMainScreen("perfil");
  };

  const openTraining = (
    training: EntrenamientoResumen,
    source: Exclude<MainScreen, "entrenamiento">
  ) => {
    dismissSharedRoutine();
    setSelectedTraining(training);
    setTrainingReturnScreen(source);
    setMainScreen("entrenamiento");
  };

  const openTrainingFromSeed = (seed: TrainingSeed) => {
    setTrainingSeed(seed);
    setTrainingSeedKey((prev) => prev + 1);
    setMainScreen("entrenamientoLibre");
  };

  const handleCopyTrainingToWorkout = async (training: EntrenamientoResumen) => {
    try {
      const seed = await fetchSessionSeed(training);
      openTrainingFromSeed(seed);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo copiar al entrenamiento");
    }
  };

  const handleSaveTrainingAsRoutine = async (training: EntrenamientoResumen) => {
    if (!usuario) {
      return;
    }

    try {
      const seed = await fetchSessionSeed(training);
      await saveTrainingSeedAsRoutine(seed, usuario.id, {
        name: training.titulo,
        description: training.descripcion,
      });
      window.alert("Rutina guardada en tus rutinas");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo guardar la rutina");
    }
  };

  const goBackFromTraining = () => {
    setMainScreen(trainingReturnScreen);
  };

  const handleLogout = () => {
    setUsuario(null);
    setAuthScreen("login");
    dismissSharedRoutine();
    setMainScreen("home");
    setSelectedProfileId(null);
    setSelectedTraining(null);
    setTrainingSeed(null);
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
          setMainScreen(sharedRoutineId != null ? "rutinaCompartida" : "home");
          setSelectedProfileId(loggedUser.id);
        }}
      />
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <img src={logo} alt="GymMaxxing logo" className="brand-logo" />
          <p>GymMaxxing</p>
        </div>

        <nav className="topnav">
          <button
            type="button"
            className={`nav-btn icon-only ${mainScreen === "buscar" ? "active" : ""}`}
            onClick={() => navigateTo("buscar")}
            aria-label="Buscar"
            title="Buscar"
          >
            <svg
              className="nav-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="16.65" y1="16.65" x2="21" y2="21" />
            </svg>
          </button>
          <button
            type="button"
            className={`nav-btn ${mainScreen === "home" ? "active" : ""}`}
            onClick={() => navigateTo("home")}
          >
            Feed
          </button>
          <button
            type="button"
            className={`nav-btn ${mainScreen === "entrenamientoLibre" ? "active" : ""}`}
            onClick={() => navigateTo("entrenamientoLibre")}
          >
            Entrenamiento
          </button>
          <button
            type="button"
            className={`nav-btn ${mainScreen === "rutinas" ? "active" : ""}`}
            onClick={() => navigateTo("rutinas")}
          >
            Rutinas
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
            onSaveAsRoutine={handleSaveTrainingAsRoutine}
          />
        ) : null}
        {mainScreen === "entrenamientoLibre" ? (
          <Entrenamiento
            usuario={usuario}
            seed={trainingSeed}
            seedKey={trainingSeedKey}
            onSeedConsumed={() => setTrainingSeed(null)}
          />
        ) : null}
        {mainScreen === "rutinas" ? <Rutinas usuario={usuario} /> : null}
        {mainScreen === "rutinaCompartida" && sharedRoutineId != null ? (
          <RutinaCompartida
            usuario={usuario}
            routineId={sharedRoutineId}
            onClose={() => {
              dismissSharedRoutine();
              setMainScreen("rutinas");
            }}
            onCopyToTraining={openTrainingFromSeed}
          />
        ) : null}
        {mainScreen === "buscar" ? <Buscar usuario={usuario} onOpenProfile={openProfile} /> : null}
        {mainScreen === "perfil" ? (
          <Perfil
            usuario={usuario}
            profileUserId={selectedProfileId ?? usuario.id}
            onOpenProfile={openProfile}
            onOpenTraining={(training) => openTraining(training, "perfil")}
            onSaveAsRoutine={handleSaveTrainingAsRoutine}
          />
        ) : null}
        {mainScreen === "entrenamiento" && selectedTraining ? (
          <EntrenamientoDetalle
            entrenamiento={selectedTraining}
            onBack={goBackFromTraining}
            onOpenProfile={openProfile}
            onCopyToTraining={handleCopyTrainingToWorkout}
          />
        ) : null}
      </div>
    </div>
  );
}

export default App;
