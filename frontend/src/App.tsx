import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import logo from "./assets/logo.png";
import {
  fetchSessionSeed,
  getSourceRoutineIdFromSeed,
  recordRoutineCopy,
  saveTrainingSeedAsRoutine,
} from "./lib/trainingTransfer";
import { canUseTrainingFeatures } from "./lib/roles";
import type { EntrenamientoResumen, RoutinePostSummary, SearchUser, TrainingSeed, Usuario } from "./types";
import Entrenamiento, { type ActiveTrainingSnapshot } from "./pages/Entrenamiento";
import Home from "./pages/Home";
import Buscar from "./pages/Buscar";
import Descubrir from "./pages/Descubrir";
import EntrenamientoDetalle from "./pages/EntrenamientoDetalle";
import Login from "./pages/Login";
import Notificaciones from "./pages/Notificaciones";
import Perfil from "./pages/Perfil";
import Pro from "./pages/Pro";
import Register from "./pages/Register";
import NotificationSettingsPanel from "./components/NotificationSettingsPanel";

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
  | "notificaciones"
  | "ajustes"
  | "pro"
  | "entrenamientoLibre"
  | "entrenamiento";

const AUTH_STORAGE_KEY = "gymmaxxing_auth_v1";
const THEME_STORAGE_KEY = "gymmaxxing_theme_v1";

type StoredAuth = {
  usuario: Usuario;
  token: string;
};

type StoredTokenPayload = {
  exp?: number;
};

type ThemeMode = "dark" | "light";

type RoutedMainScreen = Exclude<MainScreen, "entrenamiento" | "rutinaCompartida">;

type TrainingRouteState = {
  training?: EntrenamientoResumen;
  returnScreen?: RoutedMainScreen;
};

const getSharedRoutineIdFromSearch = (search: string) => {
  const raw = new URLSearchParams(search).get("sharedRoutineId");
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const sharedRoutinePath = (routineId: number) => `/rutina-compartida?sharedRoutineId=${routineId}`;

const pathForScreen = (screen: RoutedMainScreen) => {
  const paths: Record<RoutedMainScreen, string> = {
    home: "/",
    rutinas: "/rutinas",
    buscar: "/buscar",
    descubrir: "/descubrir",
    perfil: "/perfil",
    notificaciones: "/notificaciones",
    ajustes: "/ajustes",
    pro: "/pro",
    entrenamientoLibre: "/entrenamiento",
  };

  return paths[screen];
};

const getProfileUsernameFromPath = (pathname: string) => {
  const match = pathname.match(/^\/perfil\/([^/]+)$/);
  if (!match) {
    return null;
  }

  return decodeURIComponent(match[1]);
};

const getTrainingIdFromPath = (pathname: string) => {
  const match = pathname.match(/^\/entrenamientos\/(\d+)$/);
  if (!match) {
    return null;
  }

  return Number(match[1]);
};

const getMainScreenFromPath = (pathname: string): MainScreen => {
  if (pathname === "/rutinas") {
    return "rutinas";
  }
  if (pathname === "/buscar") {
    return "buscar";
  }
  if (pathname === "/descubrir" || pathname.startsWith("/descubrir/")) {
    return "descubrir";
  }
  if (pathname === "/entrenamiento") {
    return "entrenamientoLibre";
  }
  if (pathname === "/ajustes") {
    return "ajustes";
  }
  if (pathname === "/notificaciones") {
    return "notificaciones";
  }
  if (pathname === "/pro") {
    return "pro";
  }
  if (pathname === "/rutina-compartida") {
    return "rutinaCompartida";
  }
  if (pathname === "/perfil" || getProfileUsernameFromPath(pathname) != null) {
    return "perfil";
  }
  if (pathname.startsWith("/entrenamientos/")) {
    return "entrenamiento";
  }

  return "home";
};

const isStoredTokenUsable = (token: string) => {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) {
      return false;
    }

    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const payload = JSON.parse(window.atob(padded)) as StoredTokenPayload;

    return typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
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

    if (!isStoredTokenUsable(parsed.token)) {
      persistAuth(null);
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

const readStoredTheme = (): ThemeMode => {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
};

const twoDigits = (value: number) => String(value).padStart(2, "0");

const formatDuration = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const min = Math.floor((safeSeconds % 3600) / 60);
  const sec = safeSeconds % 60;

  if (days > 0) {
    return `${days}d ${twoDigits(hours)}:${twoDigits(min)}:${twoDigits(sec)}`;
  }

  if (hours > 0) {
    return `${hours}:${twoDigits(min)}:${twoDigits(sec)}`;
  }

  return `${twoDigits(min)}:${twoDigits(sec)}`;
};

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialAuth = readStoredAuth();
  const [themeMode, setThemeMode] = useState<ThemeMode>(readStoredTheme);
  const [usuario, setUsuario] = useState<Usuario | null>(initialAuth?.usuario ?? null);
  const [authToken, setAuthToken] = useState<string | null>(initialAuth?.token ?? null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [selectedTraining, setSelectedTraining] = useState<EntrenamientoResumen | null>(null);
  const [trainingReturnScreen, setTrainingReturnScreen] = useState<RoutedMainScreen>("home");
  const [trainingSeed, setTrainingSeed] = useState<TrainingSeed | null>(null);
  const [trainingSeedKey, setTrainingSeedKey] = useState(0);
  const [activeTraining, setActiveTraining] = useState<ActiveTrainingSnapshot | null>(null);
  const [discardTrainingRequestKey, setDiscardTrainingRequestKey] = useState(0);
  const [discardTrainingModalOpen, setDiscardTrainingModalOpen] = useState(false);
  const [appToast, setAppToast] = useState<{ type: "error" | "ok"; text: string } | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<SearchUser[]>([]);
  const [rutinasOpenGeminiRequestKey, setRutinasOpenGeminiRequestKey] = useState(0);
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);
  const authScreen: AuthScreen = location.pathname === "/register" ? "register" : "login";
  const mainScreen = getMainScreenFromPath(location.pathname);
  const routeState = location.state as TrainingRouteState | null;
  const routeTraining = routeState?.training ?? null;
  const sharedRoutineId = getSharedRoutineIdFromSearch(location.search);
  const routeTrainingId = getTrainingIdFromPath(location.pathname);
  const availableTraining = routeTraining ?? selectedTraining;
  const currentTraining =
    mainScreen === "entrenamiento" && availableTraining?.id_sesion === routeTrainingId ? availableTraining : null;
  const routeProfileUsername = getProfileUsernameFromPath(location.pathname);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (!appToast) {
      return;
    }
    const timer = window.setTimeout(() => {
      setAppToast(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [appToast]);

  useEffect(() => {
    if (!usuario) {
      return;
    }

    if (location.pathname === "/login" || location.pathname === "/register") {
      navigate(sharedRoutineId != null ? sharedRoutinePath(sharedRoutineId) : "/", { replace: true });
    }
  }, [location.pathname, navigate, sharedRoutineId, usuario]);

  useEffect(() => {
    if (usuario && sharedRoutineId != null && location.pathname === "/") {
      navigate(sharedRoutinePath(sharedRoutineId), { replace: true });
    }
  }, [location.pathname, navigate, sharedRoutineId, usuario]);

  useEffect(() => {
    if (usuario && mainScreen === "entrenamiento" && !currentTraining) {
      navigate("/", { replace: true });
    }
  }, [currentTraining, mainScreen, navigate, usuario]);

  useEffect(() => {
    if (!usuario || canUseTrainingFeatures(usuario)) {
      return;
    }

    if (mainScreen === "entrenamientoLibre") {
      setTrainingSeed(null);
      setAppToast({
        type: "error",
        text: "Las cuentas gimnasio no pueden iniciar entrenamientos",
      });
      navigate(pathForScreen("rutinas"), { replace: true });
    }

    if (activeTraining) {
      setActiveTraining(null);
      setDiscardTrainingModalOpen(false);
    }
  }, [activeTraining, mainScreen, navigate, usuario]);

  const dismissSharedRoutine = useCallback(() => {
    if (sharedRoutineId == null) {
      return;
    }
  }, [sharedRoutineId]);

  const navigateTo = (screen: Exclude<MainScreen, "entrenamiento">) => {
    if (screen !== "rutinaCompartida") {
      dismissSharedRoutine();
    }

    if (screen === "rutinaCompartida") {
      if (sharedRoutineId != null) {
        navigate(sharedRoutinePath(sharedRoutineId));
      }
      return;
    }

    navigate(pathForScreen(screen));
  };

  const openGeminiFromTopbar = () => {
    dismissSharedRoutine();
    setRutinasOpenGeminiRequestKey((prev) => prev + 1);
    navigate(pathForScreen("rutinas"));
  };

  const handleActiveTrainingChange = useCallback((snapshot: ActiveTrainingSnapshot | null) => {
    setActiveTraining(snapshot);
  }, []);

  const openProfile = (username: string) => {
    dismissSharedRoutine();
    navigate(`/perfil/${encodeURIComponent(username)}`);
  };

  const goBackFromProfile = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(pathForScreen("home"));
  };

  const openTraining = (
    training: EntrenamientoResumen,
    source: RoutedMainScreen
  ) => {
    dismissSharedRoutine();
    setSelectedTraining(training);
    setTrainingReturnScreen(source);
    navigate(`/entrenamientos/${training.id_sesion}`, {
      state: { training, returnScreen: source } satisfies TrainingRouteState,
    });
  };

  const openRoutine = (routine: RoutinePostSummary) => {
    dismissSharedRoutine();
    navigate(sharedRoutinePath(routine.id_rutina));
  };

  const openTrainingFromSeed = (seed: TrainingSeed, options: { recordCopy?: boolean } = {}) => {
    if (!canUseTrainingFeatures(usuario)) {
      setAppToast({
        type: "error",
        text: "Las cuentas gimnasio no pueden iniciar entrenamientos",
      });
      return;
    }

    if (activeTraining) {
      setAppToast({
        type: "error",
        text: "Ya hay un entrenamiento en curso",
      });
      navigate(pathForScreen("entrenamientoLibre"));
      return;
    }

    const sourceRoutineId = getSourceRoutineIdFromSeed(seed);
    if (options.recordCopy !== false && usuario && sourceRoutineId != null) {
      void recordRoutineCopy(sourceRoutineId, usuario.id).catch((error) => {
        console.error("No se pudo registrar la copia de rutina", error);
      });
    }
    setTrainingSeed(seed);
    setTrainingSeedKey((prev) => prev + 1);
    navigate(pathForScreen("entrenamientoLibre"));
  };

  const requestDiscardActiveTraining = () => {
    if (!activeTraining || activeTraining.loading) {
      return;
    }

    setDiscardTrainingModalOpen(true);
  };

  const confirmDiscardActiveTraining = () => {
    setDiscardTrainingModalOpen(false);
    setDiscardTrainingRequestKey((prev) => prev + 1);
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
    navigate(pathForScreen(routeState?.returnScreen ?? trainingReturnScreen), { replace: true });
  };

  const handleLogout = useCallback(() => {
    setUsuario(null);
    setAuthToken(null);
    setUnreadNotifications(0);
    persistAuth(null);
    dismissSharedRoutine();
    setSelectedTraining(null);
    setTrainingSeed(null);
    setActiveTraining(null);
    setUserSearchQuery("");
    setUserSearchResults([]);
    setDiscardTrainingModalOpen(false);
    navigate("/login", { replace: true });
  }, [dismissSharedRoutine, navigate]);

  const handleAuthExpired = useCallback(() => {
    handleLogout();
  }, [handleLogout]);

  const refreshUnreadNotifications = useCallback(async () => {
    if (!authToken) {
      setUnreadNotifications(0);
      return;
    }

    try {
      const res = await fetch("http://localhost:3000/notificaciones?limit=1", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = (await res.json()) as { unread_count?: number; error?: string };

      if (res.status === 401) {
        handleAuthExpired();
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "No se pudo cargar el contador de notificaciones");
      }

      setUnreadNotifications(data.unread_count ?? 0);
    } catch (error) {
      console.error("No se pudo refrescar el contador de notificaciones", error);
    }
  }, [authToken, handleAuthExpired]);

  useEffect(() => {
    if (!usuario || !authToken) {
      setUnreadNotifications(0);
      return;
    }

    void refreshUnreadNotifications();

    const interval = window.setInterval(() => {
      void refreshUnreadNotifications();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [authToken, refreshUnreadNotifications, usuario]);

  const toggleTheme = () => {
    setThemeMode((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  if (!usuario) {
    if (authScreen === "register") {
      return <Register goToLogin={() => navigate("/login")} />;
    }

    return (
      <Login
        goToRegister={() => navigate("/register")}
        onLoginSuccess={(loggedUser, token) => {
          setUsuario(loggedUser);
          setAuthToken(token);
          persistAuth({ usuario: loggedUser, token });
          navigate(sharedRoutineId != null ? sharedRoutinePath(sharedRoutineId) : "/", { replace: true });
        }}
      />
    );
  }

  const canTrain = canUseTrainingFeatures(usuario);
  const isOwnProfileScreen =
    mainScreen === "perfil" &&
    (routeProfileUsername == null || routeProfileUsername.toLowerCase() === usuario.username.toLowerCase());
  const showActiveTrainingBar = Boolean(activeTraining && mainScreen !== "entrenamientoLibre");
  const activeRestFinished = Boolean(
    activeTraining?.rest &&
      (activeTraining.rest.finalizado || activeTraining.rest.restanteSegundos <= 0)
  );
  const activeTimerClassName = [
    "active-training-timer",
    activeTraining?.rest ? "resting" : "",
    activeRestFinished ? "rest-finished" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`shell ${showActiveTrainingBar ? "has-active-training" : ""}`}>
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
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 10v10h14V10" />
              <path d="M9 20v-6h6v6" />
            </svg>
            Inicio
          </button>
          {canTrain ? (
            <button
              type="button"
              className={`nav-btn ${mainScreen === "entrenamientoLibre" ? "active" : ""}`}
              onClick={() => navigateTo("entrenamientoLibre")}
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
                <path d="M3 8h18" />
                <path d="M6 6v4" />
                <path d="M18 6v4" />
                <circle cx="12" cy="6" r="2" />
                <path d="M12 8v5" />
                <path d="M8 13h8" />
                <path d="M9 18l3-5 3 5" />
              </svg>
              Entrenamiento
            </button>
          ) : null}
          <button
            type="button"
            className={`nav-btn ${mainScreen === "rutinas" ? "active" : ""}`}
            onClick={() => navigateTo("rutinas")}
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
              <path d="M8 3h8" />
              <path d="M9 3v3h6V3" />
              <path d="M6 5h12v16H6z" />
              <path d="M9 11h6" />
              <path d="M9 15h6" />
            </svg>
            Rutinas
          </button>
          <button
            type="button"
            className={`nav-btn ${mainScreen === "descubrir" ? "active" : ""}`}
            onClick={() => navigateTo("descubrir")}
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
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18" />
              <path d="M12 3c2.5 2.4 3.8 5.4 3.8 9S14.5 18.6 12 21" />
              <path d="M12 3C9.5 5.4 8.2 8.4 8.2 12S9.5 18.6 12 21" />
            </svg>
            Descubrir
          </button>
          <button
            type="button"
            className={`nav-btn ${isOwnProfileScreen ? "active" : ""}`}
            onClick={() => openProfile(usuario.username)}
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
              <circle cx="12" cy="6" r="3" />
              <path d="M12 9v6" />
              <path d="M8 12h8" />
              <path d="M9 21l3-6 3 6" />
            </svg>
            Perfil
          </button>
        </nav>

        <div className="topbar-actions">
          <button
            type="button"
            className={`settings-nav-btn gemini-nav-btn ${mainScreen === "rutinas" ? "active" : ""}`}
            onClick={openGeminiFromTopbar}
            aria-label="Abrir Gemini"
            title="Abrir Gemini"
          >
            <svg
              className="settings-nav-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2.5c.8 3.3 1.7 4.9 3 6.2s2.9 2.2 6.2 3c-3.3.8-4.9 1.7-6.2 3s-2.2 2.9-3 6.2c-.8-3.3-1.7-4.9-3-6.2s-2.9-2.2-6.2-3c3.3-.8 4.9-1.7 6.2-3s2.2-2.9 3-6.2Z" />
            </svg>
          </button>
          <button
            type="button"
            className={`pro-nav-btn ${mainScreen === "pro" ? "active" : ""}`}
            onClick={() => navigateTo("pro")}
            aria-label="GymMaxxing PRO"
            title="GymMaxxing PRO"
          >
            PRO
          </button>
          <button
            type="button"
            className={`settings-nav-btn notification-nav-btn ${mainScreen === "notificaciones" ? "active" : ""}`}
            onClick={() => navigateTo("notificaciones")}
            aria-label="Notificaciones"
            title="Notificaciones"
          >
            <svg
              className="settings-nav-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
              <path d="M9 17a3 3 0 0 0 6 0" />
            </svg>
            {unreadNotifications > 0 ? (
              <span className="notification-badge">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            className={`settings-nav-btn ${mainScreen === "ajustes" ? "active" : ""}`}
            onClick={() => navigateTo("ajustes")}
            aria-label="Ajustes"
            title="Ajustes"
          >
            <svg
              className="settings-nav-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2 2 0 0 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 15 19.37a1.7 1.7 0 0 0-1 .91l-.02.05a2 2 0 0 1-3.66 0l-.02-.05a1.7 1.7 0 0 0-1-.91 1.7 1.7 0 0 0-1.88.34l-.04.04a2 2 0 0 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-.91-1l-.05-.02a2 2 0 0 1 0-3.66l.05-.02a1.7 1.7 0 0 0 .91-1 1.7 1.7 0 0 0-.34-1.88l-.04-.04a2 2 0 0 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1-.91l.02-.05a2 2 0 0 1 3.66 0l.02.05a1.7 1.7 0 0 0 1 .91 1.7 1.7 0 0 0 1.88-.34l.04-.04a2 2 0 0 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.37 9c.38.14.7.45.91.82l.05.02a2 2 0 0 1 0 3.66l-.05.02a1.7 1.7 0 0 0-.88 1.48Z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="content">
        {mainScreen === "home" ? (
          <Home
            usuario={usuario}
            onOpenProfile={openProfile}
            onOpenTraining={(training) => openTraining(training, "home")}
            onOpenRoutine={openRoutine}
            onSaveAsRoutine={handleSaveTrainingAsRoutine}
          />
        ) : null}
        {canTrain ? (
          <div className={mainScreen === "entrenamientoLibre" ? "" : "screen-hidden"}>
            <Entrenamiento
              usuario={usuario}
              seed={trainingSeed}
              seedKey={trainingSeedKey}
              onSeedConsumed={() => setTrainingSeed(null)}
              onActiveTrainingChange={handleActiveTrainingChange}
              discardRequestKey={discardTrainingRequestKey}
            />
          </div>
        ) : null}
        <div className={mainScreen === "rutinas" ? "" : "screen-hidden"}>
          <Rutinas
            usuario={usuario}
            canTrain={canTrain}
            onStartTraining={(seed) => openTrainingFromSeed(seed, { recordCopy: false })}
            openGeminiPanelRequestKey={rutinasOpenGeminiRequestKey}
          />
        </div>
        {mainScreen === "descubrir" ? (
          <Descubrir
            usuario={usuario}
            onOpenProfile={openProfile}
            onOpenTraining={(training) => openTraining(training, "descubrir")}
          />
        ) : null}
        {mainScreen === "rutinaCompartida" && sharedRoutineId != null ? (
          <RutinaCompartida
            usuario={usuario}
            canTrain={canTrain}
            routineId={sharedRoutineId}
            onClose={() => {
              dismissSharedRoutine();
              navigate(pathForScreen("rutinas"), { replace: true });
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
        {mainScreen === "buscar" ? (
          <Buscar
            usuario={usuario}
            query={userSearchQuery}
            resultados={userSearchResults}
            onQueryChange={setUserSearchQuery}
            onResultadosChange={setUserSearchResults}
            onOpenProfile={openProfile}
          />
        ) : null}
        {mainScreen === "notificaciones" ? (
          <Notificaciones
            authToken={authToken}
            onAuthExpired={handleAuthExpired}
            onUnreadCountChange={setUnreadNotifications}
          />
        ) : null}
        {mainScreen === "pro" && authToken ? (
          <Pro
            onClose={() => navigateTo("home")}
            authToken={authToken}
            onAuthExpired={handleAuthExpired}
          />
        ) : null}
        {mainScreen === "perfil" ? (
          <Perfil
            usuario={usuario}
            profileUsername={routeProfileUsername ?? usuario.username}
            onOpenProfile={openProfile}
            onBack={goBackFromProfile}
            onOpenTraining={(training) => openTraining(training, "perfil")}
            onOpenRoutine={openRoutine}
            onSaveAsRoutine={handleSaveTrainingAsRoutine}
            authToken={authToken}
            onAuthExpired={handleAuthExpired}
            onUserUpdated={(nextUser) => {
              setUsuario(nextUser);
              if (authToken) {
                persistAuth({ usuario: nextUser, token: authToken });
              }
              if (mainScreen === "perfil") {
                navigate(`/perfil/${encodeURIComponent(nextUser.username)}`, { replace: true });
              }
            }}
          />
        ) : null}
        {mainScreen === "ajustes" ? (
          <main className="page-shell settings-page-shell">
            <section className="settings-card">
              <div className="settings-card-head">
                <span>Ajustes</span>
                <p>Preferencias de la cuenta</p>
              </div>
              <div className="settings-actions">
                <button type="button" className="settings-action-btn theme-action-btn" onClick={toggleTheme}>
                  {themeMode === "dark" ? "Tema claro" : "Tema oscuro"}
                </button>
                <button
                  type="button"
                  className={`settings-action-btn notifications-action-btn ${notificationSettingsOpen ? "active" : ""}`}
                  onClick={() => setNotificationSettingsOpen((prev) => !prev)}
                  aria-expanded={notificationSettingsOpen}
                >
                  <svg
                    className="settings-action-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                    <path d="M9 17a3 3 0 0 0 6 0" />
                  </svg>
                  Notificaciones
                </button>
                <button type="button" className="settings-action-btn logout-action-btn" onClick={handleLogout}>
                  Salir
                </button>
              </div>
            </section>
            {notificationSettingsOpen ? (
              <NotificationSettingsPanel authToken={authToken} onAuthExpired={handleAuthExpired} />
            ) : null}
          </main>
        ) : null}
        {mainScreen === "entrenamiento" && currentTraining ? (
          <EntrenamientoDetalle
            entrenamiento={currentTraining}
            canTrain={canTrain}
            onBack={goBackFromTraining}
            onOpenProfile={openProfile}
            onCopyToTraining={handleCopyTrainingToWorkout}
          />
        ) : null}
      </div>
      {showActiveTrainingBar && activeTraining ? (
        <div
          className="active-training-bar"
          role="button"
          tabIndex={0}
          onClick={() => navigate(pathForScreen("entrenamientoLibre"))}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              navigate(pathForScreen("entrenamientoLibre"));
            }
          }}
        >
          <div className="active-training-main">
            <small className={activeRestFinished ? "active-training-mode finished" : "active-training-mode"}>
              {activeRestFinished ? (
                <>
                  <span>Entrenamiento</span>
                  <span>{formatDuration(activeTraining.elapsedSeconds)}</span>
                </>
              ) : activeTraining.rest ? (
                "Descanso activo"
              ) : (
                "Entrenamiento en curso"
              )}
            </small>
            <strong>{activeTraining.title}</strong>
          </div>
          <div className="active-training-meta">
            <span className={activeTimerClassName}>
              {formatDuration(activeTraining.rest?.restanteSegundos ?? activeTraining.elapsedSeconds)}
            </span>
            <span>
              {activeTraining.nextExerciseName
                ? `Próximo: ${activeTraining.nextExerciseName}`
                : "Listo para completar"}
            </span>
            <span>
              {activeTraining.completedSeries}/{activeTraining.totalSeries} series
            </span>
          </div>
          <button
            type="button"
            className="active-training-discard"
            onClick={(event) => {
              event.stopPropagation();
              requestDiscardActiveTraining();
            }}
            disabled={activeTraining.loading}
            aria-label="Descartar entrenamiento"
            title="Descartar entrenamiento"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v5" />
              <path d="M14 11v5" />
            </svg>
          </button>
        </div>
      ) : null}
      {discardTrainingModalOpen && activeTraining ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!activeTraining.loading) {
              setDiscardTrainingModalOpen(false);
            }
          }}
        >
          <div
            className="modal-card save-name-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Descartar entrenamiento"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h2>Descartar entrenamiento</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDiscardTrainingModalOpen(false)}
                disabled={activeTraining.loading}
              >
                ×
              </button>
            </div>
            <p className="helper-text">Se borrara por completo el entrenamiento en curso.</p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setDiscardTrainingModalOpen(false)}
                disabled={activeTraining.loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={confirmDiscardActiveTraining}
                disabled={activeTraining.loading}
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
