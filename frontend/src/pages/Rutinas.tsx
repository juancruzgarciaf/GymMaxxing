import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import routineDetailEmptyBodybuilder from "../assets/routine-detail-empty-bodybuilder.png";
import {
  createRoutineShareUrl,
  matchPersistedByOrder as emparejarPersistidos,
  ROUTINE_LIBRARY_UPDATED_EVENT,
  type RoutineLibraryUpdatedDetail,
} from "../lib/trainingTransfer";
import { canUseTrainingFeatures } from "../lib/roles";
import { CUSTOM_EXERCISES_UPDATED_EVENT } from "../lib/customExercises";
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH, limitDescription, limitTitle } from "../lib/textLimits";
import type { GeminiGeneratedRoutineResponse, TrainingSeed, Usuario } from "../types";
import TrashIcon from "../components/TrashIcon";
import DurationInput from "../components/DurationInput";
import GeminiRoutinePanel from "../components/GeminiRoutinePanel";
import ExerciseMedia from "../components/ExerciseMedia";

type Rutina = {
  id_rutina: number;
  nombre: string;
  descripcion: string | null;
  duracion_estimada: number | null;
  creador_id: number;
  id_carpeta: number | null;
  visible_en_descubrir: boolean;
  save_count: number;
  copy_count: number;
};

type CarpetaRutina = {
  id_carpeta: number;
  nombre: string;
  id_carpeta_padre: number | null;
};

type Ejercicio = {
  id_ejercicio: number;
  nombre: string;
  descripcion: string;
  grupo_muscular: string;
  tipo_disciplina: string;
  es_personalizado?: boolean;
  creador_id?: number | null;
  imagen_url?: string | null;
};

type RutinaEjercicio = {
  id_rutina: number;
  id_ejercicio: number;
  series: number;
  repeticiones: number;
  descanso: number;
  orden: number;
  nombre: string;
  descripcion: string;
  grupo_muscular: string;
  tipo_disciplina: string;
  imagen_url?: string | null;
};

type SerieDraft = {
  id: string;
  kg: string;
  reps: string;
  tipo: SetTipo;
};

type SetTipo = "warmup" | "serie" | "dropset" | "failure";

type EjercicioDraft = {
  // Identificador local de cada aparición: una rutina puede tener el mismo ejercicio más de una vez.
  uid: string;
  id_ejercicio: number;
  nombre: string;
  grupo_muscular: string;
  tipo_disciplina: string;
  imagen_url?: string | null;
  nota: string;
  descansoMin: string;
  descansoSeg: string;
  series: SerieDraft[];
};

type ResumenSerie = {
  kg: string;
  reps: string;
  tipo: SetTipo;
};

type ResumenEjercicio = {
  nombre: string;
  grupo_muscular: string;
  tipo_disciplina: string;
  descansoSegundos: number;
  series: ResumenSerie[];
};

type EjecucionSerie = {
  id: string;
  numero: number;
  kg: string;
  reps: string;
  tipo: SetTipo;
  completada: boolean;
  registrada: boolean;
};

type EjecucionEjercicio = {
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
  rutina_id: number;
  descripcion: string | null;
};

type RutinasProps = {
  usuario: Usuario;
  canTrain?: boolean;
  onStartTraining?: (seed: TrainingSeed) => void;
  openGeminiPanelRequestKey?: number;
};

type VistaRutinas = "lista" | "editor" | "ejecucion";

type DescansoActivo = {
  restanteSegundos: number;
  etiqueta: string;
  finalizado: boolean;
};

type PersistedRutinaEjercicio = {
  id_ejercicio: number;
  nota?: string;
  descansoSegundos: number;
  series: Array<{
    kg: string;
    reps: string;
    tipo: SetTipo;
  }>;
};

const API = "http://localhost:3000";
const AUTH_STORAGE_KEY = "gymmaxxing_auth_v1";
const RUTINA_PREFS_KEY = "gymmaxxing_rutina_series_v1";
const EXERCISE_NOTE_MAX_LENGTH = 120;

const nuevaSerie = (reps = ""): SerieDraft => ({
  id: crypto.randomUUID(),
  kg: "",
  reps,
  tipo: "serie",
});

const nuevoUidEjercicio = () => crypto.randomUUID();

const getPersistedEjercicios = (idRutina: number): PersistedRutinaEjercicio[] => {
  const persisted = readRutinaPrefs()[String(idRutina)];
  return Array.isArray(persisted) ? persisted : [];
};

const esCardio = (tipoDisciplina?: string | null) =>
  (tipoDisciplina ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("cardio");

const SET_TIPO_TAG: Record<SetTipo, string> = {
  warmup: "W",
  serie: "",
  dropset: "D",
  failure: "F",
};

const formatResumenSerie = (serie: ResumenSerie) => {
  const kg = serie.kg.trim();
  const reps = serie.reps.trim();
  if (kg && reps) {
    return `${kg} kg × ${reps}`;
  }
  if (reps) {
    return `${reps} reps`;
  }
  if (kg) {
    return `${kg} kg`;
  }
  return "-";
};

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

const readRutinaPrefs = () => {
  try {
    const raw = localStorage.getItem(RUTINA_PREFS_KEY);
    if (!raw) {
      return {} as Record<string, PersistedRutinaEjercicio[]>;
    }
    return JSON.parse(raw) as Record<string, PersistedRutinaEjercicio[]>;
  } catch {
    return {} as Record<string, PersistedRutinaEjercicio[]>;
  }
};

const writeRutinaPrefs = (next: Record<string, PersistedRutinaEjercicio[]>) => {
  localStorage.setItem(RUTINA_PREFS_KEY, JSON.stringify(next));
};

const getStoredAuthToken = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { token?: string };
    return typeof parsed.token === "string" && parsed.token.trim() ? parsed.token : null;
  } catch {
    return null;
  }
};

// Todo lo que modifica una rutina exige token: el backend verifica que seas el creador.
const authHeaders = (): Record<string, string> => {
  const token = getStoredAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const authJsonHeaders = (): Record<string, string> => ({
  "Content-Type": "application/json",
  ...authHeaders(),
});

type RutinasRoute =
  | { kind: "lista" }
  | { kind: "nueva" }
  | { kind: "editar"; id: number }
  | { kind: "invalida" };

// /rutinas -> lista, /rutinas/nueva -> crear, /rutinas/:id/editar -> editar esa rutina.
// Devuelve null si la URL no es de esta pantalla (el componente queda montado aunque esté oculto).
const parseRutinasRoute = (pathname: string): RutinasRoute | null => {
  const path = pathname.replace(/\/+$/, "");
  if (path === "/rutinas") {
    return { kind: "lista" };
  }
  if (path === "/rutinas/nueva") {
    return { kind: "nueva" };
  }
  const match = path.match(/^\/rutinas\/(\d+)\/editar$/);
  if (match) {
    return { kind: "editar", id: Number(match[1]) };
  }
  if (path.startsWith("/rutinas/")) {
    return { kind: "invalida" };
  }
  return null;
};

const rutinaEditPath = (idRutina: number) => `/rutinas/${idRutina}/editar`;

// Destello de 4 puntas con degradé, el símbolo que usamos para Gemini.
const GeminiSparkIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="rutinas-gemini-spark" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#4285f4" />
        <stop offset="0.55" stopColor="#9b72cb" />
        <stop offset="1" stopColor="#d96570" />
      </linearGradient>
    </defs>
    <path
      fill="url(#rutinas-gemini-spark)"
      d="M12 2.5c.8 3.3 1.7 4.9 3 6.2s2.9 2.2 6.2 3c-3.3.8-4.9 1.7-6.2 3s-2.2 2.9-3 6.2c-.8-3.3-1.7-4.9-3-6.2s-2.9-2.2-6.2-3c3.3-.8 4.9-1.7 6.2-3s2.2-2.9 3-6.2Z"
    />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const FolderPlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.2h7.5A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
    <path d="M12 11v5.5M9.25 13.75h5.5" />
  </svg>
);

const DotsVerticalIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="12" cy="19" r="1.9" />
  </svg>
);

const DotsHorizontalIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
  </svg>
);

const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

const SET_TIPO_OPTIONS: Array<{ value: SetTipo; label: string }> = [
  { value: "warmup", label: "WarmUp" },
  { value: "serie", label: "Serie" },
  { value: "dropset", label: "DropSet" },
  { value: "failure", label: "Failure" },
];

function Rutinas({
  usuario,
  canTrain,
  onStartTraining,
  openGeminiPanelRequestKey = 0,
}: RutinasProps) {
  const canStartTraining = canTrain ?? canUseTrainingFeatures(usuario);
  const location = useLocation();
  const navigate = useNavigate();
  const rutinasRoute = parseRutinasRoute(location.pathname);
  const [vista, setVista] = useState<VistaRutinas>("lista");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const [rutinas, setRutinas] = useState<Rutina[]>([]);
  const [carpetas, setCarpetas] = useState<CarpetaRutina[]>([]);
  const [catalogoEjercicios, setCatalogoEjercicios] = useState<Ejercicio[]>([]);

  const [selectedRutinaId, setSelectedRutinaId] = useState<number | null>(null);
  const [expandedCarpetas, setExpandedCarpetas] = useState<Record<number, boolean>>({});
  const [openFolderMenuId, setOpenFolderMenuId] = useState<number | null>(null);
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);
  const [renameModal, setRenameModal] = useState<{
    open: boolean;
    id: number | null;
    value: string;
  }>({
    open: false,
    id: null,
    value: "",
  });
  const [createFolderModal, setCreateFolderModal] = useState({
    open: false,
    value: "",
  });
  const [shareModal, setShareModal] = useState({
    open: false,
    url: "",
  });
  const [pendingRoutineDelete, setPendingRoutineDelete] = useState<Rutina | null>(null);
  const [pendingFolderDelete, setPendingFolderDelete] = useState<CarpetaRutina | null>(null);
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [busquedaRutina, setBusquedaRutina] = useState("");
  const [resumenLoading, setResumenLoading] = useState(false);
  const [resumenEjercicios, setResumenEjercicios] = useState<ResumenEjercicio[]>([]);
  const [geminiPanelOpen, setGeminiPanelOpen] = useState(false);
  const [geminiGenerating, setGeminiGenerating] = useState(false);
  const [geminiLastRoutine, setGeminiLastRoutine] = useState<{
    nombre: string;
    aviso: string | null;
    detalleTecnico: string | null;
    descripcion: string | null;
    duracion_estimada: number | null;
    visible_en_descubrir: boolean;
    totalEjercicios: number;
    ejerciciosPreview: Array<{
      id_ejercicio: number;
      nombre: string;
      grupo_muscular: string | null;
      tipo_disciplina: string | null;
      imagen_url: string | null;
      series: number;
      repeticiones: number;
      descanso: number;
    }>;
  } | null>(null);
  const [geminiPanelError, setGeminiPanelError] = useState("");

  // Los menús (opciones de rutina y de carpeta) se cierran al clickear afuera o con Escape.
  useEffect(() => {
    if (!detailMenuOpen && openFolderMenuId == null) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest('[data-menu-root="detail"]')) {
        setDetailMenuOpen(false);
      }
      if (!target?.closest('[data-menu-root="folder"]')) {
        setOpenFolderMenuId(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailMenuOpen(false);
        setOpenFolderMenuId(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [detailMenuOpen, openFolderMenuId]);

  const abrirGeminiPanelLimpio = () => {
    setGeminiLastRoutine(null);
    setGeminiPanelError("");
    setGeminiPanelOpen(true);
  };

  const cerrarGeminiPanel = () => {
    setGeminiPanelOpen(false);
    setGeminiPanelError("");
    setGeminiLastRoutine(null);
  };

  useEffect(() => {
    if (openGeminiPanelRequestKey <= 0) {
      return;
    }

    abrirGeminiPanelLimpio();
  }, [openGeminiPanelRequestKey]);

  const [editorRutinaId, setEditorRutinaId] = useState<number | null>(null);
  const [editorNombre, setEditorNombre] = useState("");
  const [editorDescripcion, setEditorDescripcion] = useState("");
  const [editorDuracion, setEditorDuracion] = useState("");
  const [editorCarpetaId, setEditorCarpetaId] = useState<string>("");
  const [editorVisibleEnDescubrir, setEditorVisibleEnDescubrir] = useState(false);
  const [editorEjercicios, setEditorEjercicios] = useState<EjercicioDraft[]>([]);
  const [pendingEditorScrollId, setPendingEditorScrollId] = useState<string | null>(null);
  const [draggedEditorExerciseId, setDraggedEditorExerciseId] = useState<string | null>(null);
  const [resumenVersion, setResumenVersion] = useState(0);

  const [filtroEquipo, setFiltroEquipo] = useState("");
  const [filtroMusculo, setFiltroMusculo] = useState("");
  const [busquedaEjercicio, setBusquedaEjercicio] = useState("");

  const [rutinaEnEjecucion, setRutinaEnEjecucion] = useState<Rutina | null>(null);
  const [sesionActiva, setSesionActiva] = useState<SesionEntrenamiento | null>(null);
  const [ejecucionEjercicios, setEjecucionEjercicios] = useState<EjecucionEjercicio[]>([]);
  const [pendingExecutionScrollId, setPendingExecutionScrollId] = useState<number | null>(null);
  const [descansoActivo, setDescansoActivo] = useState<DescansoActivo | null>(null);
  const [elapsedSesionSegundos, setElapsedSesionSegundos] = useState(0);
  const editorExerciseRefs = useRef(new Map<string, HTMLElement>());
  const executionExerciseRefs = useRef(new Map<number, HTMLElement>());

  const rutinaSeleccionada =
    selectedRutinaId == null
      ? null
      : rutinas.find((rutina) => rutina.id_rutina === selectedRutinaId) ?? null;

  const scrollToExercise = <K,>(refs: { current: Map<K, HTMLElement> }, id: K) => {
    window.requestAnimationFrame(() => {
      refs.current.get(id)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };

  useEffect(() => {
    if (pendingEditorScrollId == null) {
      return;
    }

    scrollToExercise(editorExerciseRefs, pendingEditorScrollId);
    setPendingEditorScrollId(null);
  }, [editorEjercicios, pendingEditorScrollId]);

  useEffect(() => {
    if (pendingExecutionScrollId == null) {
      return;
    }

    scrollToExercise(executionExerciseRefs, pendingExecutionScrollId);
    setPendingExecutionScrollId(null);
  }, [ejecucionEjercicios, pendingExecutionScrollId]);

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

  const cargarRutinas = useCallback(async () => {
    const res = await fetch(`${API}/rutinas?creador_id=${usuario.id}`);
    if (!res.ok) {
      throw new Error(await parseError(res, "No se pudieron obtener las rutinas"));
    }

    const data = (await res.json()) as Rutina[];
    setRutinas(data);
    setSelectedRutinaId((prev) =>
      prev != null && !data.some((rutina) => rutina.id_rutina === prev) ? null : prev,
    );
  }, [usuario.id]);

  useEffect(() => {
    if (canStartTraining || vista !== "ejecucion") {
      return;
    }

    setSesionActiva(null);
    setRutinaEnEjecucion(null);
    setEjecucionEjercicios([]);
    setDescansoActivo(null);
    setVista("lista");
    setError("Las cuentas gimnasio no pueden iniciar rutinas");
  }, [canStartTraining, vista]);

  const cargarCarpetas = async () => {
    const res = await fetch(`${API}/rutinas/carpetas?usuario_id=${usuario.id}`);
    if (!res.ok) {
      setCarpetas([]);
      return;
    }

    const data = (await res.json()) as CarpetaRutina[];
    setCarpetas(data);
    setExpandedCarpetas((prev) => {
      const next = { ...prev };
      data.forEach((carpeta) => {
        if (next[carpeta.id_carpeta] == null) {
          next[carpeta.id_carpeta] = true;
        }
      });
      return next;
    });
  };

  const cargarCatalogoEjercicios = async () => {
    const token = getStoredAuthToken();
    const res = await fetch(`${API}/ejercicios`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      throw new Error(await parseError(res, "No se pudo obtener el catalogo de ejercicios"));
    }

    const data = (await res.json()) as Ejercicio[];
    setCatalogoEjercicios(data);
  };

  const cargarEjerciciosDeRutina = async (idRutina: number) => {
    const res = await fetch(`${API}/rutinas/${idRutina}/ejercicios`);
    if (!res.ok) {
      throw new Error(await parseError(res, "No se pudieron obtener los ejercicios de la rutina"));
    }

    return (await res.json()) as RutinaEjercicio[];
  };

  const savePersistedRutinaEjercicios = (
    idRutina: number,
    ejercicios: PersistedRutinaEjercicio[],
  ) => {
    const all = readRutinaPrefs();
    all[String(idRutina)] = ejercicios;
    writeRutinaPrefs(all);
  };

  const syncRutinaEjercicios = async (
    rutinaId: number,
    ejerciciosObjetivo: Array<{
      id_ejercicio: number;
      series: number;
      repeticiones: number;
      descanso: number;
      orden: number;
    }>,
  ) => {
    const ejerciciosActuales = await cargarEjerciciosDeRutina(rutinaId);
    const tieneRepetidos = (ids: number[]) => new Set(ids).size !== ids.length;

    // El backend actualiza/borra por (rutina, ejercicio). Si el mismo ejercicio aparece más de una
    // vez, eso pisaría todas sus apariciones, así que en ese caso reemplazamos la lista completa.
    if (
      tieneRepetidos(ejerciciosActuales.map((ejercicio) => ejercicio.id_ejercicio)) ||
      tieneRepetidos(ejerciciosObjetivo.map((ejercicio) => ejercicio.id_ejercicio))
    ) {
      for (const idEjercicio of new Set(ejerciciosActuales.map((ejercicio) => ejercicio.id_ejercicio))) {
        const deleteRes = await fetch(`${API}/rutinas/${rutinaId}/ejercicios/${idEjercicio}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
        if (!deleteRes.ok) {
          throw new Error(await parseError(deleteRes, "No se pudo eliminar ejercicio de rutina"));
        }
      }

      for (const ejercicio of ejerciciosObjetivo) {
        const addRes = await fetch(`${API}/rutinas/ejercicios`, {
          method: "POST",
          headers: authJsonHeaders(),
          body: JSON.stringify({
            id_rutina: rutinaId,
            id_ejercicio: ejercicio.id_ejercicio,
            series: ejercicio.series,
            repeticiones: ejercicio.repeticiones,
            descanso: ejercicio.descanso,
            orden: ejercicio.orden,
          }),
        });
        if (!addRes.ok) {
          throw new Error(await parseError(addRes, "No se pudo agregar ejercicio"));
        }
      }
      return;
    }

    const actualesPorEjercicio = new Map(
      ejerciciosActuales.map((ejercicio) => [ejercicio.id_ejercicio, ejercicio]),
    );
    const nuevosIds = new Set(ejerciciosObjetivo.map((ejercicio) => ejercicio.id_ejercicio));

    for (const ejercicioActual of ejerciciosActuales) {
      if (!nuevosIds.has(ejercicioActual.id_ejercicio)) {
        const deleteRes = await fetch(
          `${API}/rutinas/${rutinaId}/ejercicios/${ejercicioActual.id_ejercicio}`,
          { method: "DELETE", headers: authHeaders() },
        );
        if (!deleteRes.ok) {
          throw new Error(await parseError(deleteRes, "No se pudo eliminar ejercicio de rutina"));
        }
      }
    }

    for (const ejercicio of ejerciciosObjetivo) {
      const payload = {
        series: ejercicio.series,
        repeticiones: ejercicio.repeticiones,
        descanso: ejercicio.descanso,
        orden: ejercicio.orden,
      };

      const existing = actualesPorEjercicio.get(ejercicio.id_ejercicio);
      if (existing) {
        const updateRes = await fetch(
          `${API}/rutinas/${rutinaId}/ejercicios/${ejercicio.id_ejercicio}`,
          {
            method: "PUT",
            headers: authJsonHeaders(),
            body: JSON.stringify(payload),
          },
        );
        if (!updateRes.ok) {
          throw new Error(await parseError(updateRes, "No se pudo actualizar ejercicio"));
        }
      } else {
        const addRes = await fetch(`${API}/rutinas/ejercicios`, {
          method: "POST",
          headers: authJsonHeaders(),
          body: JSON.stringify({
            id_rutina: rutinaId,
            id_ejercicio: ejercicio.id_ejercicio,
            ...payload,
          }),
        });
        if (!addRes.ok) {
          throw new Error(await parseError(addRes, "No se pudo agregar ejercicio"));
        }
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setError("");
        setMensaje("");
        await Promise.all([cargarRutinas(), cargarCatalogoEjercicios(), cargarCarpetas()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando datos iniciales");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [cargarRutinas, usuario.id]);

  useEffect(() => {
    const handleCustomExercisesUpdated = () => {
      void cargarCatalogoEjercicios();
    };

    window.addEventListener(CUSTOM_EXERCISES_UPDATED_EVENT, handleCustomExercisesUpdated);
    return () => window.removeEventListener(CUSTOM_EXERCISES_UPDATED_EVENT, handleCustomExercisesUpdated);
  }, [usuario.id]);
  useEffect(() => {
    const handleRoutineLibraryUpdated = (event: Event) => {
      const detail = (event as CustomEvent<RoutineLibraryUpdatedDetail>).detail;
      if (detail.userId !== usuario.id) {
        return;
      }

      void cargarRutinas().catch((err) => {
        setError(err instanceof Error ? err.message : "No se pudieron actualizar las rutinas");
      });
    };

    window.addEventListener(ROUTINE_LIBRARY_UPDATED_EVENT, handleRoutineLibraryUpdated);
    return () => {
      window.removeEventListener(ROUTINE_LIBRARY_UPDATED_EVENT, handleRoutineLibraryUpdated);
    };
  }, [cargarRutinas, usuario.id]);

  useEffect(() => {
    if (selectedRutinaId == null) {
      setResumenEjercicios([]);
      setResumenLoading(false);
      return;
    }

    const loadResumen = async () => {
      try {
        setResumenLoading(true);
        const ejercicios = await cargarEjerciciosDeRutina(selectedRutinaId);
        const persistidos = emparejarPersistidos(ejercicios, getPersistedEjercicios(selectedRutinaId));
        setResumenEjercicios(
          ejercicios.map((item, index) => {
            const persisted = persistidos[index];
            const persistedSeries = persisted?.series ?? [];
            const cantidadSeries = Math.max(1, item.series || persistedSeries.length || 1);
            return {
              nombre: item.nombre,
              grupo_muscular: item.grupo_muscular,
              tipo_disciplina: item.tipo_disciplina ?? "",
              descansoSegundos: Math.max(0, persisted?.descansoSegundos ?? item.descanso ?? 0),
              series: Array.from({ length: cantidadSeries }, (_, serieIndex) => ({
                kg: persistedSeries[serieIndex]?.kg ?? "",
                reps:
                  persistedSeries[serieIndex]?.reps ??
                  (item.repeticiones ? String(item.repeticiones) : ""),
                tipo: persistedSeries[serieIndex]?.tipo ?? "serie",
              })),
            };
          }),
        );
      } catch {
        setResumenEjercicios([]);
      } finally {
        setResumenLoading(false);
      }
    };

    void loadResumen();
  }, [selectedRutinaId, resumenVersion]);

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
  }, [vista, sesionActiva]);

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

  const resetEditorNuevaRutina = () => {
    setError("");
    setMensaje("");
    setEditorRutinaId(null);
    setEditorNombre("");
    setEditorDescripcion("");
    setEditorDuracion("");
    setEditorCarpetaId("");
    setEditorVisibleEnDescubrir(true);
    setEditorEjercicios([]);
    setDraggedEditorExerciseId(null);
    setFiltroEquipo("");
    setFiltroMusculo("");
    setBusquedaEjercicio("");
    setVista("editor");
  };

  const abrirEditorRutinaGemini = () => {
    if (!geminiLastRoutine) {
      return;
    }

    setError("");
    setMensaje("");
    setEditorRutinaId(null);
    setEditorNombre(limitTitle(geminiLastRoutine.nombre));
    setEditorDescripcion(limitDescription(geminiLastRoutine.descripcion ?? ""));
    setEditorDuracion(
      geminiLastRoutine.duracion_estimada != null
        ? String(geminiLastRoutine.duracion_estimada)
        : "",
    );
    setEditorCarpetaId("");
    setEditorVisibleEnDescubrir(geminiLastRoutine.visible_en_descubrir);
    setEditorEjercicios(
      geminiLastRoutine.ejerciciosPreview.map((exercise) => {
        const descanso = descansoToInputs(exercise.descanso ?? 90);
        return {
          uid: nuevoUidEjercicio(),
          id_ejercicio: exercise.id_ejercicio,
          nombre: exercise.nombre,
          grupo_muscular: exercise.grupo_muscular ?? "",
          tipo_disciplina: exercise.tipo_disciplina ?? "",
          // La foto viene del catálogo real; si el backend no la trajo, la buscamos en la lista ya cargada.
          imagen_url:
            exercise.imagen_url ??
            catalogoEjercicios.find((item) => item.id_ejercicio === exercise.id_ejercicio)
              ?.imagen_url ??
            null,
          nota: "",
          descansoMin: descanso.min,
          descansoSeg: descanso.sec,
          series: Array.from({ length: Math.max(1, exercise.series) }, () =>
            nuevaSerie(String(Math.max(1, exercise.repeticiones || 10))),
          ),
        };
      }),
    );
    setDraggedEditorExerciseId(null);
    setFiltroEquipo("");
    setFiltroMusculo("");
    setBusquedaEjercicio("");
    setGeminiPanelOpen(false);
    setGeminiPanelError("");
    setGeminiLastRoutine(null);
    setVista("editor");
    navigate("/rutinas/nueva");
  };

  const abrirEditorNuevaRutina = () => {
    resetEditorNuevaRutina();
    navigate("/rutinas/nueva");
  };

  // Cambia la URL a /rutinas/:id/editar; el efecto de abajo carga la rutina (y chequea permisos).
  const abrirEditorRutina = (rutina: Rutina) => {
    setError("");
    setMensaje("");
    navigate(rutinaEditPath(rutina.id_rutina));
  };

  // Volver del editor: si venimos de la lista, volvemos en el historial; si se entró por URL directa,
  // reemplazamos por /rutinas para no dejar el editor en el historial.
  const salirDelEditor = () => {
    const historyIndex = (window.history.state as { idx?: unknown } | null)?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      navigate(-1);
      return;
    }
    navigate("/rutinas", { replace: true });
  };

  const cargarEditorDesdeRutina = (rutina: Rutina, ejercicios: RutinaEjercicio[]) => {
    const persistidos = emparejarPersistidos(ejercicios, getPersistedEjercicios(rutina.id_rutina));
    const draft = ejercicios.map((item, ejercicioIndex): EjercicioDraft => {
      const persisted = persistidos[ejercicioIndex];
      const descanso = descansoToInputs(persisted?.descansoSegundos ?? item.descanso ?? 0);
      const persistedSeries = persisted?.series ?? [];
      return {
        uid: nuevoUidEjercicio(),
        id_ejercicio: item.id_ejercicio,
        nombre: item.nombre,
        grupo_muscular: item.grupo_muscular,
        tipo_disciplina: item.tipo_disciplina,
        imagen_url: item.imagen_url ?? null,
        nota: limitExerciseNote(persisted?.nota ?? ""),
        descansoMin: descanso.min,
        descansoSeg: descanso.sec,
        series: Array.from({ length: Math.max(1, item.series) }, (_, index) => {
          const serie = nuevaSerie(String(item.repeticiones || ""));
          const persistedSerie = persistedSeries[index];
          return persistedSerie
            ? {
                ...serie,
                kg: persistedSerie.kg ?? "",
                reps: persistedSerie.reps ?? serie.reps,
                tipo: persistedSerie.tipo ?? "serie",
              }
            : serie;
        }),
      };
    });

    setEditorRutinaId(rutina.id_rutina);
    setEditorNombre(limitTitle(rutina.nombre));
    setEditorDescripcion(limitDescription(rutina.descripcion ?? ""));
    setEditorDuracion(rutina.duracion_estimada ? String(rutina.duracion_estimada) : "");
    setEditorCarpetaId(rutina.id_carpeta ? String(rutina.id_carpeta) : "");
    setEditorVisibleEnDescubrir(Boolean(rutina.visible_en_descubrir));
    setEditorEjercicios(draft);
    setDraggedEditorExerciseId(null);
    setFiltroEquipo("");
    setFiltroMusculo("");
    setBusquedaEjercicio("");
    setSelectedRutinaId(rutina.id_rutina);
    setVista("editor");
  };

  // La URL manda: sincroniza la vista con /rutinas, /rutinas/nueva y /rutinas/:id/editar.
  const routeKind = rutinasRoute?.kind ?? null;
  const routeEditId = rutinasRoute?.kind === "editar" ? rutinasRoute.id : null;

  useEffect(() => {
    if (routeKind === "lista") {
      if (vista === "editor") {
        setVista("lista");
      }
      return;
    }

    if (routeKind === "invalida") {
      navigate("/rutinas", { replace: true });
      return;
    }

    if (routeKind === "nueva") {
      // Si ya hay un borrador de rutina nueva abierto (por ejemplo el de Gemini), no lo pisamos.
      if (vista !== "editor" || editorRutinaId != null) {
        resetEditorNuevaRutina();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKind]);

  useEffect(() => {
    if (routeEditId == null) {
      return;
    }

    // Ya estamos editando esa rutina (por ejemplo volvimos con "adelante" del navegador).
    if (vista === "editor" && editorRutinaId === routeEditId) {
      return;
    }

    let cancelled = false;

    const cargar = async () => {
      try {
        setLoading(true);
        setError("");

        // El backend solo responde si el usuario logueado es el creador de la rutina.
        const res = await fetch(`${API}/rutinas/${routeEditId}/editar`, {
          headers: authHeaders(),
        });

        if (!res.ok) {
          const fallback =
            res.status === 403
              ? "No tenés permiso para editar esta rutina"
              : res.status === 404
                ? "La rutina no existe"
                : res.status === 401
                  ? "Tu sesión expiró, volvé a iniciar sesión"
                  : "No se pudo abrir la rutina";
          throw new Error(res.status === 403 || res.status === 404 ? fallback : await parseError(res, fallback));
        }

        const data = (await res.json()) as { rutina: Rutina; ejercicios: RutinaEjercicio[] };

        // Doble chequeo en el front por las dudas.
        if (Number(data.rutina.creador_id) !== Number(usuario.id)) {
          throw new Error("No tenés permiso para editar esta rutina");
        }

        if (!cancelled) {
          cargarEditorDesdeRutina(data.rutina, data.ejercicios);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo abrir la rutina");
          setVista("lista");
          navigate("/rutinas", { replace: true });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void cargar();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeEditId, usuario.id]);

  const handleCrearCarpeta = async () => {
    const nombre = createFolderModal.value.trim();
    if (!nombre) {
      setError("El nombre de la carpeta es obligatorio");
      return;
    }

    try {
      setError("");
      setMensaje("");
      const res = await fetch(`${API}/rutinas/carpetas`, {
        method: "POST",
        headers: authJsonHeaders(),
        body: JSON.stringify({
          nombre,
          usuario_id: usuario.id,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseError(res, "No se pudo crear la carpeta"));
      }

      await cargarCarpetas();
      setCreateFolderModal({ open: false, value: "" });
      setMensaje("Carpeta creada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando carpeta");
    }
  };

  const handleEliminarRutina = async (rutina: Rutina | null) => {
    if (!rutina) {
      return;
    }

    try {
      setError("");
      setMensaje("");
      const res = await fetch(`${API}/rutinas/${rutina.id_rutina}`, {
        method: "DELETE",
        headers: authJsonHeaders(),
        body: JSON.stringify({
          creador_id: usuario.id,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseError(res, "No se pudo eliminar la rutina"));
      }

      await cargarRutinas();
      setSelectedRutinaId(null);
      setPendingRoutineDelete(null);
      setMensaje("Rutina eliminada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando rutina");
    }
  };

  const compartirRutina = async () => {
    if (!rutinaSeleccionada) {
      return;
    }

    const url = createRoutineShareUrl(rutinaSeleccionada.id_rutina);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setMensaje("Link de rutina copiado");
        return;
      }
    } catch {
      // fallback abajo
    }

    setShareModal({ open: true, url });
  };

  const abrirModalRenombrarCarpeta = (carpeta: CarpetaRutina) => {
    setOpenFolderMenuId(null);
    setRenameModal({
      open: true,
      id: carpeta.id_carpeta,
      value: carpeta.nombre,
    });
  };

  const cerrarModalRenombrarCarpeta = () => {
    setRenameModal({
      open: false,
      id: null,
      value: "",
    });
  };

  const renombrarCarpeta = async () => {
    if (!renameModal.id || !renameModal.value.trim()) {
      return;
    }

    try {
      setError("");
      setMensaje("");
      const res = await fetch(`${API}/rutinas/carpetas/${renameModal.id}`, {
        method: "PUT",
        headers: authJsonHeaders(),
        body: JSON.stringify({
          nombre: renameModal.value.trim(),
          usuario_id: usuario.id,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseError(res, "No se pudo renombrar carpeta"));
      }

      await cargarCarpetas();
      cerrarModalRenombrarCarpeta();
      setMensaje("Carpeta renombrada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error renombrando carpeta");
    }
  };

  const duplicarCarpeta = async (carpeta: CarpetaRutina) => {
    try {
      setOpenFolderMenuId(null);
      setError("");
      setMensaje("");
      const res = await fetch(`${API}/rutinas/carpetas`, {
        method: "POST",
        headers: authJsonHeaders(),
        body: JSON.stringify({
          nombre: `${carpeta.nombre} (copia)`,
          usuario_id: usuario.id,
          id_carpeta_padre: carpeta.id_carpeta_padre,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseError(res, "No se pudo duplicar carpeta"));
      }

      await cargarCarpetas();
      setMensaje("Carpeta duplicada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error duplicando carpeta");
    }
  };

  const eliminarCarpeta = async (carpeta: CarpetaRutina) => {
    try {
      setOpenFolderMenuId(null);
      setError("");
      setMensaje("");
      const res = await fetch(`${API}/rutinas/carpetas/${carpeta.id_carpeta}`, {
        method: "DELETE",
        headers: authJsonHeaders(),
        body: JSON.stringify({
          usuario_id: usuario.id,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseError(res, "No se pudo eliminar carpeta"));
      }

      await Promise.all([cargarCarpetas(), cargarRutinas()]);
      setPendingFolderDelete(null);
      setMensaje("Carpeta eliminada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando carpeta");
    }
  };

  const agregarEjercicioAlEditor = (ejercicio: Ejercicio) => {
    const existente = editorEjercicios.find((item) => item.id_ejercicio === ejercicio.id_ejercicio);
    if (existente) {
      setPendingEditorScrollId(existente.uid);
      return;
    }

    const uid = nuevoUidEjercicio();
    setPendingEditorScrollId(uid);
    setEditorEjercicios((prev) => {
      return [
        ...prev,
        {
          uid,
          id_ejercicio: ejercicio.id_ejercicio,
          nombre: ejercicio.nombre,
          grupo_muscular: ejercicio.grupo_muscular,
          tipo_disciplina: ejercicio.tipo_disciplina,
          imagen_url: ejercicio.imagen_url ?? null,
          nota: "",
          descansoMin: "1",
          descansoSeg: "30",
          series: [nuevaSerie()],
        },
      ];
    });
  };

  const removerEjercicioDelEditor = (uid: string) => {
    setEditorEjercicios((prev) => prev.filter((item) => item.uid !== uid));
  };

  const updateNotaEditor = (uid: string, nota: string) => {
    setEditorEjercicios((prev) =>
      prev.map((item) =>
        item.uid === uid
          ? { ...item, nota: limitExerciseNote(nota) }
          : item,
      ),
    );
  };

  const moveEditorExercise = (targetUid: string) => {
    if (draggedEditorExerciseId == null || draggedEditorExerciseId === targetUid) {
      return;
    }

    setEditorEjercicios((prev) => {
      const fromIndex = prev.findIndex((item) => item.uid === draggedEditorExerciseId);
      const toIndex = prev.findIndex((item) => item.uid === targetUid);
      if (fromIndex < 0 || toIndex < 0) {
        return prev;
      }

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const agregarSerieAEjercicio = (uid: string) => {
    setPendingEditorScrollId(uid);
    setEditorEjercicios((prev) =>
      prev.map((item) => {
        if (item.uid !== uid) {
          return item;
        }

        const ultimaSerie = item.series[item.series.length - 1];
        const nueva = nuevaSerie();
        const clonada = ultimaSerie
          ? {
              ...nueva,
              kg: ultimaSerie.kg,
              reps: ultimaSerie.reps,
              tipo: ultimaSerie.tipo,
            }
          : nueva;

        return { ...item, series: [...item.series, clonada] };
      }),
    );
  };

  const borrarSerieDeEjercicio = (uid: string, serieId: string) => {
    setEditorEjercicios((prev) =>
      prev.map((item) => {
        if (item.uid !== uid) {
          return item;
        }

        if (item.series.length <= 1) {
          return item;
        }

        return {
          ...item,
          series: item.series.filter((serie) => serie.id !== serieId),
        };
      }),
    );
  };

  const updateSerieEditor = (
    uid: string,
    serieId: string,
    field: "kg" | "reps" | "tipo",
    value: string,
  ) => {
    setEditorEjercicios((prev) =>
      prev.map((item) => {
        if (item.uid !== uid) {
          return item;
        }

        return {
          ...item,
          series: item.series.map((serie) => {
            if (serie.id !== serieId) {
              return serie;
            }

            if (field === "tipo") {
              return {
                ...serie,
                tipo: value as SetTipo,
              };
            }
            return { ...serie, [field]: value };
          }),
        };
      }),
    );
  };

  const updateDescansoEditor = (uid: string, seconds: number) => {
    const next = descansoToInputs(seconds);
    setEditorEjercicios((prev) =>
      prev.map((item) =>
        item.uid === uid
          ? { ...item, descansoMin: next.min, descansoSeg: next.sec }
          : item,
      ),
    );
  };

  const guardarRutina = async () => {
    if (!editorNombre.trim()) {
      setError("El nombre de la rutina es obligatorio");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMensaje("");

      const body = {
        nombre: limitTitle(editorNombre.trim()),
        descripcion: limitDescription(editorDescripcion.trim()) || null,
        duracion_estimada: editorDuracion ? Number(editorDuracion) : null,
        creador_id: usuario.id,
        id_carpeta: editorCarpetaId ? Number(editorCarpetaId) : null,
        visible_en_descubrir: editorVisibleEnDescubrir,
      };

      let rutinaId = editorRutinaId;

      if (rutinaId == null) {
        const createRes = await fetch(`${API}/rutinas`, {
          method: "POST",
          headers: authJsonHeaders(),
          body: JSON.stringify(body),
        });
        if (!createRes.ok) {
          throw new Error(await parseError(createRes, "No se pudo crear la rutina"));
        }
        const nueva = (await createRes.json()) as Rutina;
        rutinaId = nueva.id_rutina;
      } else {
        const updateRes = await fetch(`${API}/rutinas/${rutinaId}`, {
          method: "PUT",
          headers: authJsonHeaders(),
          body: JSON.stringify(body),
        });
        if (!updateRes.ok) {
          throw new Error(await parseError(updateRes, "No se pudo actualizar la rutina"));
        }
      }

      const ejerciciosObjetivo = editorEjercicios.map((ejercicio, index) => {
        const repeticiones = Number(
          ejercicio.series.find((serie) => serie.reps.trim())?.reps ?? "10",
        );
        return {
          id_ejercicio: ejercicio.id_ejercicio,
          series: Math.max(1, ejercicio.series.length),
          repeticiones: Number.isNaN(repeticiones) ? 10 : Math.max(1, repeticiones),
          descanso: descansoDesdeInputs(ejercicio.descansoMin, ejercicio.descansoSeg),
          orden: index + 1,
        };
      });

      await syncRutinaEjercicios(rutinaId, ejerciciosObjetivo);
      savePersistedRutinaEjercicios(
        rutinaId,
        editorEjercicios.map((ejercicio) => ({
          id_ejercicio: ejercicio.id_ejercicio,
          nota: limitExerciseNote(ejercicio.nota.trim()),
          descansoSegundos: descansoDesdeInputs(ejercicio.descansoMin, ejercicio.descansoSeg),
          series: ejercicio.series.map((serie) => ({
            kg: serie.kg,
            reps: serie.reps,
            tipo: serie.tipo,
          })),
        })),
      );

      await Promise.all([cargarRutinas(), cargarCarpetas()]);
      setSelectedRutinaId(rutinaId);
      setResumenVersion((prev) => prev + 1);
      setVista("lista");
      salirDelEditor();
      setMensaje("Rutina guardada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando rutina");
    } finally {
      setLoading(false);
    }
  };

  const registrarSerie = async (
    ejercicio: EjecucionEjercicio,
    serie: EjecucionSerie,
    sesionId: number,
  ) => {
    const reps = Number(serie.reps || "0");
    const kg = Number(serie.kg || "0");
    const payload = {
      repeticiones: Number.isNaN(reps) ? 1 : Math.max(1, reps),
      peso: Number.isNaN(kg) || !serie.kg.trim() ? null : Math.max(0, kg),
      descanso: ejercicio.descansoSegundos,
      orden: serie.numero,
      ejercicio_id: ejercicio.id_ejercicio,
      sesion_id: sesionId,
      nota_ejercicio: limitExerciseNote(ejercicio.nota.trim()) || null,
    };

    const res = await fetch(`${API}/entrenamientos/serie`, {
      method: "POST",
      headers: authJsonHeaders(),
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
          const reps = Number(serie.reps || "0");
          const kg = Number(serie.kg || "0");
          return {
            repeticiones: Number.isNaN(reps) ? 1 : Math.max(1, reps),
            peso: Number.isNaN(kg) || !serie.kg.trim() ? null : Math.max(0, kg),
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
      headers: authJsonHeaders(),
      body: JSON.stringify({ series }),
    });

    if (!res.ok) {
      throw new Error(await parseError(res, "No se pudieron sincronizar las series"));
    }
  };

  const iniciarRutina = async () => {
    if (!rutinaSeleccionada) {
      return;
    }

    if (!canStartTraining) {
      setError("Las cuentas gimnasio no pueden iniciar entrenamientos");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMensaje("");

      const ejercicios = await cargarEjerciciosDeRutina(rutinaSeleccionada.id_rutina);
      const persistidos = emparejarPersistidos(
        ejercicios,
        getPersistedEjercicios(rutinaSeleccionada.id_rutina),
      );
      const seed: TrainingSeed = {
        origin: "rutina",
        sourceId: rutinaSeleccionada.id_rutina,
        sourceRoutineId: rutinaSeleccionada.id_rutina,
        title: rutinaSeleccionada.nombre,
        description: rutinaSeleccionada.descripcion,
        durationMinutes: rutinaSeleccionada.duracion_estimada,
        exercises: ejercicios.map((item, ejercicioIndex) => {
          const persisted = persistidos[ejercicioIndex];
          const persistedSeries = persisted?.series ?? [];
          return {
            id_ejercicio: item.id_ejercicio,
            nombre: item.nombre,
            grupo_muscular: item.grupo_muscular,
            tipo_disciplina: item.tipo_disciplina,
            imagen_url: item.imagen_url ?? null,
            nota: limitExerciseNote(persisted?.nota ?? ""),
            descansoSegundos: Math.max(0, persisted?.descansoSegundos ?? item.descanso ?? 0),
            series: Array.from({ length: Math.max(1, item.series) }, (_, index) => ({
              kg: persistedSeries[index]?.kg ?? "",
              reps: persistedSeries[index]?.reps ?? String(item.repeticiones || ""),
              tipo: persistedSeries[index]?.tipo ?? "serie",
            })),
          };
        }),
      };

      onStartTraining?.(seed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error iniciando rutina");
    } finally {
      setLoading(false);
    }
  };

  const updateSerieEjecucion = (
    idEjercicio: number,
    serieId: string,
    field: "kg" | "reps" | "tipo",
    value: string,
  ) => {
    setEjecucionEjercicios((prev) =>
      prev.map((ejercicio) =>
        ejercicio.id_ejercicio === idEjercicio
          ? {
              ...ejercicio,
              series: ejercicio.series.map((serie) => {
                if (serie.id !== serieId) {
                  return serie;
                }
                if (field === "tipo") {
                  return { ...serie, tipo: value as SetTipo };
                }
                return { ...serie, [field]: value };
              }),
            }
          : ejercicio,
      ),
    );
  };

  const updateDescansoEjecucion = (idEjercicio: number, seconds: number) => {
    setEjecucionEjercicios((prev) =>
      prev.map((ejercicio) => {
        if (ejercicio.id_ejercicio !== idEjercicio) {
          return ejercicio;
        }
        return {
          ...ejercicio,
          descansoSegundos: seconds,
        };
      }),
    );
  };

  const updateNotaEjecucion = (idEjercicio: number, nota: string) => {
    setEjecucionEjercicios((prev) =>
      prev.map((ejercicio) =>
        ejercicio.id_ejercicio === idEjercicio
          ? { ...ejercicio, nota: limitExerciseNote(nota) }
          : ejercicio,
      ),
    );
  };

  const agregarSerieEjecucion = (idEjercicio: number) => {
    setPendingExecutionScrollId(idEjercicio);
    setEjecucionEjercicios((prev) =>
      prev.map((ejercicio) => {
        if (ejercicio.id_ejercicio !== idEjercicio) {
          return ejercicio;
        }
        const nextNumber = ejercicio.series.length + 1;
        const ultimaSerie = ejercicio.series[ejercicio.series.length - 1];
        return {
          ...ejercicio,
          series: [
            ...ejercicio.series,
            {
              id: crypto.randomUUID(),
              numero: nextNumber,
              kg: ultimaSerie?.kg ?? "",
              reps: ultimaSerie?.reps ?? "",
              tipo: ultimaSerie?.tipo ?? "serie",
              completada: false,
              registrada: false,
            },
          ],
        };
      }),
    );
  };

  const eliminarSerieEjecucion = (idEjercicio: number, serieId: string) => {
    setEjecucionEjercicios((prev) =>
      prev.map((ejercicio) => {
        if (ejercicio.id_ejercicio !== idEjercicio || ejercicio.series.length <= 1) {
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

  const toggleSerieCompletada = (idEjercicio: number, serieId: string) => {
    const ejercicio = ejecucionEjercicios.find((item) => item.id_ejercicio === idEjercicio);
    const serie = ejercicio?.series.find((item) => item.id === serieId);
    if (!ejercicio || !serie) {
      return;
    }

    const nuevaCompletada = !serie.completada;

    setEjecucionEjercicios((prev) =>
      prev.map((item) =>
        item.id_ejercicio === idEjercicio
          ? {
              ...item,
              series: item.series.map((set) =>
                set.id === serieId ? { ...set, completada: nuevaCompletada } : set,
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
              item.id_ejercicio === idEjercicio
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

  const abrirModalFinalizarRutina = () => {
    setFinalizeModalOpen(true);
  };

  const finalizarRutina = async (shouldOverwrite: boolean) => {
    try {
      setLoading(true);
      setError("");
      setFinalizeModalOpen(false);
      if (sesionActiva) {
        await syncSeriesDeSesion(sesionActiva.id_sesion);
        const res = await fetch(`${API}/entrenamientos/${sesionActiva.id_sesion}/finalizar`, {
          method: "POST",
          headers: authJsonHeaders(),
        });
        if (!res.ok) {
          throw new Error(await parseError(res, "No se pudo finalizar la rutina"));
        }
      }

      if (shouldOverwrite && rutinaEnEjecucion) {
        const ejerciciosObjetivo = ejecucionEjercicios.map((ejercicio, index) => {
          const repeticiones = Number(
            ejercicio.series.find((serie) => serie.reps.trim())?.reps ?? "10",
          );
          return {
            id_ejercicio: ejercicio.id_ejercicio,
            series: Math.max(1, ejercicio.series.length),
            repeticiones: Number.isNaN(repeticiones) ? 10 : Math.max(1, repeticiones),
            descanso: Math.max(0, ejercicio.descansoSegundos),
            orden: index + 1,
          };
        });

        await syncRutinaEjercicios(rutinaEnEjecucion.id_rutina, ejerciciosObjetivo);
        savePersistedRutinaEjercicios(
          rutinaEnEjecucion.id_rutina,
          ejecucionEjercicios.map((ejercicio) => ({
            id_ejercicio: ejercicio.id_ejercicio,
            nota: limitExerciseNote(ejercicio.nota.trim()),
            descansoSegundos: Math.max(0, ejercicio.descansoSegundos),
            series: ejercicio.series.map((serie) => ({
              kg: serie.kg,
              reps: serie.reps,
              tipo: serie.tipo,
            })),
          })),
        );
        await cargarRutinas();
        setSelectedRutinaId(rutinaEnEjecucion.id_rutina);
      }

      setSesionActiva(null);
      setRutinaEnEjecucion(null);
      setEjecucionEjercicios([]);
      setDescansoActivo(null);
      setElapsedSesionSegundos(0);
      setVista("lista");
      setMensaje(shouldOverwrite ? "Rutina finalizada y sobre escrita" : "Rutina finalizada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error finalizando rutina");
    } finally {
      setLoading(false);
    }
  };

  const rutinasFiltradas = rutinas.filter((rutina) => {
    const search = busquedaRutina.trim().toLowerCase();
    if (!search) {
      return true;
    }

    return (
      rutina.nombre.toLowerCase().includes(search) ||
      (rutina.descripcion ?? "").toLowerCase().includes(search) ||
      String(rutina.id_rutina).includes(search)
    );
  });

  const rutinasPorCarpeta = new Map<number | null, Rutina[]>();
  rutinasFiltradas.forEach((rutina) => {
    const key = rutina.id_carpeta ?? null;
    const current = rutinasPorCarpeta.get(key) ?? [];
    current.push(rutina);
    rutinasPorCarpeta.set(key, current);
  });

  const carpetasPorPadre = new Map<number | null, CarpetaRutina[]>();
  carpetas.forEach((carpeta) => {
    const key = carpeta.id_carpeta_padre ?? null;
    const current = carpetasPorPadre.get(key) ?? [];
    current.push(carpeta);
    carpetasPorPadre.set(key, current);
  });

  const equipos = Array.from(
    new Set(catalogoEjercicios.map((ejercicio) => ejercicio.tipo_disciplina).filter(Boolean)),
  );
  const musculos = Array.from(
    new Set(catalogoEjercicios.map((ejercicio) => ejercicio.grupo_muscular).filter(Boolean)),
  );

  const catalogoFiltrado = catalogoEjercicios.filter((ejercicio) => {
    const matchEquipo = !filtroEquipo || ejercicio.tipo_disciplina === filtroEquipo;
    const matchMusculo = !filtroMusculo || ejercicio.grupo_muscular === filtroMusculo;
    const search = busquedaEjercicio.trim().toLowerCase();
    const matchSearch =
      !search ||
      ejercicio.nombre.toLowerCase().includes(search) ||
      ejercicio.grupo_muscular.toLowerCase().includes(search);
    return matchEquipo && matchMusculo && matchSearch;
  });

  const gruposMuscularesResumen = Array.from(
    new Set(
      resumenEjercicios
        .map((ejercicio) => ejercicio.grupo_muscular)
        .filter((grupo) => Boolean(grupo?.trim())),
    ),
  );

  const totalSeriesResumen = resumenEjercicios.reduce((acc, ejercicio) => acc + ejercicio.series.length, 0);

  // Por grupo muscular: cuántos ejercicios y series tiene, y qué parte del total de series representa.
  const gruposDetalle = gruposMuscularesResumen
    .map((grupo) => {
      const delGrupo = resumenEjercicios.filter((ejercicio) => ejercicio.grupo_muscular === grupo);
      const series = delGrupo.reduce((acc, ejercicio) => acc + ejercicio.series.length, 0);
      return {
        grupo,
        ejercicios: delGrupo.length,
        series,
        porcentaje: totalSeriesResumen > 0 ? Math.round((series / totalSeriesResumen) * 100) : 0,
      };
    })
    .sort((a, b) => b.series - a.series);

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

  const renderRutinaItem = (rutina: Rutina) => (
    <button
      key={rutina.id_rutina}
      type="button"
      className={`list-item ${selectedRutinaId === rutina.id_rutina ? "active" : ""}`}
      onClick={() => {
        setSelectedRutinaId(rutina.id_rutina);
        setDetailMenuOpen(false);
      }}
    >
      <span>
        {rutina.nombre}
      </span>
      <small>{rutina.descripcion || "Sin descripcion"}</small>
    </button>
  );

  const renderToast = () => {
    if (!error && !mensaje) {
      return null;
    }

    const isError = Boolean(error);
    const text = isError ? error : mensaje;
    return (
      <div className={`toast-pop ${isError ? "error" : "ok"}`} role="status" aria-live="polite">
        {text}
      </div>
    );
  };

  const renderCarpeta = (carpeta: CarpetaRutina, nivel: number) => {
    const isExpanded = expandedCarpetas[carpeta.id_carpeta] ?? true;
    const rutinasDeCarpeta = rutinasPorCarpeta.get(carpeta.id_carpeta) ?? [];
    const subcarpetas = carpetasPorPadre.get(carpeta.id_carpeta) ?? [];

    return (
      <div key={carpeta.id_carpeta} className="folder-node folder-section" style={{ marginLeft: `${nivel * 14}px` }}>
        <div className="folder-section-head" data-menu-root="folder">
          <button
            type="button"
            className={`folder-section-toggle ${isExpanded ? "open" : ""}`}
            aria-expanded={isExpanded}
            onClick={() =>
              setExpandedCarpetas((prev) => ({
                ...prev,
                [carpeta.id_carpeta]: !(prev[carpeta.id_carpeta] ?? true),
              }))
            }
          >
            <span className="folder-section-chevron">
              <ChevronIcon />
            </span>
            <strong>{carpeta.nombre}</strong>
            <small>{rutinasDeCarpeta.length}</small>
          </button>
          <button
            type="button"
            className="folder-section-action"
            onClick={() =>
              setOpenFolderMenuId((prev) => (prev === carpeta.id_carpeta ? null : carpeta.id_carpeta))
            }
            aria-label={`Opciones de la carpeta ${carpeta.nombre}`}
            aria-haspopup="menu"
            aria-expanded={openFolderMenuId === carpeta.id_carpeta}
            title="Opciones de carpeta"
          >
            <DotsHorizontalIcon />
          </button>
          {openFolderMenuId === carpeta.id_carpeta && (
            <div className="folder-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => abrirModalRenombrarCarpeta(carpeta)}>
                Editar carpeta
              </button>
              <button type="button" role="menuitem" onClick={() => duplicarCarpeta(carpeta)}>
                Duplicar carpeta
              </button>
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  setOpenFolderMenuId(null);
                  setPendingFolderDelete(carpeta);
                }}
              >
                Eliminar carpeta
              </button>
            </div>
          )}
        </div>

        {isExpanded && (rutinasDeCarpeta.length > 0 || subcarpetas.length > 0) && (
          <div className="folder-children">
            {rutinasDeCarpeta.map((rutina) => renderRutinaItem(rutina))}
            {subcarpetas.map((subcarpeta) => renderCarpeta(subcarpeta, nivel + 1))}
          </div>
        )}
      </div>
    );
  };

  if (vista === "editor") {
    return (
      <main className="app">
        {renderToast()}
        <section className="hero editor-header">
          <button type="button" className="btn secondary" onClick={salirDelEditor}>
            ← Volver
          </button>
          <h1>{editorRutinaId ? "Editar rutina" : "Crear rutina"}</h1>
          <button
            type="button"
            className="btn"
            onClick={guardarRutina}
            disabled={loading || !editorNombre.trim()}
          >
            Guardar rutina
          </button>
        </section>

        {loading && <p className="status">Guardando...</p>}
        <section className="panel routine-editor-layout">
          <article className="box">
            <div className="form-grid">
              <input
                className="field"
                placeholder="Nombre de rutina"
                maxLength={TITLE_MAX_LENGTH}
                value={editorNombre}
                onChange={(event) => setEditorNombre(limitTitle(event.target.value))}
              />
              <input
                className="field"
                placeholder="Descripcion"
                maxLength={DESCRIPTION_MAX_LENGTH}
                value={editorDescripcion}
                onChange={(event) => setEditorDescripcion(limitDescription(event.target.value))}
              />
              <small className="field-counter">
                {editorDescripcion.length}/{DESCRIPTION_MAX_LENGTH}
              </small>
              <div className="routine-editor-meta-row">
                <input
                  className="field"
                  type="number"
                  min="1"
                  placeholder="Duracion (min)"
                  value={editorDuracion}
                  onChange={(event) => setEditorDuracion(event.target.value)}
                />
                <select
                  className="field"
                  value={editorCarpetaId}
                  onChange={(event) => setEditorCarpetaId(event.target.value)}
                >
                  <option value="">Sin carpeta</option>
                  {carpetas.map((carpeta) => (
                    <option key={carpeta.id_carpeta} value={carpeta.id_carpeta}>
                      {carpeta.nombre}
                    </option>
                  ))}
                </select>
                <label className="routine-discover-toggle">
                  <input
                    type="checkbox"
                    checked={editorVisibleEnDescubrir}
                    onChange={(event) => setEditorVisibleEnDescubrir(event.target.checked)}
                  />
                  Aparecer en Descubrir
                </label>
              </div>
            </div>

            <div className="editor-selected">
              {editorEjercicios.length === 0 ? (
                <div className="empty-state">
                  <p>No hay ejercicios</p>
                  <small>Agrega ejercicios desde la libreria de la derecha.</small>
                </div>
              ) : (
                editorEjercicios.map((ejercicio) => (
                  <article
                    key={ejercicio.uid}
                    className={`exercise-card ${draggedEditorExerciseId === ejercicio.uid ? "dragging" : ""}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      moveEditorExercise(ejercicio.uid);
                      setDraggedEditorExerciseId(null);
                    }}
                    ref={(node) => {
                      if (node) {
                        editorExerciseRefs.current.set(ejercicio.uid, node);
                      } else {
                        editorExerciseRefs.current.delete(ejercicio.uid);
                      }
                    }}
                  >
                    <div className="exercise-card-head exercise-card-head-with-tools">
                      <button
                        type="button"
                        className="drag-handle"
                        draggable
                        onDragStart={(event) => {
                          setDraggedEditorExerciseId(ejercicio.uid);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", ejercicio.uid);
                        }}
                        onDragEnd={() => setDraggedEditorExerciseId(null)}
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
                      <ExerciseMedia
                        exerciseId={ejercicio.id_ejercicio}
                        name={ejercicio.nombre}
                        imageUrl={ejercicio.imagen_url}
                      />
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
                            seconds={descansoDesdeInputs(ejercicio.descansoMin, ejercicio.descansoSeg)}
                            onChangeSeconds={(seconds) => updateDescansoEditor(ejercicio.uid, seconds)}
                            ariaLabel={`Descanso de ${ejercicio.nombre}`}
                          />
                        </div>
                        <button
                          type="button"
                          className="exercise-remove-btn"
                          onClick={() => removerEjercicioDelEditor(ejercicio.uid)}
                          aria-label={`Quitar ${ejercicio.nombre}`}
                          title="Quitar ejercicio"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>

                    <div className="exercise-note-panel">
                      <label htmlFor={`routine-note-${ejercicio.uid}`}>Nota</label>
                      <textarea
                        id={`routine-note-${ejercicio.uid}`}
                        className="field exercise-note-textarea"
                        placeholder="Escribir nota"
                        maxLength={EXERCISE_NOTE_MAX_LENGTH}
                        value={ejercicio.nota}
                        onChange={(event) =>
                          updateNotaEditor(ejercicio.uid, event.target.value)
                        }
                      />
                    </div>

                    <div className="set-table">
                      <div className="set-table-head">
                        <span>Set</span>
                        <span>KG</span>
                        <span>Reps</span>
                        <span />
                      </div>

                      {ejercicio.series.map((serie, index) => {
                        const numeroSerie = ejercicio.series
                          .slice(0, index + 1)
                          .filter((item) => item.tipo === "serie").length;

                        return (
                        <div key={serie.id} className="set-row">
                          <div className="set-type-wrap">
                            <select
                              className={`set-type-select ${serie.tipo}`}
                              value={serie.tipo}
                              onChange={(event) =>
                                updateSerieEditor(
                                  ejercicio.uid,
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
                            {serie.tipo === "serie" && (
                              <span className="set-order-badge">{numeroSerie}</span>
                            )}
                          </div>
                          <input
                            className="field compact"
                            type="number"
                            min="0"
                            placeholder="-"
                            value={serie.kg}
                            onChange={(event) =>
                              updateSerieEditor(
                                ejercicio.uid,
                                serie.id,
                                "kg",
                                event.target.value,
                              )
                            }
                          />
                          <input
                            className="field compact"
                            type="number"
                            min="1"
                            placeholder="-"
                            value={serie.reps}
                            onChange={(event) =>
                              updateSerieEditor(
                                ejercicio.uid,
                                serie.id,
                                "reps",
                                event.target.value,
                              )
                            }
                          />
                          <button
                            type="button"
                            className="btn tiny secondary"
                            disabled={ejercicio.series.length <= 1}
                            onClick={() => borrarSerieDeEjercicio(ejercicio.uid, serie.id)}
                          >
                            x
                          </button>
                        </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => agregarSerieAEjercicio(ejercicio.uid)}
                    >
                      + Add serie
                    </button>
                  </article>
                ))
              )}
            </div>
          </article>

          <aside className="box">
            <h2>Suggested exercises</h2>
            <div className="form-grid">
              <select
                className="field"
                value={filtroEquipo}
                onChange={(event) => setFiltroEquipo(event.target.value)}
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
              />
            </div>

            <div className="library-list">
              {catalogoFiltrado.map((ejercicio) => {
                const yaAgregado = editorEjercicios.some(
                  (item) => item.id_ejercicio === ejercicio.id_ejercicio,
                );

                return (
                  <div key={ejercicio.id_ejercicio} className="library-item">
                    <ExerciseMedia
                      exerciseId={ejercicio.id_ejercicio}
                      name={ejercicio.nombre}
                      imageUrl={ejercicio.imagen_url}
                      canUpload={
                        usuario.email.trim().toLowerCase() === "admin@gmail.com" ||
                        ejercicio.creador_id === usuario.id
                      }
                    />
                    <div>
                      <strong>{ejercicio.nombre}</strong>
                      <small>
                        {ejercicio.grupo_muscular}
                        {ejercicio.es_personalizado ? <span className="custom-exercise-badge">Personalizado</span> : null}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="btn tiny"
                      disabled={yaAgregado}
                      onClick={() => agregarEjercicioAlEditor(ejercicio)}
                    >
                      {yaAgregado ? "Agregado" : "+"}
                    </button>
                  </div>
                );
              })}
              {catalogoFiltrado.length === 0 && (
                <p className="helper-text">No hay ejercicios para ese filtro.</p>
              )}
            </div>
          </aside>
        </section>
      </main>
    );
  }

  if (vista === "ejecucion") {
    return (
      <main className="app">
        {renderToast()}
        {descansoActivo && (
          <section
            className={`rest-banner ${descansoActivo.finalizado ? "done" : ""}`}
            aria-live="polite"
          >
            <div className="rest-banner-main">
              <small>Descanso activo</small>
              <strong>{descansoActivo.etiqueta}</strong>
            </div>
            <div className="rest-banner-controls">
              <button type="button" className="btn secondary" onClick={() => ajustarDescansoActivo(-10)}>
                -10
              </button>
              <div className="rest-pill">{formatDuration(descansoActivo.restanteSegundos)}</div>
              <button type="button" className="btn secondary" onClick={() => ajustarDescansoActivo(10)}>
                +10
              </button>
              <button type="button" className="btn secondary" onClick={omitirDescansoActivo}>
                Omitir
              </button>
            </div>
          </section>
        )}

        <section className="hero editor-header">
          <button type="button" className="btn secondary" onClick={() => setVista("lista")}>
            ← Volver
          </button>
          <h1>{rutinaEnEjecucion?.nombre || "Ejecucion de rutina"}</h1>
          <button
            type="button"
            className="btn danger"
            onClick={abrirModalFinalizarRutina}
            disabled={loading}
          >
            Finalizar rutina
          </button>
        </section>

        <section className="panel two-cols">
          <article className="box">
            <h2>Progreso</h2>
            <p className="helper-text">
              Series completas: {seriesCompletadasEjecucion}/{totalSeriesEjecucion}
            </p>
            <p className="helper-text">Tiempo entrenando: {formatDuration(elapsedSesionSegundos)}</p>
            {descansoActivo ? (
              <div className="status">
                Descanso: <strong>{formatDuration(descansoActivo.restanteSegundos)}</strong> ·{" "}
                {descansoActivo.etiqueta}
              </div>
            ) : (
              <p className="helper-text">No hay descanso activo.</p>
            )}
          </article>
          <article className="box">
            <h2>Sesion</h2>
            <p className="helper-text">
              ID de sesion: <strong>{sesionActiva?.id_sesion ?? "-"}</strong>
            </p>
          </article>
        </section>

        <section className="panel">
          <article className="box">
            <div className="editor-selected">
              {ejecucionEjercicios.length === 0 ? (
                <div className="empty-state">
                  <p>La rutina no tiene ejercicios</p>
                  <small>Vuelve y agrega ejercicios a la rutina para ejecutarla.</small>
                </div>
              ) : (
                ejecucionEjercicios.map((ejercicio) => (
                  <article
                    key={ejercicio.id_ejercicio}
                    className="exercise-card"
                    ref={(node) => {
                      if (node) {
                        executionExerciseRefs.current.set(ejercicio.id_ejercicio, node);
                      } else {
                        executionExerciseRefs.current.delete(ejercicio.id_ejercicio);
                      }
                    }}
                  >
                    <div className="exercise-card-head exercise-card-head-with-tools">
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
                            onChangeSeconds={(seconds) => updateDescansoEjecucion(ejercicio.id_ejercicio, seconds)}
                            ariaLabel={`Descanso de ${ejercicio.nombre}`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="exercise-note-panel">
                      <label htmlFor={`routine-execution-note-${ejercicio.id_ejercicio}`}>Nota</label>
                      <textarea
                        id={`routine-execution-note-${ejercicio.id_ejercicio}`}
                        className="field exercise-note-textarea"
                        placeholder="Escribir nota"
                        maxLength={EXERCISE_NOTE_MAX_LENGTH}
                        value={ejercicio.nota}
                        onChange={(event) =>
                          updateNotaEjecucion(ejercicio.id_ejercicio, event.target.value)
                        }
                      />
                    </div>

                    <div className="set-table execution-mode">
                      <div className="set-table-head">
                        <span>Set</span>
                        <span>KG</span>
                        <span>Reps</span>
                        <span />
                        <span>OK</span>
                      </div>

                      {ejercicio.series.map((serie, index) => {
                        const numeroSerie = ejercicio.series
                          .slice(0, index + 1)
                          .filter((item) => item.tipo === "serie").length;

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
                                  ejercicio.id_ejercicio,
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
                            {serie.tipo === "serie" && (
                              <span className="set-order-badge">{numeroSerie}</span>
                            )}
                          </div>
                          <input
                            className="field compact"
                            type="number"
                            min="0"
                            placeholder="-"
                            value={serie.kg}
                            onChange={(event) =>
                              updateSerieEjecucion(
                                ejercicio.id_ejercicio,
                                serie.id,
                                "kg",
                                event.target.value,
                              )
                            }
                          />
                          <input
                            className="field compact"
                            type="number"
                            min="1"
                            placeholder="-"
                            value={serie.reps}
                            onChange={(event) =>
                              updateSerieEjecucion(
                                ejercicio.id_ejercicio,
                                serie.id,
                                "reps",
                                event.target.value,
                              )
                            }
                          />
                          <button
                            type="button"
                            className="btn tiny secondary"
                            disabled={ejercicio.series.length <= 1}
                            onClick={() => eliminarSerieEjecucion(ejercicio.id_ejercicio, serie.id)}
                          >
                            x
                          </button>
                          <button
                            type="button"
                            className={`btn tiny ${serie.completada ? "success" : "secondary"}`}
                            onClick={() => toggleSerieCompletada(ejercicio.id_ejercicio, serie.id)}
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
                      onClick={() => agregarSerieEjecucion(ejercicio.id_ejercicio)}
                    >
                      + Add serie
                    </button>
                  </article>
                ))
              )}
            </div>
          </article>
        </section>

        {finalizeModalOpen ? (
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={() => {
              if (!loading) {
                setFinalizeModalOpen(false);
              }
            }}
          >
            <div
              className="modal-card save-name-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Finalizar rutina"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-head">
                <h2>Finalizar rutina</h2>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setFinalizeModalOpen(false)}
                  disabled={loading}
                >
                  ×
                </button>
              </div>
              <p className="helper-text">
                ¿Quieres sobreescribir la rutina actual con los cambios de esta sesion?
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => void finalizarRutina(false)}
                  disabled={loading}
                >
                  {loading ? "Finalizando..." : "No, solo finalizar"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => void finalizarRutina(true)}
                  disabled={loading}
                >
                  {loading ? "Finalizando..." : "Si, sobreescribir"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    );
  }

  const carpetasRaiz = carpetasPorPadre.get(null) ?? [];
  const rutinasSueltas = rutinasPorCarpeta.get(null) ?? [];

  const handleGenerateRoutineWithGemini = async (payload: {
    prompt: string;
    objetivo?: string;
    diasPorSemana?: number;
  }) => {
    const token = getStoredAuthToken();
    if (!token) {
      setGeminiPanelError("No hay token activo. Volve a iniciar sesion.");
      return;
    }

    try {
      setGeminiGenerating(true);
      setError("");
      setMensaje("");
      setGeminiPanelError("");

      const res = await fetch(`${API}/rutinas/generar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: payload.prompt,
          objetivo: payload.objetivo ?? undefined,
          dias_por_semana: payload.diasPorSemana ?? undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseError(res, "No se pudo generar la rutina con Gemini"));
      }

      const data = (await res.json()) as GeminiGeneratedRoutineResponse;
      const routine = data.rutina_borrador;

      const usoRespaldo = data.origen === "respaldo";
      setGeminiLastRoutine({
        nombre: routine.nombre,
        aviso: usoRespaldo ? data.aviso ?? "Gemini no respondió; armamos una rutina básica." : null,
        detalleTecnico: usoRespaldo ? data.detalle_tecnico ?? null : null,
        descripcion: routine.descripcion,
        duracion_estimada: routine.duracion_estimada,
        visible_en_descubrir: routine.visible_en_descubrir,
        totalEjercicios: routine.ejercicios.length,
        ejerciciosPreview: routine.ejercicios.map((exercise) => ({
          id_ejercicio: exercise.id_ejercicio,
          nombre: exercise.nombre,
          grupo_muscular: exercise.grupo_muscular,
          tipo_disciplina: exercise.tipo_disciplina,
          imagen_url: exercise.imagen_url ?? null,
          series: exercise.series,
          repeticiones: exercise.repeticiones,
          descanso: exercise.descanso,
        })),
      });
      setMensaje(
        usoRespaldo
          ? "Gemini no respondió; se armó una rutina básica con tu catálogo"
          : "Borrador de rutina generado con Gemini",
      );
      setGeminiPanelError("");
    } catch (err) {
      setGeminiPanelError(
        err instanceof Error ? err.message : "No se pudo generar la rutina con Gemini",
      );
    } finally {
      setGeminiGenerating(false);
    }
  };

  return (
    <main className="app">
      {renderToast()}
      <section className="hero rutinas-hero">
        <div className="rutinas-hero-copy">
          <h1>Tus rutinas</h1>
          <p className="helper-text">
            Crea rutinas manuales o pedile una propuesta a Gemini para revisar un borrador antes
            de guardarlo en tu biblioteca.
          </p>
        </div>
        <button
          className="btn rutinas-gemini-btn"
          type="button"
          onClick={abrirGeminiPanelLimpio}
          aria-label="Generar rutina con Gemini (nuevo)"
          title="Generar rutina con Gemini"
        >
          <GeminiSparkIcon />
          <span className="rutinas-new-badge" aria-hidden="true">
            Nuevo
          </span>
        </button>
      </section>

      {loading && <p className="status">Cargando datos...</p>}
      <section className="panel two-cols rutinas-main-panels">
        <article className="box rutinas-list-box">
          <div className="rutinas-search-row">
            <input
              className="field"
              placeholder="Buscar rutinas"
              value={busquedaRutina}
              onChange={(event) => setBusquedaRutina(event.target.value)}
            />
            <button
              className="btn rutinas-add-btn"
              type="button"
              onClick={abrirEditorNuevaRutina}
              aria-label="Crear rutina"
              title="Crear rutina"
            >
              <PlusIcon />
            </button>
          </div>

          <div className="folder-tree">
            {carpetasRaiz.map((carpeta) => renderCarpeta(carpeta, 0))}
            <div className="folder-node folder-section">
              <div className="folder-section-head">
                <div className="folder-section-toggle static">
                  <strong>Sin carpeta</strong>
                  <small>{rutinasSueltas.length}</small>
                </div>
                <button
                  type="button"
                  className="folder-section-action"
                  onClick={() => setCreateFolderModal({ open: true, value: "" })}
                  aria-label="Nueva carpeta"
                  title="Nueva carpeta"
                >
                  <FolderPlusIcon />
                </button>
              </div>
              {rutinasSueltas.length > 0 && (
                <div className="folder-children">{rutinasSueltas.map((rutina) => renderRutinaItem(rutina))}</div>
              )}
            </div>
            {rutinasFiltradas.length === 0 && (
              <div className="empty-state">
                {busquedaRutina.trim() ? (
                  <>
                    <p>Sin resultados</p>
                    <small>No hay rutinas que coincidan con "{busquedaRutina.trim()}".</small>
                  </>
                ) : (
                  <>
                    <p>No hay rutinas</p>
                    <small>Crea tu primera rutina con el +.</small>
                  </>
                )}
              </div>
            )}
          </div>
        </article>

        <article className="box rutinas-detail-box">
          {rutinaSeleccionada ? (
            <div className="routine-detail detail-rich">
              {/* Queda anclado arriba al scrollear el detalle */}
              <div className="rutina-detail-sticky">
                <div className="rutina-detail-topbar">
                  <h2>Detalle</h2>
                  <div className="rutina-detail-actions" data-menu-root="detail">
                    <button
                      type="button"
                      className="btn"
                      onClick={iniciarRutina}
                      disabled={!canStartTraining}
                      title={canStartTraining ? "Comenzar rutina" : "Disponible para usuario y entrenador"}
                    >
                      Comenzar rutina
                    </button>
                    <button
                      type="button"
                      className="btn secondary rutina-kebab-btn"
                      onClick={() => setDetailMenuOpen((prev) => !prev)}
                      aria-label="Más opciones de la rutina"
                      aria-haspopup="menu"
                      aria-expanded={detailMenuOpen}
                      title="Más opciones"
                    >
                      <DotsVerticalIcon />
                    </button>
                    {detailMenuOpen && (
                      <div className="folder-menu rutina-detail-menu" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setDetailMenuOpen(false);
                            abrirEditorRutina(rutinaSeleccionada);
                          }}
                        >
                          Modificar
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setDetailMenuOpen(false);
                            void compartirRutina();
                          }}
                        >
                          Compartir link
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="danger"
                          onClick={() => {
                            setDetailMenuOpen(false);
                            setPendingRoutineDelete(rutinaSeleccionada);
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="routine-title-xl">{rutinaSeleccionada.nombre}</h3>
                <p className="routine-detail-description">{rutinaSeleccionada.descripcion || "Sin descripcion"}</p>
              </div>

              <dl className="rutina-stats">
                <div className="rutina-stat">
                  <dt>Duración</dt>
                  <dd>
                    {rutinaSeleccionada.duracion_estimada ? `${rutinaSeleccionada.duracion_estimada} min` : "—"}
                  </dd>
                </div>
                <div className="rutina-stat">
                  <dt>Ejercicios</dt>
                  <dd>{resumenLoading ? "…" : resumenEjercicios.length}</dd>
                </div>
                <div className="rutina-stat">
                  <dt>Series</dt>
                  <dd>{resumenLoading ? "…" : totalSeriesResumen}</dd>
                </div>
                <div className="rutina-stat">
                  <dt>Guardados</dt>
                  <dd>{rutinaSeleccionada.save_count}</dd>
                </div>
                <div className="rutina-stat">
                  <dt>Copias</dt>
                  <dd>{rutinaSeleccionada.copy_count}</dd>
                </div>
                <div className="rutina-stat">
                  <dt>Visibilidad</dt>
                  <dd>{rutinaSeleccionada.visible_en_descubrir ? "En Descubrir" : "Privada"}</dd>
                </div>
                <div className="rutina-stat">
                  <dt>ID</dt>
                  <dd>#{rutinaSeleccionada.id_rutina}</dd>
                </div>
              </dl>

              <details className="rutina-muscles">
                <summary>
                  <span className="rutina-muscles-chevron">
                    <ChevronIcon />
                  </span>
                  <span className="rutina-muscles-title">Grupos musculares</span>
                  {!resumenLoading && gruposDetalle.length > 0 ? (
                    <span className="rutina-muscles-count">{gruposDetalle.length}</span>
                  ) : null}
                </summary>
                {resumenLoading ? (
                  <p className="helper-text">Cargando grupos musculares...</p>
                ) : gruposDetalle.length === 0 ? (
                  <p className="helper-text">Sin grupos musculares identificados.</p>
                ) : (
                  <ul className="rutina-muscles-list">
                    {gruposDetalle.map((grupo) => (
                      <li key={grupo.grupo} className="rutina-muscle-row">
                        <span className="rutina-muscle-name">{grupo.grupo}</span>
                        <span className="rutina-muscle-bar" aria-hidden="true">
                          <span style={{ width: `${Math.max(4, grupo.porcentaje)}%` }} />
                        </span>
                        <span className="rutina-muscle-meta">
                          {grupo.ejercicios} {grupo.ejercicios === 1 ? "ejercicio" : "ejercicios"} · {grupo.series}{" "}
                          {grupo.series === 1 ? "serie" : "series"} · {grupo.porcentaje}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </details>

              <h3 className="detail-subtitle">Ejercicios ({resumenEjercicios.length})</h3>
              {resumenLoading ? (
                <p className="helper-text">Cargando ejercicios...</p>
              ) : resumenEjercicios.length === 0 ? (
                <p className="helper-text">Esta rutina no tiene ejercicios.</p>
              ) : (
                <div className="exercise-summary-grid">
                  {resumenEjercicios.map((ejercicio, index) => {
                    const cardio = esCardio(ejercicio.tipo_disciplina);
                    const cantidadSeries = ejercicio.series.length;
                    let numeroSerie = 0;

                    return (
                      <div key={`${ejercicio.nombre}-${index}`} className="exercise-summary-item">
                        <strong>{ejercicio.nombre}</strong>
                        <small>
                          {[
                            ejercicio.grupo_muscular,
                            `${cantidadSeries} ${cantidadSeries === 1 ? "serie" : "series"}`,
                            ejercicio.descansoSegundos > 0
                              ? `Descanso ${formatDuration(ejercicio.descansoSegundos)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                        {!cardio ? (
                          <ul className="exercise-summary-sets" aria-label={`Series de ${ejercicio.nombre}`}>
                            {ejercicio.series.map((serie, serieIndex) => {
                              if (serie.tipo === "serie") {
                                numeroSerie += 1;
                              }
                              const tag = serie.tipo === "serie" ? String(numeroSerie) : SET_TIPO_TAG[serie.tipo];

                              return (
                                <li key={serieIndex} className={`exercise-summary-set ${serie.tipo}`}>
                                  <span className="exercise-summary-set-tag">{tag}</span>
                                  {formatResumenSerie(serie)}
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="routine-empty-detail">
              <h2>Detalle</h2>
              <p className="helper-text">Selecciona una rutina para ver sus detalles.</p>
              <img src={routineDetailEmptyBodybuilder} alt="Fisicoculturista posando" />
            </div>
          )}
        </article>
      </section>

      <GeminiRoutinePanel
        open={geminiPanelOpen}
        loading={geminiGenerating}
        onClose={cerrarGeminiPanel}
        onGenerate={(payload) => {
          void handleGenerateRoutineWithGemini(payload);
        }}
        lastGeneratedRoutine={geminiLastRoutine}
        errorMessage={geminiPanelError}
        onViewGeneratedRoutine={
          geminiLastRoutine ? abrirEditorRutinaGemini : null
        }
      />

      {renameModal.open && (
        <div className="modal-backdrop" role="presentation" onClick={cerrarModalRenombrarCarpeta}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Renombrar carpeta"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h2>Rename Folder</h2>
              <button type="button" className="modal-close" onClick={cerrarModalRenombrarCarpeta}>
                ×
              </button>
            </div>
            <input
              className="field"
              placeholder="Nombre de carpeta"
              value={renameModal.value}
              onChange={(event) =>
                setRenameModal((prev) => ({
                  ...prev,
                  value: event.target.value,
                }))
              }
            />
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={cerrarModalRenombrarCarpeta}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={renombrarCarpeta}
                disabled={!renameModal.value.trim()}
              >
                Rename Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {createFolderModal.open ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setCreateFolderModal({ open: false, value: "" })}
        >
          <div
            className="modal-card save-name-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Crear carpeta"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h2>Nueva carpeta</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setCreateFolderModal({ open: false, value: "" })}
                disabled={loading}
              >
                ×
              </button>
            </div>
            <input
              className="field"
              placeholder="Nombre de carpeta"
              value={createFolderModal.value}
              onChange={(event) =>
                setCreateFolderModal((prev) => ({
                  ...prev,
                  value: event.target.value,
                }))
              }
            />
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setCreateFolderModal({ open: false, value: "" })}
                disabled={loading}
              >
                Cancelar
              </button>
              <button type="button" className="btn" onClick={() => void handleCrearCarpeta()} disabled={loading}>
                {loading ? "Creando..." : "Crear carpeta"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingRoutineDelete ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setPendingRoutineDelete(null)}
        >
          <div
            className="modal-card save-name-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Eliminar rutina"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h2>Eliminar rutina</h2>
              <button type="button" className="modal-close" onClick={() => setPendingRoutineDelete(null)}>
                ×
              </button>
            </div>
            <p className="helper-text">
              ¿Eliminar la rutina "{pendingRoutineDelete.nombre}"?
            </p>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setPendingRoutineDelete(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => void handleEliminarRutina(pendingRoutineDelete)}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingFolderDelete ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setPendingFolderDelete(null)}
        >
          <div
            className="modal-card save-name-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Eliminar carpeta"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h2>Eliminar carpeta</h2>
              <button type="button" className="modal-close" onClick={() => setPendingFolderDelete(null)}>
                ×
              </button>
            </div>
            <p className="helper-text">
              ¿Eliminar carpeta "{pendingFolderDelete.nombre}"? Las rutinas quedaran en "Sin carpeta".
            </p>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setPendingFolderDelete(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => void eliminarCarpeta(pendingFolderDelete)}
              >
                Eliminar carpeta
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shareModal.open ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setShareModal({ open: false, url: "" })}
        >
          <div
            className="modal-card save-name-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Compartir rutina"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h2>Compartir rutina</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShareModal({ open: false, url: "" })}
              >
                ×
              </button>
            </div>
            <p className="helper-text">Copia este link para compartir la rutina.</p>
            <input className="field" value={shareModal.url} readOnly />
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShareModal({ open: false, url: "" })}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void navigator.clipboard?.writeText(shareModal.url);
                  setMensaje("Link de rutina copiado");
                  setShareModal({ open: false, url: "" });
                }}
              >
                Copiar link
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default Rutinas;
