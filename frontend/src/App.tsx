import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import {
  fetchSessionSeed,
  getSourceRoutineIdFromSeed,
  recordRoutineCopy,
  saveTrainingSeedAsRoutine,
} from "./lib/trainingTransfer";
import { canUseTrainingFeatures } from "./lib/roles";
import type { EntrenamientoResumen, ProPlanId, RoutinePostSummary, SearchUser, TrainingSeed, Usuario } from "./types";
import Entrenamiento, { type ActiveTrainingSnapshot } from "./pages/Entrenamiento";
import Home from "./pages/Home";
import Buscar from "./pages/Buscar";
import Descubrir from "./pages/Descubrir";
import EntrenamientoDetalle from "./pages/EntrenamientoDetalle";
import Login from "./pages/Login";
import Perfil from "./pages/Perfil";
import Pro from "./pages/Pro";
import Register from "./pages/Register";
import NotificationSettingsPanel from "./components/NotificationSettingsPanel";
import AppSidebar, { type SidebarItemKey } from "./components/AppSidebar";
import NotificationsDrawer from "./components/NotificationsDrawer";
import GymBroxx from "./components/GymBroxx/GymBroxx";

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
  // /rutinas, /rutinas/nueva y /rutinas/:id/editar los maneja la pantalla de Rutinas.
  if (pathname === "/rutinas" || pathname.startsWith("/rutinas/")) {
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
  const [homeRefreshKey, setHomeRefreshKey] = useState(0);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [activeProfileUsername, setActiveProfileUsername] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [proPlan, setProPlan] = useState<ProPlanId | null>(initialAuth?.usuario.pro_plan ?? null);
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
  const requestedProfileUsername =
    usuario && mainScreen === "perfil" ? routeProfileUsername ?? usuario.username : null;
  const profileUsernameForRender = requestedProfileUsername ?? activeProfileUsername;

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
    if (requestedProfileUsername) {
      setActiveProfileUsername(requestedProfileUsername);
    }
  }, [requestedProfileUsername]);

  // Las notificaciones ahora son un panel lateral: /notificaciones abre el panel sobre el inicio.
  useEffect(() => {
    if (usuario && mainScreen === "notificaciones") {
      setNotificationsOpen(true);
      navigate(pathForScreen("home"), { replace: true });
    }
  }, [mainScreen, navigate, usuario]);

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
    setNotificationsOpen(false);
    if (screen !== "rutinaCompartida") {
      dismissSharedRoutine();
    }

    if (screen === "home" && mainScreen === "home") {
      setHomeRefreshKey((prev) => prev + 1);
      return;
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
    setNotificationsOpen(false);
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

  // "Volver" de las pantallas de detalle: si se llegó navegando dentro de la app, volvemos a la
  // entrada anterior del historial (misma URL exacta, por ejemplo /descubrir/tendencias/mayor-volumen),
  // igual que el botón atrás del navegador. Si se entró directo por URL, vamos a la pantalla de respaldo.
  const goBackOr = (fallbackPath: string) => {
    const historyIndex = (window.history.state as { idx?: unknown } | null)?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      navigate(-1);
      return;
    }

    navigate(fallbackPath, { replace: true });
  };

  const goBackFromProfile = () => {
    goBackOr(pathForScreen("home"));
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

  const openRoutineById = (routineId: number) => {
    dismissSharedRoutine();
    navigate(sharedRoutinePath(routineId));
  };

  const openRoutine = (routine: RoutinePostSummary) => {
    openRoutineById(routine.id_rutina);
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
    goBackOr(pathForScreen(routeState?.returnScreen ?? trainingReturnScreen));
  };

  const handleLogout = useCallback(() => {
    setUsuario(null);
    setAuthToken(null);
    setUnreadNotifications(0);
    setNotificationsOpen(false);
    setProPlan(null);
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

  const isProScreen = mainScreen === "pro";

  // Plan actual para mostrarlo en la barra lateral (se refresca al entrar/salir de la pantalla PRO).
  useEffect(() => {
    if (!authToken) {
      return;
    }

    let cancelled = false;

    const loadPlan = async () => {
      try {
        const res = await fetch("http://localhost:3000/suscripciones/me", {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as {
          isPro?: boolean;
          subscription?: { plan?: ProPlanId } | null;
        };

        if (!cancelled) {
          setProPlan(data.isPro ? data.subscription?.plan ?? "monthly" : null);
        }
      } catch {
        // Es solo informativo para la barra lateral.
      }
    };

    void loadPlan();
    return () => {
      cancelled = true;
    };
  }, [authToken, isProScreen]);

  const closeNotifications = useCallback(() => {
    setNotificationsOpen(false);
  }, []);

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
  const openOwnProfileFromTopbar = () => {
    setNotificationsOpen(false);
    if (isOwnProfileScreen) {
      setProfileRefreshKey((prev) => prev + 1);
      return;
    }

    openProfile(usuario.username);
  };
  const sidebarActiveKey: SidebarItemKey | null = (() => {
    if (notificationsOpen) return "notificaciones";
    if (mainScreen === "home") return "home";
    if (mainScreen === "entrenamientoLibre") return "entrenamiento";
    if (mainScreen === "rutinas") return "rutinas";
    if (mainScreen === "descubrir") return "descubrir";
    if (mainScreen === "buscar") return "buscar";
    if (isOwnProfileScreen) return "perfil";
    if (mainScreen === "pro") return "plan";
    if (mainScreen === "ajustes") return "mas";
    return null;
  })();
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
      <AppSidebar
        usuario={usuario}
        canTrain={canTrain}
        activeKey={sidebarActiveKey}
        unreadNotifications={unreadNotifications}
        notificationsOpen={notificationsOpen}
        themeMode={themeMode}
        proPlan={proPlan}
        onGoHome={() => navigateTo("home")}
        onGoTraining={() => navigateTo("entrenamientoLibre")}
        onGoRoutines={() => navigateTo("rutinas")}
        onGoDiscover={() => navigateTo("descubrir")}
        onGoSearch={() => navigateTo("buscar")}
        onToggleNotifications={() => setNotificationsOpen((prev) => !prev)}
        onGoProfile={openOwnProfileFromTopbar}
        onOpenGemini={openGeminiFromTopbar}
        onGoPlan={() => navigateTo("pro")}
        onOpenSettings={() => navigateTo("ajustes")}
        onToggleTheme={toggleTheme}
        onLogout={handleLogout}
      />
      <NotificationsDrawer
        open={notificationsOpen}
        usuario={usuario}
        authToken={authToken}
        onClose={closeNotifications}
        onAuthExpired={handleAuthExpired}
        onUnreadCountChange={setUnreadNotifications}
        onOpenProfile={openProfile}
        onOpenSettings={() => navigateTo("ajustes")}
      />

      <div className="content">
        <div className={mainScreen === "home" ? "" : "screen-hidden"}>
          <Home
            usuario={usuario}
            isActive={mainScreen === "home"}
            refreshKey={homeRefreshKey}
            onOpenProfile={openProfile}
            onOpenTraining={(training) => openTraining(training, "home")}
            onOpenRoutine={openRoutine}
            onSaveAsRoutine={handleSaveTrainingAsRoutine}
          />
        </div>
        {canTrain ? (
          <div className={mainScreen === "entrenamientoLibre" ? "" : "screen-hidden"}>
            <Entrenamiento
              usuario={usuario}
              seed={trainingSeed}
              seedKey={trainingSeedKey}
              onSeedConsumed={() => setTrainingSeed(null)}
              onActiveTrainingChange={handleActiveTrainingChange}
              discardRequestKey={discardTrainingRequestKey}
              onTrainingSaved={(text) => {
                // Al guardar vamos al inicio y recargamos el feed para que aparezca el entrenamiento nuevo.
                setAppToast({ type: "ok", text });
                setNotificationsOpen(false);
                setHomeRefreshKey((prev) => prev + 1);
                navigate(pathForScreen("home"), { replace: true });
              }}
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
            onOpenRoutine={openRoutineById}
          />
        ) : null}
        {mainScreen === "rutinaCompartida" && sharedRoutineId != null ? (
          <RutinaCompartida
            usuario={usuario}
            canTrain={canTrain}
            routineId={sharedRoutineId}
            onClose={() => {
              dismissSharedRoutine();
              goBackOr(pathForScreen("rutinas"));
            }}
            onOpenProfile={openProfile}
            onCopyToTraining={(seed, options) => {
              if (!canTrain) {
                setAppToast({
                  type: "error",
                  text: "Las cuentas gimnasio no pueden iniciar entrenamientos",
                });
                return;
              }
              // Empezar una rutina propia no cuenta como "copia" para los rankings.
              openTrainingFromSeed(seed, { recordCopy: !options?.isOwnRoutine });
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
        {mainScreen === "pro" && authToken ? (
          <Pro
            onClose={() => navigateTo("home")}
            onExplorePro={() => navigateTo("perfil")}
            authToken={authToken}
            onAuthExpired={handleAuthExpired}
          />
        ) : null}
        <div className={mainScreen === "perfil" ? "" : "screen-hidden"}>
          {profileUsernameForRender ? (
            <Perfil
              usuario={usuario}
              profileUsername={profileUsernameForRender}
              isActive={mainScreen === "perfil"}
              refreshKey={profileRefreshKey}
              onOpenProfile={openProfile}
              onBack={goBackFromProfile}
              onOpenTraining={(training) => openTraining(training, "perfil")}
              onOpenRoutine={openRoutine}
              onSaveAsRoutine={handleSaveTrainingAsRoutine}
              authToken={authToken}
              onAuthExpired={handleAuthExpired}
              onUserUpdated={(nextUser) => {
                setUsuario(nextUser);
                setActiveProfileUsername(nextUser.username);
                if (authToken) {
                  persistAuth({ usuario: nextUser, token: authToken });
                }
                if (mainScreen === "perfil") {
                  navigate(`/perfil/${encodeURIComponent(nextUser.username)}`, { replace: true });
                }
              }}
            />
          ) : null}
        </div>
        {mainScreen === "ajustes" ? (
          <main className="page-shell settings-page-shell">
            <section className="page-hero compact settings-page-hero">
              <h1>Configuración</h1>
              <p className="subtitle">Elegí qué avisos querés recibir y por dónde.</p>
            </section>
            <NotificationSettingsPanel authToken={authToken} onAuthExpired={handleAuthExpired} />
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
      <GymBroxx
        usuario={usuario}
        canTrain={canTrain}
        isTraining={Boolean(activeTraining)}
        lifted={showActiveTrainingBar}
        onAction={(action) => navigateTo(action === "training" ? "entrenamientoLibre" : "rutinas")}
      />
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
