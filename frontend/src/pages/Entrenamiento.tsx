import { useEffect, useMemo, useRef, useState } from "react";
import bodybuilderFlexSample from "../assets/bodybuilder-flex-sample.webp";
import siluetaStrongman from "../assets/siluetastrongman.png";
import { canUseTrainingFeatures } from "../lib/roles";
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH, limitDescription, limitTitle } from "../lib/textLimits";
import { saveTrainingSeedAsRoutine } from "../lib/trainingTransfer";
import type { TrainingSeed, TrainingSetType, Usuario } from "../types";
import TrashIcon from "../components/TrashIcon";
import DurationInput from "../components/DurationInput";

type Ejercicio = {
  id_ejercicio: number;
  nombre: string;
  descripcion: string;
  grupo_muscular: string;
  tipo_disciplina: string;
};

type CarpetaRutina = {
  id_carpeta: number;
  nombre: string;
  id_carpeta_padre: number | null;
};

type EjecucionSerie = {
  id: string;
  numero: number;
  kg: string;
  reps: string;
  km: string;
  tiempoSegundos: number;
  timerActivo: boolean;
  tipo: TrainingSetType;
  completada: boolean;
  registrada: boolean;
};

type SerieAnterior = {
  orden: number;
  repeticiones: number;
  peso: number | null;
  distancia_km: number | null;
  tiempo_segundos: number | null;
  tipo_serie: TrainingSetType;
};

type EjecucionEjercicio = {
  instanceId: string;
  id_ejercicio: number;
  nombre: string;
  grupo_muscular: string;
  tipo_disciplina: string;
  nota: string;
  descansoSegundos: number;
  series: EjecucionSerie[];
};

type SesionEntrenamiento = {
  id_sesion: number;
  usuario_id: number;
  rutina_id: number | null;
  descripcion: string | null;
  nombre_rutina_snapshot?: string | null;
};

type DescansoActivo = {
  restanteSegundos: number;
  etiqueta: string;
  finalizado: boolean;
};

export type ActiveTrainingSnapshot = {
  sessionId: number;
  title: string;
  elapsedSeconds: number;
  completedSeries: number;
  totalSeries: number;
  nextExerciseName: string | null;
  rest: DescansoActivo | null;
  loading: boolean;
};

type EntrenamientoProps = {
  usuario: Usuario;
  seed?: TrainingSeed | null;
  seedKey?: number;
  onSeedConsumed?: () => void;
  onActiveTrainingChange?: (snapshot: ActiveTrainingSnapshot | null) => void;
  discardRequestKey?: number;
};

type VistaEntrenamiento = "inicio" | "ejecucion" | "guardar";

const API = "http://localhost:3000";
const ACTIVE_TRAINING_STORAGE_PREFIX = "gymmaxxing_active_training_v1";
const TRAINING_DELETED_EVENT = "gymmaxxing:training-deleted";
const EXERCISE_NOTE_MAX_LENGTH = 120;

const SET_TIPO_OPTIONS: Array<{ value: TrainingSetType; label: string }> = [
  { value: "warmup", label: "WarmUp" },
  { value: "serie", label: "Serie" },
  { value: "dropset", label: "DropSet" },
  { value: "failure", label: "Failure" },
];

const parseError = async (res: Response, fallback: string) => {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const limitExerciseNote = (value: string) => value.slice(0, EXERCISE_NOTE_MAX_LENGTH);
const twoDigits = (value: number) => String(value).padStart(2, "0");

const formatDuration = (totalSeconds: number) => {
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${twoDigits(min)}:${twoDigits(sec)}`;
};

const descansoDesdeInputs = (minRaw: string, secRaw: string) => {
  const min = Number(minRaw || "0");
  const sec = Number(secRaw || "0");
  const safeMin = Number.isNaN(min) ? 0 : clamp(Math.floor(min), 0, 999);
  const safeSec = Number.isNaN(sec) ? 0 : clamp(Math.floor(sec), 0, 59);
  return safeMin * 60 + safeSec;
};

const descansoToInputs = (descansoSegundos: number) => {
  const safe = Number.isFinite(descansoSegundos) ? Math.max(0, Math.floor(descansoSegundos)) : 0;
  return {
    min: String(Math.floor(safe / 60)),
    sec: String(safe % 60),
  };
};

const crearSerieEjecucion = (): EjecucionSerie => ({
  id: crypto.randomUUID(),
  numero: 1,
  kg: "",
  reps: "",
  km: "",
  tiempoSegundos: 0,
  timerActivo: false,
  tipo: "serie",
  completada: false,
  registrada: false,
});

const isTrainingSetType = (value: string): value is TrainingSetType =>
  SET_TIPO_OPTIONS.some((option) => option.value === value);

type ExerciseInputMode = "strength" | "repsOnly" | "timed" | "cardio";

type PersistedActiveTraining = {
  usuarioId: number;
  savedAt: number;
  vista: Extract<VistaEntrenamiento, "ejecucion" | "guardar">;
  sesionActiva: SesionEntrenamiento;
  sourceRoutineIdContext: number | null;
  ejecucionEjercicios: EjecucionEjercicio[];
  descansoActivo: DescansoActivo | null;
  elapsedSesionSegundos: number;
  totalTrofeosEntrenamiento: number;
  guardarNombre: string;
  guardarDescripcion: string;
  guardarCarpetaId: string;
  guardarComoRutina: boolean;
  filtroEquipo: string;
  filtroMusculo: string;
  busquedaEjercicio: string;
};

const activeTrainingStorageKey = (usuarioId: number) =>
  `${ACTIVE_TRAINING_STORAGE_PREFIX}:${usuarioId}`;

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const getExerciseInputMode = (ejercicio: Pick<EjecucionEjercicio, "nombre" | "grupo_muscular">): ExerciseInputMode => {
  const nombre = normalizeText(ejercicio.nombre);
  const grupo = normalizeText(ejercicio.grupo_muscular);

  if (grupo === "cardio") {
    return "cardio";
  }

  if (grupo === "core" && nombre === "plancha") {
    return "timed";
  }

  if (
    grupo === "core" &&
    (nombre === "crunch abdominal" || nombre === "elevaciones de piernas")
  ) {
    return "repsOnly";
  }

  return "strength";
};

const formatSerieAnterior = (serie: SerieAnterior, mode: ExerciseInputMode) => {
  if (mode === "repsOnly") {
    return serie.repeticiones > 0 ? `${serie.repeticiones} reps` : "-";
  }

  if (mode === "timed") {
    return serie.tiempo_segundos && serie.tiempo_segundos > 0 ? formatDuration(serie.tiempo_segundos) : "-";
  }

  if (mode === "cardio") {
    const hasDistance = serie.distancia_km != null;
    const hasTime = serie.tiempo_segundos != null && serie.tiempo_segundos > 0;
    if (!hasDistance && !hasTime) {
      return "-";
    }
    const km = hasDistance ? `${serie.distancia_km} km` : "-";
    return `${km} en ${formatDuration(serie.tiempo_segundos ?? 0)}`;
  }

  if (serie.repeticiones <= 0) {
    return "-";
  }

  const peso = serie.peso == null ? "0" : String(serie.peso);
  return `${peso}x${serie.repeticiones}`;
};

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 4H16V8.5C16 11 14.2 13 12 13C9.8 13 8 11 8 8.5V4Z"
        fill="currentColor"
      />
      <path
        d="M8 6H5.5C5.5 8.8 6.8 10.5 9 10.8M16 6H18.5C18.5 8.8 17.2 10.5 15 10.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11 13H13V17H16.5V20H7.5V17H11V13Z" fill="currentColor" />
    </svg>
  );
}

function Entrenamiento({
  usuario,
  seed,
  seedKey,
  onSeedConsumed,
  onActiveTrainingChange,
  discardRequestKey = 0,
}: EntrenamientoProps) {
  const [vista, setVista] = useState<VistaEntrenamiento>("inicio");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const [catalogoEjercicios, setCatalogoEjercicios] = useState<Ejercicio[]>([]);
  const [catalogoLoading, setCatalogoLoading] = useState(false);
  const [catalogoError, setCatalogoError] = useState("");
  const [carpetas, setCarpetas] = useState<CarpetaRutina[]>([]);
  const [filtroEquipo, setFiltroEquipo] = useState("");
  const [filtroMusculo, setFiltroMusculo] = useState("");
  const [busquedaEjercicio, setBusquedaEjercicio] = useState("");

  const [sesionActiva, setSesionActiva] = useState<SesionEntrenamiento | null>(null);
  const [sourceRoutineIdContext, setSourceRoutineIdContext] = useState<number | null>(null);
  const [ejecucionEjercicios, setEjecucionEjercicios] = useState<EjecucionEjercicio[]>([]);
  const [draggedExerciseInstanceId, setDraggedExerciseInstanceId] = useState<string | null>(null);
  const [pendingExerciseScrollId, setPendingExerciseScrollId] = useState<string | null>(null);
  const [seriesAnterioresPorEjercicio, setSeriesAnterioresPorEjercicio] = useState<
    Record<number, SerieAnterior[]>
  >({});
  const [descansoActivo, setDescansoActivo] = useState<DescansoActivo | null>(null);
  const [elapsedSesionSegundos, setElapsedSesionSegundos] = useState(0);
  const [totalTrofeosEntrenamiento, setTotalTrofeosEntrenamiento] = useState(0);

  const [guardarNombre, setGuardarNombre] = useState("");
  const [guardarDescripcion, setGuardarDescripcion] = useState("");
  const [guardarCarpetaId, setGuardarCarpetaId] = useState("");
  const [guardarComoRutina, setGuardarComoRutina] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [activeTrainingHydrated, setActiveTrainingHydrated] = useState(false);
  const handledDiscardRequestKey = useRef(0);
  const descartarEntrenamientoRef = useRef<(() => Promise<void>) | null>(null);
  const catalogoAutoReloadTriedRef = useRef(false);
  const exerciseRefs = useRef(new Map<string, HTMLElement>());
  const canTrain = canUseTrainingFeatures(usuario);

  const totalSeriesEjecucion = useMemo(
    () => ejecucionEjercicios.reduce((acc, ejercicio) => acc + ejercicio.series.length, 0),
    [ejecucionEjercicios],
  );

  const seriesCompletadasEjecucion = useMemo(
    () =>
      ejecucionEjercicios.reduce(
        (acc, ejercicio) => acc + ejercicio.series.filter((serie) => serie.completada).length,
        0,
      ),
    [ejecucionEjercicios],
  );

  useEffect(() => {
    if (pendingExerciseScrollId == null) {
      return;
    }

    window.requestAnimationFrame(() => {
      exerciseRefs.current.get(pendingExerciseScrollId)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    setPendingExerciseScrollId(null);
  }, [ejecucionEjercicios, pendingExerciseScrollId]);

  const equipos = useMemo(
    () =>
      Array.from(
        new Set(catalogoEjercicios.map((ejercicio) => ejercicio.tipo_disciplina).filter(Boolean)),
      ),
    [catalogoEjercicios],
  );

  const musculos = useMemo(
    () =>
      Array.from(
        new Set(catalogoEjercicios.map((ejercicio) => ejercicio.grupo_muscular).filter(Boolean)),
      ),
    [catalogoEjercicios],
  );

  const catalogoFiltrado = useMemo(() => {
    return catalogoEjercicios.filter((ejercicio) => {
      const matchEquipo = !filtroEquipo || ejercicio.tipo_disciplina === filtroEquipo;
      const matchMusculo = !filtroMusculo || ejercicio.grupo_muscular === filtroMusculo;
      const search = busquedaEjercicio.trim().toLowerCase();
      const matchSearch =
        !search ||
        ejercicio.nombre.toLowerCase().includes(search) ||
        ejercicio.grupo_muscular.toLowerCase().includes(search);
      return matchEquipo && matchMusculo && matchSearch;
    });
  }, [busquedaEjercicio, catalogoEjercicios, filtroEquipo, filtroMusculo]);

  const nextExerciseName = useMemo(() => {
    const nextExercise = ejecucionEjercicios.find((ejercicio) =>
      ejercicio.series.some((serie) => !serie.completada),
    );

    return nextExercise?.nombre ?? null;
  }, [ejecucionEjercicios]);

  const cargarCatalogoEjercicios = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      setCatalogoLoading(true);
      setCatalogoError("");

      const res = await fetch(`${API}/ejercicios`);
      if (!res.ok) {
        throw new Error(await parseError(res, "No se pudo obtener el catalogo de ejercicios"));
      }

      const data = (await res.json()) as Ejercicio[] | { items?: Ejercicio[] };
      const nextCatalogo = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
      setCatalogoEjercicios(nextCatalogo);

      if (nextCatalogo.length === 0) {
        setCatalogoError("El catalogo de ejercicios esta vacio.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo obtener el catalogo de ejercicios";
      setCatalogoError(message);
      if (!silent) {
        setError(message);
      }
    } finally {
      setCatalogoLoading(false);
    }
  };

  const cargarCarpetas = async () => {
    const res = await fetch(`${API}/rutinas/carpetas?usuario_id=${usuario.id}`);
    if (!res.ok) {
      setCarpetas([]);
      return;
    }

    const data = (await res.json()) as CarpetaRutina[];
    setCarpetas(data);
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([cargarCatalogoEjercicios({ silent: true }), cargarCarpetas()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando entrenamiento");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [usuario.id]);

  useEffect(() => {
    setActiveTrainingHydrated(false);
    const storageKey = activeTrainingStorageKey(usuario.id);

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedActiveTraining>;
      if (
        parsed.usuarioId !== usuario.id ||
        !parsed.sesionActiva ||
        typeof parsed.sesionActiva.id_sesion !== "number"
      ) {
        localStorage.removeItem(storageKey);
        return;
      }

      const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now();
      const elapsedAway = Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
      const restoredVista = parsed.vista === "guardar" ? "guardar" : "ejecucion";
      const restoredExercises = Array.isArray(parsed.ejecucionEjercicios)
        ? parsed.ejecucionEjercicios.map((ejercicio) => ({
            ...ejercicio,
            instanceId: ejercicio.instanceId ?? crypto.randomUUID(),
            nota: limitExerciseNote(ejercicio.nota ?? ""),
            series: ejercicio.series.map((serie) =>
              restoredVista === "ejecucion" && serie.timerActivo
                ? { ...serie, tiempoSegundos: serie.tiempoSegundos + elapsedAway }
                : serie,
            ),
          }))
        : [];

      const storedRest = parsed.descansoActivo ?? null;
      const restoredRest =
        storedRest && restoredVista === "ejecucion" && !storedRest.finalizado
          ? {
              ...storedRest,
              restanteSegundos: Math.max(0, storedRest.restanteSegundos - elapsedAway),
              finalizado: storedRest.restanteSegundos - elapsedAway <= 0,
            }
          : storedRest;

      setVista(restoredVista);
      setSesionActiva(parsed.sesionActiva);
      setSourceRoutineIdContext(parsed.sourceRoutineIdContext ?? null);
      setEjecucionEjercicios(restoredExercises);
      setSeriesAnterioresPorEjercicio({});
      setDescansoActivo(restoredRest);
      setElapsedSesionSegundos(
        Math.max(0, (parsed.elapsedSesionSegundos ?? 0) + (restoredVista === "ejecucion" ? elapsedAway : 0)),
      );
      setTotalTrofeosEntrenamiento(parsed.totalTrofeosEntrenamiento ?? 0);
      setGuardarNombre(limitTitle(parsed.guardarNombre ?? ""));
      setGuardarDescripcion(limitDescription(parsed.guardarDescripcion ?? ""));
      setGuardarCarpetaId(parsed.guardarCarpetaId ?? "");
      setGuardarComoRutina(Boolean(parsed.guardarComoRutina));
      setFiltroEquipo(parsed.filtroEquipo ?? "");
      setFiltroMusculo(parsed.filtroMusculo ?? "");
      setBusquedaEjercicio(parsed.busquedaEjercicio ?? "");
      setConfirmDiscardOpen(false);
      setMensaje("Entrenamiento restaurado");
    } catch (err) {
      console.error("No se pudo restaurar el entrenamiento activo", err);
      localStorage.removeItem(storageKey);
    } finally {
      setActiveTrainingHydrated(true);
    }
  }, [usuario.id]);

  useEffect(() => {
    if (!activeTrainingHydrated) {
      return;
    }

    const storageKey = activeTrainingStorageKey(usuario.id);
    if (!sesionActiva || (vista !== "ejecucion" && vista !== "guardar")) {
      localStorage.removeItem(storageKey);
      return;
    }

    const payload: PersistedActiveTraining = {
      usuarioId: usuario.id,
      savedAt: Date.now(),
      vista,
      sesionActiva,
      sourceRoutineIdContext,
      ejecucionEjercicios,
      descansoActivo,
      elapsedSesionSegundos,
      totalTrofeosEntrenamiento,
      guardarNombre,
      guardarDescripcion,
      guardarCarpetaId,
      guardarComoRutina,
      filtroEquipo,
      filtroMusculo,
      busquedaEjercicio,
    };

    localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [
    busquedaEjercicio,
    descansoActivo,
    ejecucionEjercicios,
    elapsedSesionSegundos,
    filtroEquipo,
    filtroMusculo,
    guardarCarpetaId,
    guardarComoRutina,
    guardarDescripcion,
    guardarNombre,
    sesionActiva,
    sourceRoutineIdContext,
    totalTrofeosEntrenamiento,
    usuario.id,
    vista,
    activeTrainingHydrated,
  ]);

  useEffect(() => {
    if (vista !== "ejecucion") {
      catalogoAutoReloadTriedRef.current = false;
      return;
    }

    if (catalogoEjercicios.length > 0) {
      catalogoAutoReloadTriedRef.current = false;
      return;
    }

    if (catalogoLoading || catalogoAutoReloadTriedRef.current) {
      return;
    }

    catalogoAutoReloadTriedRef.current = true;
    void cargarCatalogoEjercicios({ silent: true });
  }, [catalogoEjercicios.length, catalogoLoading, vista]);

  useEffect(() => {
    if (!descansoActivo || descansoActivo.finalizado) {
      return;
    }

    const timer = window.setInterval(() => {
      setDescansoActivo((prev) => {
        if (!prev) {
          return null;
        }
        if (prev.restanteSegundos <= 1) {
          return { ...prev, restanteSegundos: 0, finalizado: true };
        }
        return { ...prev, restanteSegundos: prev.restanteSegundos - 1 };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [descansoActivo]);

  useEffect(() => {
    if (vista !== "ejecucion" || !sesionActiva) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSesionSegundos((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [sesionActiva, vista]);

  useEffect(() => {
    if (vista !== "ejecucion") {
      return;
    }

    const hasRunningTimer = ejecucionEjercicios.some((ejercicio) =>
      ejercicio.series.some((serie) => serie.timerActivo),
    );

    if (!hasRunningTimer) {
      return;
    }

    const timer = window.setInterval(() => {
      setEjecucionEjercicios((prev) =>
        prev.map((ejercicio) => ({
          ...ejercicio,
          series: ejercicio.series.map((serie) =>
            serie.timerActivo
              ? { ...serie, tiempoSegundos: serie.tiempoSegundos + 1 }
              : serie,
          ),
        })),
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [ejecucionEjercicios, vista]);

  useEffect(() => {
    if (!mensaje) {
      return;
    }
    const timer = window.setTimeout(() => {
      setMensaje("");
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [mensaje]);

  useEffect(() => {
    if (!error) {
      return;
    }
    const timer = window.setTimeout(() => {
      setError("");
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [error]);

  const resetEntrenamiento = () => {
    localStorage.removeItem(activeTrainingStorageKey(usuario.id));
    setVista("inicio");
    setSesionActiva(null);
    setSourceRoutineIdContext(null);
    setEjecucionEjercicios([]);
    setDraggedExerciseInstanceId(null);
    setSeriesAnterioresPorEjercicio({});
    setDescansoActivo(null);
    setElapsedSesionSegundos(0);
    setTotalTrofeosEntrenamiento(0);
    setGuardarNombre("");
    setGuardarDescripcion("");
    setGuardarCarpetaId("");
    setGuardarComoRutina(false);
    setFiltroEquipo("");
    setFiltroMusculo("");
    setBusquedaEjercicio("");
    setConfirmDiscardOpen(false);
  };

  useEffect(() => {
    const handleTrainingDeleted = (event: Event) => {
      const sessionId = (event as CustomEvent<{ sessionId?: number }>).detail?.sessionId;
      if (!sessionId || sesionActiva?.id_sesion !== sessionId) {
        return;
      }

      resetEntrenamiento();
      setMensaje("El entrenamiento fue eliminado");
    };

    window.addEventListener(TRAINING_DELETED_EVENT, handleTrainingDeleted);
    return () => window.removeEventListener(TRAINING_DELETED_EVENT, handleTrainingDeleted);
  }, [sesionActiva?.id_sesion, usuario.id]);

  const renderToast = () => {
    if (!error && !mensaje) {
      return null;
    }

    const isError = Boolean(error);
    return (
      <div className={`toast-pop ${isError ? "error" : "ok"}`} role="status" aria-live="polite">
        {isError ? error : mensaje}
      </div>
    );
  };

  const ajustarDescansoActivo = (delta: number) => {
    setDescansoActivo((prev) => {
      if (!prev) {
        return prev;
      }
      const next = Math.max(0, prev.restanteSegundos + delta);
      return {
        ...prev,
        restanteSegundos: next,
        finalizado: next === 0,
      };
    });
  };

  const omitirDescansoActivo = () => {
    setDescansoActivo((prev) =>
      prev
        ? {
            ...prev,
            restanteSegundos: 0,
            finalizado: true,
          }
        : prev,
    );
  };

  const registrarSerie = async (
    ejercicio: EjecucionEjercicio,
    serie: EjecucionSerie,
    sesionId: number,
  ) => {
    const mode = getExerciseInputMode(ejercicio);
    const reps = Number(serie.reps || "0");
    const kg = Number(serie.kg || "0");
    const km = Number(serie.km || "0");
    const payload = {
      repeticiones:
        mode === "strength" || mode === "repsOnly"
          ? Number.isNaN(reps)
            ? 1
            : Math.max(1, reps)
          : 0,
      peso:
        mode === "strength" && !Number.isNaN(kg) && serie.kg.trim()
          ? Math.max(0, kg)
          : null,
      distancia_km:
        mode === "cardio" && !Number.isNaN(km) && serie.km.trim()
          ? Math.max(0, km)
          : null,
      tiempo_segundos:
        mode === "cardio" || mode === "timed" ? Math.max(0, serie.tiempoSegundos) : null,
      descanso: ejercicio.descansoSegundos,
      orden: serie.numero,
      ejercicio_id: ejercicio.id_ejercicio,
      sesion_id: sesionId,
      tipo_serie: serie.tipo,
      nota_ejercicio: limitExerciseNote(ejercicio.nota.trim()) || null,
    };

    const res = await fetch(`${API}/entrenamientos/serie`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(await parseError(res, "No se pudo registrar la serie"));
    }
  };

  const syncSeriesDeSesion = async (sesionId: number) => {
    const series = ejecucionEjercicios.flatMap((ejercicio) =>
      ejercicio.series
        .filter((serie) => serie.completada)
        .map((serie) => {
          const mode = getExerciseInputMode(ejercicio);
          const reps = Number(serie.reps || "0");
          const kg = Number(serie.kg || "0");
          const km = Number(serie.km || "0");
          return {
            repeticiones:
              mode === "strength" || mode === "repsOnly"
                ? Number.isNaN(reps)
                  ? 1
                  : Math.max(1, reps)
                : 0,
            peso:
              mode === "strength" && !Number.isNaN(kg) && serie.kg.trim()
                ? Math.max(0, kg)
                : null,
            distancia_km:
              mode === "cardio" && !Number.isNaN(km) && serie.km.trim()
                ? Math.max(0, km)
                : null,
            tiempo_segundos:
              mode === "cardio" || mode === "timed" ? Math.max(0, serie.tiempoSegundos) : null,
            descanso: ejercicio.descansoSegundos,
            orden: serie.numero,
            ejercicio_id: ejercicio.id_ejercicio,
            tipo_serie: serie.tipo,
            nota_ejercicio: limitExerciseNote(ejercicio.nota.trim()) || null,
          };
        }),
    );

    const res = await fetch(`${API}/entrenamientos/${sesionId}/series`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ series }),
    });

    if (!res.ok) {
      throw new Error(await parseError(res, "No se pudieron sincronizar las series"));
    }
  };

  const buildCurrentTrainingSeed = (): TrainingSeed => ({
    origin: "sesion",
    sourceId: sesionActiva?.id_sesion ?? 0,
    sourceRoutineId: sourceRoutineIdContext,
    title: limitTitle(guardarNombre.trim()) || "Entrenamiento",
    description: guardarDescripcion.trim() || null,
    durationMinutes: Math.max(1, Math.round(elapsedSesionSegundos / 60) || 1),
    exercises: ejecucionEjercicios.map((ejercicio) => ({
      id_ejercicio: ejercicio.id_ejercicio,
      nombre: ejercicio.nombre,
      grupo_muscular: ejercicio.grupo_muscular,
      tipo_disciplina: ejercicio.tipo_disciplina,
      nota: limitExerciseNote(ejercicio.nota.trim()),
      descansoSegundos: ejercicio.descansoSegundos,
      series: ejercicio.series.map((serie) => ({
        kg: serie.kg,
        reps: serie.reps,
        km: serie.km,
        tiempoSegundos: serie.tiempoSegundos,
        tipo: serie.tipo,
      })),
    })),
  });

  const seedToExecution = (nextSeed: TrainingSeed) => {
    return nextSeed.exercises.map((exercise) => ({
      instanceId: crypto.randomUUID(),
      id_ejercicio: exercise.id_ejercicio,
      nombre: exercise.nombre,
      grupo_muscular: exercise.grupo_muscular,
      tipo_disciplina: exercise.tipo_disciplina,
      nota: limitExerciseNote(exercise.nota ?? ""),
      descansoSegundos: Math.max(0, exercise.descansoSegundos),
      series: exercise.series.map((serie, index) => ({
        id: crypto.randomUUID(),
        numero: index + 1,
        kg: serie.kg,
        reps: serie.reps,
        km: serie.km ?? "",
        tiempoSegundos: serie.tiempoSegundos ?? 0,
        timerActivo: false,
        tipo: serie.tipo,
        completada: false,
        registrada: false,
      })),
    }));
  };

  const comenzarEntrenamiento = async (nextSeed?: TrainingSeed) => {
    if (!canTrain) {
      setError("Las cuentas gimnasio no pueden iniciar entrenamientos");
      onSeedConsumed?.();
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMensaje("");
      setDescansoActivo(null);
      setElapsedSesionSegundos(0);
      setTotalTrofeosEntrenamiento(0);
      setGuardarNombre("");
      setGuardarDescripcion("");
      setGuardarCarpetaId("");

      const sourceRoutineId =
        nextSeed?.sourceRoutineId ?? (nextSeed?.origin === "rutina" ? nextSeed.sourceId : null);
      const startRes = await fetch(`${API}/entrenamientos/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: usuario.id,
          rutina_id: sourceRoutineId,
          descripcion: nextSeed?.title ?? null,
        }),
      });

      if (!startRes.ok) {
        throw new Error(await parseError(startRes, "No se pudo iniciar el entrenamiento"));
      }

      const sesion = (await startRes.json()) as SesionEntrenamiento;
      setSesionActiva(sesion);
      setSourceRoutineIdContext(sourceRoutineId);
      const nextEjecucion = nextSeed ? seedToExecution(nextSeed) : [];
      setEjecucionEjercicios(nextEjecucion);
      setSeriesAnterioresPorEjercicio({});
      setGuardarNombre(limitTitle(nextSeed?.title ?? ""));
      setGuardarDescripcion(limitDescription(nextSeed?.description ?? ""));
      setVista("ejecucion");
      setMensaje(
        nextSeed
          ? `Entrenamiento iniciado desde ${nextSeed.origin === "rutina" ? "rutina" : "sesion"}`
          : `Entrenamiento iniciado (Sesion #${sesion.id_sesion})`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error iniciando entrenamiento");
    } finally {
      setLoading(false);
    }
  };

  const agregarEjercicio = (ejercicio: Ejercicio) => {
    const instanceId = crypto.randomUUID();
    setPendingExerciseScrollId(instanceId);
    setEjecucionEjercicios((prev) => [
      ...prev,
      {
        instanceId,
        id_ejercicio: ejercicio.id_ejercicio,
        nombre: ejercicio.nombre,
        grupo_muscular: ejercicio.grupo_muscular,
        tipo_disciplina: ejercicio.tipo_disciplina,
        nota: "",
        descansoSegundos: 90,
        series: [crearSerieEjecucion()],
      },
    ]);
    void cargarSeriesAnterioresEjercicio(ejercicio.id_ejercicio);
  };

  const moveEjecucionExercise = (targetInstanceId: string) => {
    if (draggedExerciseInstanceId == null || draggedExerciseInstanceId === targetInstanceId) {
      return;
    }

    setEjecucionEjercicios((prev) => {
      const fromIndex = prev.findIndex((item) => item.instanceId === draggedExerciseInstanceId);
      const toIndex = prev.findIndex((item) => item.instanceId === targetInstanceId);
      if (fromIndex < 0 || toIndex < 0) {
        return prev;
      }

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const cargarSeriesAnterioresEjercicio = async (idEjercicio: number) => {
    if (seriesAnterioresPorEjercicio[idEjercicio]) {
      return;
    }

    try {
      const params = new URLSearchParams({
        usuario_id: String(usuario.id),
        ejercicio_id: String(idEjercicio),
      });
      const res = await fetch(`${API}/entrenamientos/series/anteriores?${params.toString()}`);
      if (!res.ok) {
        throw new Error(await parseError(res, "No se pudo cargar el historial del ejercicio"));
      }
      const data = (await res.json()) as Array<{
        orden: number;
        repeticiones: number;
        peso: number | null;
        distancia_km?: number | null;
        tiempo_segundos?: number | null;
        tipo_serie?: string | null;
      }>;
      setSeriesAnterioresPorEjercicio((prev) => ({
        ...prev,
        [idEjercicio]: data.map((serie) => ({
          orden: serie.orden,
          repeticiones: serie.repeticiones,
          peso: serie.peso,
          distancia_km: serie.distancia_km ?? null,
          tiempo_segundos: serie.tiempo_segundos ?? null,
          tipo_serie:
            serie.tipo_serie && isTrainingSetType(serie.tipo_serie) ? serie.tipo_serie : "serie",
        })),
      }));
    } catch (err) {
      setSeriesAnterioresPorEjercicio((prev) => ({ ...prev, [idEjercicio]: [] }));
      setError(err instanceof Error ? err.message : "No se pudo cargar el historial del ejercicio");
    }
  };

  const aplicarSerieAnterior = (
    instanceId: string,
    serieId: string,
    serieAnterior: SerieAnterior,
  ) => {
    setEjecucionEjercicios((prev) =>
      prev.map((ejercicio) =>
        ejercicio.instanceId === instanceId
          ? {
              ...ejercicio,
              series: ejercicio.series.map((serie) =>
                serie.id === serieId
                  ? {
                      ...serie,
                      kg: serieAnterior.peso == null ? serie.kg : String(serieAnterior.peso),
                      reps: String(serieAnterior.repeticiones),
                      km:
                        serieAnterior.distancia_km == null
                          ? serie.km
                          : String(serieAnterior.distancia_km),
                      tiempoSegundos: serieAnterior.tiempo_segundos ?? serie.tiempoSegundos,
                      tipo: serieAnterior.tipo_serie,
                    }
                  : serie,
              ),
            }
          : ejercicio,
      ),
    );
  };

  const quitarEjercicio = (instanceId: string) => {
    setEjecucionEjercicios((prev) => prev.filter((item) => item.instanceId !== instanceId));
  };

  const updateSerieEjecucion = (
    instanceId: string,
    serieId: string,
    field: "kg" | "reps" | "km" | "tipo",
    value: string,
  ) => {
    setEjecucionEjercicios((prev) =>
      prev.map((ejercicio) =>
        ejercicio.instanceId === instanceId
          ? {
              ...ejercicio,
              series: ejercicio.series.map((serie) => {
                if (serie.id !== serieId) {
                  return serie;
                }
                if (field === "tipo") {
                  return { ...serie, tipo: value as TrainingSetType };
                }
                return { ...serie, [field]: value };
              }),
            }
          : ejercicio,
      ),
    );
  };

  const updateSerieTiempo = (
    instanceId: string,
    serieId: string,
    field: "min" | "seg",
    value: string,
  ) => {
    setEjecucionEjercicios((prev) =>
      prev.map((ejercicio) =>
        ejercicio.instanceId === instanceId
          ? {
              ...ejercicio,
              series: ejercicio.series.map((serie) => {
                if (serie.id !== serieId) {
                  return serie;
                }
                const current = descansoToInputs(serie.tiempoSegundos);
                const minRaw = field === "min" ? value : current.min;
                const segRaw = field === "seg" ? value : current.sec;
                return {
                  ...serie,
                  tiempoSegundos: descansoDesdeInputs(minRaw, segRaw),
                };
              }),
            }
          : ejercicio,
      ),
    );
  };

  const toggleSerieTimer = (instanceId: string, serieId: string) => {
    setEjecucionEjercicios((prev) =>
      prev.map((ejercicio) =>
        ejercicio.instanceId === instanceId
          ? {
              ...ejercicio,
              series: ejercicio.series.map((serie) =>
                serie.id === serieId
                  ? { ...serie, timerActivo: !serie.timerActivo }
                  : serie,
              ),
            }
          : ejercicio,
      ),
    );
  };

  const updateDescansoEjecucion = (instanceId: string, seconds: number) => {
    setEjecucionEjercicios((prev) =>
      prev.map((ejercicio) => {
        if (ejercicio.instanceId !== instanceId) {
          return ejercicio;
        }
        return {
          ...ejercicio,
          descansoSegundos: seconds,
        };
      }),
    );
  };

  const updateNotaEjercicio = (instanceId: string, nota: string) => {
    setEjecucionEjercicios((prev) =>
      prev.map((ejercicio) =>
        ejercicio.instanceId === instanceId
          ? { ...ejercicio, nota: limitExerciseNote(nota) }
          : ejercicio,
      ),
    );
  };

  const agregarSerieEjecucion = (instanceId: string) => {
    setPendingExerciseScrollId(instanceId);
    setEjecucionEjercicios((prev) =>
      prev.map((ejercicio) => {
        if (ejercicio.instanceId !== instanceId) {
          return ejercicio;
        }
        const nextNumber = ejercicio.series.length + 1;
        const ultimaSerie = ejercicio.series[ejercicio.series.length - 1];
        const serieAnterior = seriesAnterioresPorEjercicio[ejercicio.id_ejercicio]?.[nextNumber - 1];
        return {
          ...ejercicio,
          series: [
            ...ejercicio.series,
            {
              id: crypto.randomUUID(),
              numero: nextNumber,
              kg: ultimaSerie?.kg ?? "",
              reps: ultimaSerie?.reps ?? "",
              km: ultimaSerie?.km ?? "",
              tiempoSegundos: 0,
              timerActivo: false,
              tipo: serieAnterior?.tipo_serie ?? ultimaSerie?.tipo ?? "serie",
              completada: false,
              registrada: false,
            },
          ],
        };
      }),
    );
  };

  useEffect(() => {
    if (vista !== "ejecucion") {
      return;
    }

    ejecucionEjercicios.forEach((ejercicio) => {
      if (!seriesAnterioresPorEjercicio[ejercicio.id_ejercicio]) {
        void cargarSeriesAnterioresEjercicio(ejercicio.id_ejercicio);
      }
    });
  }, [ejecucionEjercicios, seriesAnterioresPorEjercicio, vista]);

  useEffect(() => {
    setEjecucionEjercicios((prev) =>
      prev.map((ejercicio) => {
        const anteriores = seriesAnterioresPorEjercicio[ejercicio.id_ejercicio];
        if (!anteriores?.length) {
          return ejercicio;
        }

        let changed = false;
        const nextSeries = ejercicio.series.map((serie, index) => {
          const anterior = anteriores[index];
          if (!anterior || serie.completada || serie.registrada || serie.tipo === anterior.tipo_serie) {
            return serie;
          }
          changed = true;
          return { ...serie, tipo: anterior.tipo_serie };
        });

        return changed ? { ...ejercicio, series: nextSeries } : ejercicio;
      }),
    );
  }, [seriesAnterioresPorEjercicio]);

  const eliminarSerieEjecucion = (instanceId: string, serieId: string) => {
    setEjecucionEjercicios((prev) =>
      prev.map((ejercicio) => {
        if (ejercicio.instanceId !== instanceId || ejercicio.series.length <= 1) {
          return ejercicio;
        }
        const filtered = ejercicio.series.filter((serie) => serie.id !== serieId);
        return {
          ...ejercicio,
          series: filtered.map((serie, index) => ({ ...serie, numero: index + 1 })),
        };
      }),
    );
  };

  const toggleSerieCompletada = (instanceId: string, serieId: string) => {
    const ejercicio = ejecucionEjercicios.find((item) => item.instanceId === instanceId);
    const serie = ejercicio?.series.find((item) => item.id === serieId);
    if (!ejercicio || !serie) {
      return;
    }

    const nuevaCompletada = !serie.completada;

    setEjecucionEjercicios((prev) =>
      prev.map((item) =>
        item.instanceId === instanceId
          ? {
              ...item,
              series: item.series.map((set) =>
                set.id === serieId
                  ? { ...set, completada: nuevaCompletada, timerActivo: false }
                  : set,
              ),
            }
          : item,
      ),
    );

    if (nuevaCompletada && ejercicio.descansoSegundos > 0) {
      setDescansoActivo({
        restanteSegundos: ejercicio.descansoSegundos,
        etiqueta: `${ejercicio.nombre} · Serie ${serie.numero}`,
        finalizado: false,
      });
    }

    if (nuevaCompletada && sesionActiva && !serie.registrada) {
      void registrarSerie(ejercicio, serie, sesionActiva.id_sesion)
        .then(() => {
          setEjecucionEjercicios((prev) =>
            prev.map((item) =>
              item.instanceId === instanceId
                ? {
                    ...item,
                    series: item.series.map((set) =>
                      set.id === serieId ? { ...set, registrada: true } : set,
                    ),
                  }
                : item,
            ),
          );
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "No se pudo registrar la serie");
        });
    }
  };

  const completarEntrenamiento = async () => {
    if (!sesionActiva) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      await syncSeriesDeSesion(sesionActiva.id_sesion);

      const res = await fetch(`${API}/entrenamientos/${sesionActiva.id_sesion}/finalizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 404) {
        resetEntrenamiento();
        setMensaje("El entrenamiento ya no existe");
        return;
      }

      if (!res.ok) {
        throw new Error(await parseError(res, "No se pudo completar el entrenamiento"));
      }

      const data = (await res.json()) as { total_trofeos?: number };
      setTotalTrofeosEntrenamiento(data.total_trofeos ?? 0);
      setDescansoActivo(null);
      setVista("guardar");
      setMensaje("Entrenamiento completado");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error completando entrenamiento";
      if (message.toLowerCase().includes("sesión no encontrada") || message.toLowerCase().includes("sesion no encontrada")) {
        resetEntrenamiento();
        setMensaje("El entrenamiento ya no existe");
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const descartarEntrenamiento = async () => {
    if (!sesionActiva) {
      resetEntrenamiento();
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API}/entrenamientos/${sesionActiva.id_sesion}`, {
        method: "DELETE",
      });

      if (res.status === 404) {
        resetEntrenamiento();
        setMensaje("El entrenamiento ya no existe");
        return;
      }

      if (!res.ok) {
        throw new Error(await parseError(res, "No se pudo descartar el entrenamiento"));
      }

      resetEntrenamiento();
      setMensaje("Entrenamiento descartado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error descartando entrenamiento");
    } finally {
      setLoading(false);
    }
  };

  descartarEntrenamientoRef.current = descartarEntrenamiento;

  const requestDescartarEntrenamiento = () => {
    if (!sesionActiva) {
      resetEntrenamiento();
      return;
    }
    setConfirmDiscardOpen(true);
  };

  const volverAEjecucion = () => {
    setDescansoActivo(null);
    setVista("ejecucion");
  };

  const guardarEntrenamiento = async () => {
    if (!sesionActiva) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const nombre = limitTitle(guardarNombre.trim());
      const descripcion = limitDescription(guardarDescripcion.trim()) || null;

      const updateRes = await fetch(`${API}/entrenamientos/${sesionActiva.id_sesion}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre || null,
          descripcion,
        }),
      });

      if (updateRes.status === 404) {
        resetEntrenamiento();
        setMensaje("El entrenamiento ya no existe");
        return;
      }

      if (!updateRes.ok) {
        throw new Error(await parseError(updateRes, "No se pudo guardar el entrenamiento"));
      }

      if (guardarComoRutina) {
        const currentSeed = buildCurrentTrainingSeed();
        await saveTrainingSeedAsRoutine(currentSeed, usuario.id, {
          name: nombre || `Entrenamiento ${sesionActiva.id_sesion}`,
          description: descripcion,
          folderId: guardarCarpetaId ? Number(guardarCarpetaId) : null,
        });
      }

      resetEntrenamiento();
      setMensaje(
        guardarComoRutina
          ? "Entrenamiento guardado y rutina creada"
          : "Entrenamiento guardado",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando entrenamiento");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!seed || seedKey == null) {
      return;
    }

    if (!canTrain) {
      setError("Las cuentas gimnasio no pueden iniciar entrenamientos");
      onSeedConsumed?.();
      return;
    }

    void comenzarEntrenamiento(seed).finally(() => {
      onSeedConsumed?.();
    });
  }, [canTrain, seed, seedKey]);

  useEffect(() => {
    if (!sesionActiva || vista !== "ejecucion") {
      onActiveTrainingChange?.(null);
      return;
    }

    onActiveTrainingChange?.({
      sessionId: sesionActiva.id_sesion,
      title: limitTitle(guardarNombre.trim()) || "Entrenamiento libre",
      elapsedSeconds: elapsedSesionSegundos,
      completedSeries: seriesCompletadasEjecucion,
      totalSeries: totalSeriesEjecucion,
      nextExerciseName,
      rest: descansoActivo,
      loading,
    });
  }, [
    descansoActivo,
    elapsedSesionSegundos,
    guardarNombre,
    loading,
    nextExerciseName,
    onActiveTrainingChange,
    seriesCompletadasEjecucion,
    sesionActiva,
    totalSeriesEjecucion,
    vista,
  ]);

  useEffect(() => {
    if (
      discardRequestKey <= 0 ||
      handledDiscardRequestKey.current === discardRequestKey ||
      !sesionActiva ||
      vista !== "ejecucion"
    ) {
      return;
    }

    handledDiscardRequestKey.current = discardRequestKey;
    void descartarEntrenamientoRef.current?.();
  }, [discardRequestKey, sesionActiva, vista]);

  const renderDiscardModal = () => {
    if (!confirmDiscardOpen) {
      return null;
    }

    return (
      <div
        className="modal-backdrop"
        role="presentation"
        onClick={() => {
          if (!loading) {
            setConfirmDiscardOpen(false);
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
              onClick={() => setConfirmDiscardOpen(false)}
              disabled={loading}
            >
              ×
            </button>
          </div>
          <p className="helper-text">Se borrara por completo. ¿Quieres continuar?</p>
          <div className="modal-actions">
            <button
              type="button"
              className="btn secondary"
              onClick={() => setConfirmDiscardOpen(false)}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={() => void descartarEntrenamiento()}
              disabled={loading}
            >
              {loading ? "Descartando..." : "Descartar"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (vista === "guardar") {
    return (
      <main className="app">
        {renderToast()}
        <section className="hero editor-header">
          <span />
          <h1>Guardar entrenamiento</h1>
          <button type="button" className="btn" onClick={guardarEntrenamiento} disabled={loading}>
            Guardar
          </button>
        </section>

        {loading ? <p className="status">Guardando...</p> : null}

        <section className="panel two-cols">
          <article className="box">
            <h2>Resumen</h2>
            <p className="helper-text">
              Sesion #{sesionActiva?.id_sesion ?? "-"} · Tiempo total {formatDuration(elapsedSesionSegundos)}
            </p>
            <p className="helper-text">
              Series completas: {seriesCompletadasEjecucion}/{totalSeriesEjecucion}
            </p>
            <p className="helper-text">Ejercicios usados: {ejecucionEjercicios.length}</p>
            <div className="trophy-summary">
              <TrophyIcon />
              <strong>{totalTrofeosEntrenamiento}</strong>
            </div>
          </article>
          <article className="box">
            <h2>Que pasa al guardar</h2>
            <p className="helper-text">
              Se guarda esta sesion en tu historial y puedes elegir si tambien quieres convertirla
              en rutina.
            </p>
            <p className="helper-text">
              La carpeta solo se usa si decides guardar el entrenamiento como rutina.
            </p>
          </article>
        </section>

        <section className="panel">
          <article className="box">
            <div className="form-grid">
              <input
                className="field"
                placeholder="Nombre del entrenamiento"
                maxLength={TITLE_MAX_LENGTH}
                value={guardarNombre}
                onChange={(event) => setGuardarNombre(limitTitle(event.target.value))}
              />
              <input
                className="field"
                placeholder="Descripcion"
                maxLength={DESCRIPTION_MAX_LENGTH}
                value={guardarDescripcion}
                onChange={(event) => setGuardarDescripcion(limitDescription(event.target.value))}
              />
              <small className="field-counter">
                {guardarDescripcion.length}/{DESCRIPTION_MAX_LENGTH}
              </small>
              <select
                className="field"
                value={guardarCarpetaId}
                onChange={(event) => setGuardarCarpetaId(event.target.value)}
                disabled={!guardarComoRutina}
              >
                <option value="">Carpeta de rutina (opcional)</option>
                {carpetas.map((carpeta) => (
                  <option key={carpeta.id_carpeta} value={carpeta.id_carpeta}>
                    {carpeta.nombre}
                  </option>
                ))}
              </select>
              <label className="discover-check">
                <input
                  type="checkbox"
                  checked={guardarComoRutina}
                  onChange={(event) => setGuardarComoRutina(event.target.checked)}
                />
                Guardar tambien como rutina
              </label>
            </div>

            <div className="actions-row training-save-actions">
              <button
                type="button"
                className="btn danger training-discard-btn"
                onClick={requestDescartarEntrenamiento}
                disabled={loading}
              >
                Descartar entrenamiento
              </button>
              <div className="training-save-primary-actions">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={volverAEjecucion}
                  disabled={loading}
                >
                  Volver al entrenamiento
                </button>
                <button type="button" className="btn" onClick={guardarEntrenamiento} disabled={loading}>
                  Guardar
                </button>
              </div>
            </div>
          </article>
        </section>
        {renderDiscardModal()}
      </main>
    );
  }

  if (vista === "ejecucion") {
    return (
      <main className="app">
        {renderToast()}
        {descansoActivo ? (
          <section
            className={`rest-banner ${descansoActivo.finalizado ? "done" : ""}`}
            aria-live="polite"
          >
            <div className="rest-banner-main">
              <small className={descansoActivo.finalizado ? "rest-banner-mode finished" : "rest-banner-mode"}>
                {descansoActivo.finalizado ? (
                  <>
                    <span>Entrenamiento</span>
                    <span>{formatDuration(elapsedSesionSegundos)}</span>
                  </>
                ) : (
                  "Descanso activo"
                )}
              </small>
              <strong>{descansoActivo.etiqueta}</strong>
            </div>
            <div className="rest-banner-controls">
              <button type="button" className="btn secondary" onClick={() => ajustarDescansoActivo(-10)}>
                -10
              </button>
              <div className={descansoActivo.finalizado ? "rest-pill finished" : "rest-pill"}>
                {formatDuration(descansoActivo.restanteSegundos)}
              </div>
              <button type="button" className="btn secondary" onClick={() => ajustarDescansoActivo(10)}>
                +10
              </button>
              <button type="button" className="btn secondary" onClick={omitirDescansoActivo}>
                Omitir
              </button>
            </div>
          </section>
        ) : null}

        <section className="hero editor-header">
          <button
            type="button"
            className="btn secondary"
            onClick={requestDescartarEntrenamiento}
            disabled={loading}
          >
            Cancelar
          </button>
          <h1>Entrenamiento libre</h1>
          <button
            type="button"
            className="btn danger"
            onClick={completarEntrenamiento}
            disabled={loading}
          >
            Completar entrenamiento
          </button>
        </section>

        {loading ? <p className="status">Procesando...</p> : null}

        <section className="panel two-cols">
          <article className="box">
            <h2>Progreso</h2>
            <p className="helper-text">
              Series completas: {seriesCompletadasEjecucion}/{totalSeriesEjecucion}
            </p>
            <p className="helper-text">Tiempo entrenando: {formatDuration(elapsedSesionSegundos)}</p>
            {!descansoActivo ? <p className="helper-text">No hay descanso activo.</p> : null}
          </article>
          <article className="box">
            <h2>Sesion</h2>
            <p className="helper-text">
              ID de sesion: <strong>{sesionActiva?.id_sesion ?? "-"}</strong>
            </p>
            <p className="helper-text">Ejercicios en curso: {ejecucionEjercicios.length}</p>
          </article>
        </section>

        <section className="panel routine-editor-layout">
          <article className="box">
            <div className="editor-selected">
              {ejecucionEjercicios.length === 0 ? (
                <div className="empty-state">
                  <p>No hay ejercicios en este entrenamiento</p>
                  <img
                    src={siluetaStrongman}
                    alt=""
                    aria-hidden="true"
                    className="training-empty-figure"
                  />
                  <small>Agrega ejercicios desde la libreria de la derecha.</small>
                </div>
              ) : (
                ejecucionEjercicios.map((ejercicio) => {
                  const inputMode = getExerciseInputMode(ejercicio);

                  return (
                  <article
                    key={ejercicio.instanceId}
                    className={`exercise-card ${draggedExerciseInstanceId === ejercicio.instanceId ? "dragging" : ""}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      moveEjecucionExercise(ejercicio.instanceId);
                      setDraggedExerciseInstanceId(null);
                    }}
                    ref={(node) => {
                      if (node) {
                        exerciseRefs.current.set(ejercicio.instanceId, node);
                      } else {
                        exerciseRefs.current.delete(ejercicio.instanceId);
                      }
                    }}
                  >
                    <div className="exercise-card-head exercise-card-head-with-tools">
                      <button
                        type="button"
                        className="drag-handle"
                        draggable
                        onDragStart={(event) => {
                          setDraggedExerciseInstanceId(ejercicio.instanceId);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", ejercicio.instanceId);
                        }}
                        onDragEnd={() => setDraggedExerciseInstanceId(null)}
                        aria-label={`Reordenar ${ejercicio.nombre}`}
                        title="Arrastrar para reordenar"
                      >
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </button>
                      <div className="exercise-title-block">
                        <h3>{ejercicio.nombre}</h3>
                        <small>
                          {ejercicio.grupo_muscular} · {ejercicio.tipo_disciplina}
                        </small>
                      </div>
                      <div className="exercise-card-tools">
                        <div className="exercise-rest-control">
                          <span>Descanso</span>
                          <DurationInput
                            className="rest-time-input"
                            seconds={ejercicio.descansoSegundos}
                            onChangeSeconds={(seconds) => updateDescansoEjecucion(ejercicio.instanceId, seconds)}
                            ariaLabel={`Descanso de ${ejercicio.nombre}`}
                          />
                        </div>
                        <button
                          type="button"
                          className="exercise-remove-btn"
                          onClick={() => quitarEjercicio(ejercicio.instanceId)}
                          aria-label={`Quitar ${ejercicio.nombre}`}
                          title="Quitar ejercicio"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>

                    <div className="exercise-note-panel">
                      <label htmlFor={`exercise-note-${ejercicio.instanceId}`}>Nota</label>
                      <textarea
                        id={`exercise-note-${ejercicio.instanceId}`}
                        className="field exercise-note-textarea"
                        placeholder="Escribir nota"
                        maxLength={EXERCISE_NOTE_MAX_LENGTH}
                        value={ejercicio.nota}
                        onChange={(event) =>
                          updateNotaEjercicio(ejercicio.instanceId, event.target.value)
                        }
                      />
                    </div>

                    <div className={`set-table execution-mode ${inputMode}`}>
                      <div className="set-table-head">
                        <span>Set</span>
                        <span>Anterior</span>
                        {inputMode === "strength" ? <span>KG</span> : null}
                        {inputMode === "strength" || inputMode === "repsOnly" ? <span>Reps</span> : null}
                        {inputMode === "cardio" ? <span>KM</span> : null}
                        {inputMode === "cardio" || inputMode === "timed" ? <span>Tiempo</span> : null}
                        <span />
                        <span>OK</span>
                      </div>

                      {ejercicio.series.map((serie, index) => {
                        const numeroSerie = ejercicio.series
                          .slice(0, index + 1)
                          .filter((item) => item.tipo === "serie").length;
                        const serieAnterior =
                          seriesAnterioresPorEjercicio[ejercicio.id_ejercicio]?.[index] ?? null;
                        const serieAnteriorLabel = serieAnterior
                          ? formatSerieAnterior(serieAnterior, inputMode)
                          : "-";

                        return (
                          <div
                            key={serie.id}
                            className={`set-row ${serie.completada ? "completed" : ""}`}
                          >
                            <div className="set-type-wrap">
                              <select
                                className={`set-type-select ${serie.tipo}`}
                                value={serie.tipo}
                                onChange={(event) =>
                                  updateSerieEjecucion(
                                    ejercicio.instanceId,
                                    serie.id,
                                    "tipo",
                                    event.target.value,
                                  )
                                }
                              >
                                {SET_TIPO_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              {serie.tipo === "serie" ? (
                                <span className="set-order-badge">{numeroSerie}</span>
                              ) : null}
                            </div>
                            {serieAnterior && serieAnteriorLabel !== "-" ? (
                              <button
                                type="button"
                                className="previous-set-chip"
                                title="Autocompletar con la serie anterior"
                                onClick={() =>
                                  aplicarSerieAnterior(
                                    ejercicio.instanceId,
                                    serie.id,
                                    serieAnterior,
                                  )
                                }
                              >
                                {serieAnteriorLabel}
                              </button>
                            ) : (
                              <span className="previous-set-empty" aria-label="Sin serie anterior">
                                -
                              </span>
                            )}
                            {inputMode === "strength" ? (
                              <input
                                className="field compact"
                                type="number"
                                min="0"
                                placeholder="-"
                                value={serie.kg}
                                onChange={(event) =>
                                  updateSerieEjecucion(
                                    ejercicio.instanceId,
                                    serie.id,
                                    "kg",
                                    event.target.value,
                                  )
                                }
                              />
                            ) : null}
                            {inputMode === "strength" || inputMode === "repsOnly" ? (
                              <input
                                className="field compact"
                                type="number"
                                min="1"
                                placeholder="-"
                                value={serie.reps}
                                onChange={(event) =>
                                  updateSerieEjecucion(
                                    ejercicio.instanceId,
                                    serie.id,
                                    "reps",
                                    event.target.value,
                                  )
                                }
                              />
                            ) : null}
                            {inputMode === "cardio" ? (
                              <input
                                className="field compact"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="KM"
                                value={serie.km}
                                onChange={(event) =>
                                  updateSerieEjecucion(
                                    ejercicio.instanceId,
                                    serie.id,
                                    "km",
                                    event.target.value,
                                  )
                                }
                              />
                            ) : null}
                            {inputMode === "cardio" ? (
                              <div className="serie-time-inputs">
                                <input
                                  className="field compact"
                                  type="number"
                                  min="0"
                                  placeholder="Min"
                                  value={descansoToInputs(serie.tiempoSegundos).min}
                                  onChange={(event) =>
                                    updateSerieTiempo(
                                      ejercicio.instanceId,
                                      serie.id,
                                      "min",
                                      event.target.value,
                                    )
                                  }
                                />
                                <input
                                  className="field compact"
                                  type="number"
                                  min="0"
                                  max="59"
                                  placeholder="Seg"
                                  value={descansoToInputs(serie.tiempoSegundos).sec}
                                  onChange={(event) =>
                                    updateSerieTiempo(
                                      ejercicio.instanceId,
                                      serie.id,
                                      "seg",
                                      event.target.value,
                                    )
                                  }
                                />
                              </div>
                            ) : null}
                            {inputMode === "timed" ? (
                              <div className="serie-timer-control">
                                <span>{formatDuration(serie.tiempoSegundos)}</span>
                                <button
                                  type="button"
                                  className={`btn tiny ${serie.timerActivo ? "danger" : "secondary"}`}
                                  onClick={() => toggleSerieTimer(ejercicio.instanceId, serie.id)}
                                  disabled={serie.completada}
                                >
                                  {serie.timerActivo ? "Stop" : "Play"}
                                </button>
                              </div>
                            ) : null}
                            <button
                              type="button"
                              className="btn tiny secondary"
                              disabled={ejercicio.series.length <= 1}
                              onClick={() => eliminarSerieEjecucion(ejercicio.instanceId, serie.id)}
                            >
                              x
                            </button>
                            <button
                              type="button"
                              className={`btn tiny ${serie.completada ? "success" : "secondary"}`}
                              onClick={() => toggleSerieCompletada(ejercicio.instanceId, serie.id)}
                            >
                              ✓
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => agregarSerieEjecucion(ejercicio.instanceId)}
                    >
                      + Add serie
                    </button>
                  </article>
                  );
                })
              )}
            </div>
          </article>

          <aside className="box">
            <div className="library-panel-head">
              <h2>Agregar ejercicios</h2>
              <button
                type="button"
                className="btn tiny secondary"
                onClick={() => void cargarCatalogoEjercicios()}
                disabled={catalogoLoading}
              >
                {catalogoLoading ? "Cargando..." : "Recargar"}
              </button>
            </div>
            <div className="form-grid">
              <select
                className="field"
                value={filtroEquipo}
                onChange={(event) => setFiltroEquipo(event.target.value)}
                disabled={catalogoLoading}
              >
                <option value="">Todo equipamiento</option>
                {equipos.map((equipo) => (
                  <option key={equipo} value={equipo}>
                    {equipo}
                  </option>
                ))}
              </select>

              <select
                className="field"
                value={filtroMusculo}
                onChange={(event) => setFiltroMusculo(event.target.value)}
                disabled={catalogoLoading}
              >
                <option value="">Todos musculos</option>
                {musculos.map((musculo) => (
                  <option key={musculo} value={musculo}>
                    {musculo}
                  </option>
                ))}
              </select>

              <input
                className="field"
                placeholder="Buscar ejercicios"
                value={busquedaEjercicio}
                onChange={(event) => setBusquedaEjercicio(event.target.value)}
                disabled={catalogoLoading}
              />
            </div>

            <div className="library-list">
              {catalogoLoading ? <p className="helper-text">Cargando ejercicios...</p> : null}
              {!catalogoLoading && catalogoError ? (
                <p className="helper-text">{catalogoError}</p>
              ) : null}
              {!catalogoLoading && catalogoFiltrado.map((ejercicio) => {
                const yaAgregado = ejecucionEjercicios.some(
                  (item) => item.id_ejercicio === ejercicio.id_ejercicio,
                );

                return (
                  <div key={ejercicio.id_ejercicio} className="library-item">
                    <div>
                      <strong>{ejercicio.nombre}</strong>
                      <small>{ejercicio.grupo_muscular}</small>
                    </div>
                    <div className="library-actions">
                      {yaAgregado ? (
                        <button
                          type="button"
                          className="btn tiny secondary"
                          onClick={() => agregarEjercicio(ejercicio)}
                          aria-label={`Agregar otra vez ${ejercicio.nombre}`}
                        >
                          +
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn tiny"
                        disabled={yaAgregado}
                        onClick={() => agregarEjercicio(ejercicio)}
                      >
                        {yaAgregado ? "Agregado" : "+"}
                      </button>
                    </div>
                  </div>
                );
              })}
              {!catalogoLoading && !catalogoError && catalogoFiltrado.length === 0 ? (
                <p className="helper-text">No hay ejercicios para ese filtro.</p>
              ) : null}
            </div>
          </aside>
        </section>
        {renderDiscardModal()}
      </main>
    );
  }

  return (
    <main className="app">
      {renderToast()}
      <section className="hero">
        <h1>Entrenamiento</h1>
        <p className="subtitle">
          Arranca una sesion vacia, agrega ejercicios sobre la marcha y guardala despues si vale
          la pena repetirla.
        </p>
      </section>

      {loading ? <p className="status">Cargando datos...</p> : null}

      <section className="panel two-cols">
        <article className="box training-launch-card">
          <h2>Comenzar desde cero</h2>
          <p className="helper-text">
            Esto crea una sesion activa sin rutina base. Desde ahi puedes sumar o quitar ejercicios
            mientras entrenas.
          </p>

          <img
            src={bodybuilderFlexSample}
            alt=""
            aria-hidden="true"
            className="training-launch-figure"
          />

          <div className="actions-row">
            <button
              type="button"
              className="btn"
              onClick={() => void comenzarEntrenamiento()}
              disabled={loading}
            >
              Comenzar entrenamiento vacio
            </button>
          </div>
        </article>

        <article className="box">
          <h2>Como funciona</h2>
          <p className="helper-text">1. Empiezas una sesion con cronometro e ID propios.</p>
          <p className="helper-text">2. Agregas ejercicios igual que en el editor de rutinas.</p>
          <p className="helper-text">3. Ejecutas las series en la misma pantalla.</p>
          <p className="helper-text">
            4. Al completar, eliges nombre y descripcion, y opcionalmente la guardas como rutina.
          </p>
        </article>
      </section>
      {renderDiscardModal()}
    </main>
  );
}

export default Entrenamiento;
