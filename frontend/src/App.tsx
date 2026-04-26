import { useEffect, useState } from "react";
import "./App.css";
import logo from "./assets/logo.png";
import {
  fetchSessionSeed,
  getSourceRoutineIdFromSeed,
  recordRoutineCopy,
  saveTrainingSeedAsRoutine,
} from "./lib/trainingTransfer";
import { canUseTrainingFeatures } from "./lib/roles";
import type { EntrenamientoResumen, TrainingSeed, Usuario } from "./types";
import Entrenamiento from "./pages/Entrenamiento";
import Home from "./pages/Home";
import Buscar from "./pages/Buscar";
import DescubrirRutinas from "./pages/DescubrirRutinas";
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
  | "descubrir"
  | "perfil"
  | "entrenamientoLibre"
  | "entrenamiento";

const AUTH_STORAGE_KEY = "gymmaxxing_auth_v1";

type StoredAuth = {
  usuario: Usuario;
  token: string;
};

const getSharedRoutineIdFromUrl = () => {
  const raw = new URLSearchParams(window.location.search).get("sharedRoutineId");
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const readStoredAuth = (): StoredAuth | null => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredAuth>;
    if (!parsed.usuario || !parsed.token) {
      return null;
    }

    return {
      usuario: parsed.usuario,
      token: parsed.token,
    };
  } catch {
    return null;
  }
};

const persistAuth = (data: StoredAuth | null) => {
  if (!data) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
};

function App() {
  const initialAuth = readStoredAuth();
  const [usuario, setUsuario] = useState<Usuario | null>(initialAuth?.usuario ?? null);
  const [authToken, setAuthToken] = useState<string | null>(initialAuth?.token ?? null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>("login");
  const [mainScreen, setMainScreen] = useState<MainScreen>("home");
  const [sharedRoutineId, setSharedRoutineId] = useState<number | null>(getSharedRoutineIdFromUrl);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [selectedTraining, setSelectedTraining] = useState<EntrenamientoResumen | null>(null);
  const [trainingReturnScreen, setTrainingReturnScreen] = useState<Exclude<MainScreen, "entrenamiento">>("home");
  const [trainingSeed, setTrainingSeed] = useState<TrainingSeed | null>(null);
  const [trainingSeedKey, setTrainingSeedKey] = useState(0);
  const [appToast, setAppToast] = useState<{ type: "error" | "ok"; text: string } | null>(null);

  useEffect(() => {
    if (!appToast) {
      return;
    }
    const timer = window.setTimeout(() => {
      setAppToast(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [appToast]);

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
    if (!canUseTrainingFeatures(usuario)) {
      setAppToast({
        type: "error",
        text: "Las cuentas gimnasio no pueden iniciar entrenamientos",
      });
      return;
    }

    const sourceRoutineId = getSourceRoutineIdFromSeed(seed);
    if (usuario && sourceRoutineId != null) {
      void recordRoutineCopy(sourceRoutineId, usuario.id).catch((error) => {
        console.error("No se pudo registrar la copia de rutina", error);
      });
    }
    setTrainingSeed(seed);
    setTrainingSeedKey((prev) => prev + 1);
    setMainScreen("entrenamientoLibre");
  };

  const handleCopyTrainingToWorkout = async (training: EntrenamientoResumen) => {
    if (!canUseTrainingFeatures(usuario)) {
      setAppToast({
        type: "error",
        text: "Las cuentas gimnasio no pueden iniciar entrenamientos",
      });
      return;
    }

    try {
      const seed = await fetchSessionSeed(training);
      openTrainingFromSeed(seed);
    } catch (error) {
      setAppToast({
        type: "error",
        text: error instanceof Error ? error.message : "No se pudo copiar al entrenamiento",
      });
    }
  };

  const handleSaveTrainingAsRoutine = async (
    training: EntrenamientoResumen,
    customName?: string,
  ) => {
    if (!usuario) {
      return;
    }

    try {
      const seed = await fetchSessionSeed(training);
      await saveTrainingSeedAsRoutine(seed, usuario.id, {
        name: customName?.trim() || training.titulo,
        description: training.descripcion,
      });
      setAppToast({ type: "ok", text: "Rutina guardada en tus rutinas" });
    } catch (error) {
      setAppToast({
        type: "error",
        text: error instanceof Error ? error.message : "No se pudo guardar la rutina",
      });
    }
  };

  const goBackFromTraining = () => {
    setMainScreen(trainingReturnScreen);
  };

  const handleLogout = () => {
    setUsuario(null);
    setAuthToken(null);
    persistAuth(null);
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
        onLoginSuccess={(loggedUser, token) => {
          setUsuario(loggedUser);
          setAuthToken(token);
          persistAuth({ usuario: loggedUser, token });
          setMainScreen(sharedRoutineId != null ? "rutinaCompartida" : "home");
          setSelectedProfileId(loggedUser.id);
        }}
      />
    );
  }

  const canTrain = canUseTrainingFeatures(usuario);

  return (
    <div className="shell">
      {appToast ? <div className={`toast-pop ${appToast.type}`}>{appToast.text}</div> : null}
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
          {canTrain ? (
            <button
              type="button"
              className={`nav-btn ${mainScreen === "entrenamientoLibre" ? "active" : ""}`}
              onClick={() => navigateTo("entrenamientoLibre")}
            >
              Entrenamiento
            </button>
          ) : null}
          <button
            type="button"
            className={`nav-btn ${mainScreen === "rutinas" ? "active" : ""}`}
            onClick={() => navigateTo("rutinas")}
          >
            Rutinas
          </button>
          <button
            type="button"
            className={`nav-btn ${mainScreen === "descubrir" ? "active" : ""}`}
            onClick={() => navigateTo("descubrir")}
          >
            Descubrir
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
        {mainScreen === "entrenamientoLibre" && canTrain ? (
          <Entrenamiento
            usuario={usuario}
            seed={trainingSeed}
            seedKey={trainingSeedKey}
            onSeedConsumed={() => setTrainingSeed(null)}
          />
        ) : null}
        {mainScreen === "rutinas" ? <Rutinas usuario={usuario} canTrain={canTrain} /> : null}
        {mainScreen === "descubrir" ? <DescubrirRutinas usuario={usuario} /> : null}
        {mainScreen === "rutinaCompartida" && sharedRoutineId != null ? (
          <RutinaCompartida
            usuario={usuario}
            canTrain={canTrain}
            routineId={sharedRoutineId}
            onClose={() => {
              dismissSharedRoutine();
              setMainScreen("rutinas");
            }}
            onCopyToTraining={(seed) => {
              if (!canTrain) {
                setAppToast({
                  type: "error",
                  text: "Las cuentas gimnasio no pueden iniciar entrenamientos",
                });
                return;
              }
              openTrainingFromSeed(seed);
            }}
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
            authToken={authToken}
            onUserUpdated={(nextUser) => {
              setUsuario(nextUser);
              if (authToken) {
                persistAuth({ usuario: nextUser, token: authToken });
              }
            }}
          />
        ) : null}
        {mainScreen === "entrenamiento" && selectedTraining ? (
          <EntrenamientoDetalle
            entrenamiento={selectedTraining}
            canTrain={canTrain}
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
