import type {
  EntrenamientoResumen,
  RoutineExerciseDetailed,
  RoutineSummary,
  SerieSesionDetalle,
  TrainingSeed,
  TrainingSetType,
} from "../types";

const API = "http://localhost:3000";
const RUTINA_PREFS_KEY = "gymmaxxing_rutina_series_v1";

type PersistedRutinaEjercicio = {
  id_ejercicio: number;
  descansoSegundos: number;
  series: Array<{
    kg: string;
    reps: string;
    tipo: TrainingSetType;
  }>;
};

type RoutineMetricSummary = {
  save_count: number;
  copy_count: number;
};

const parseError = async (res: Response, fallback: string) => {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
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

const savePersistedRutinaEjercicios = (
  idRutina: number,
  ejercicios: PersistedRutinaEjercicio[],
) => {
  const all = readRutinaPrefs();
  all[String(idRutina)] = ejercicios;
  writeRutinaPrefs(all);
};

export const createRoutineShareUrl = (routineId: number) => {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("sharedRoutineId", String(routineId));
  return url.toString();
};

export const getSourceRoutineIdFromSeed = (seed: TrainingSeed) =>
  seed.sourceRoutineId ?? (seed.origin === "rutina" ? seed.sourceId : null);

export const recordRoutineSave = async (routineId: number, userId: number) => {
  const res = await fetch(`${API}/rutinas/${routineId}/metricas/guardar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario_id: userId }),
  });

  if (!res.ok) {
    throw new Error(await parseError(res, "No se pudo registrar el guardado de la rutina"));
  }

  return (await res.json()) as RoutineMetricSummary;
};

export const recordRoutineCopy = async (routineId: number, userId: number) => {
  const res = await fetch(`${API}/rutinas/${routineId}/metricas/copiar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario_id: userId }),
  });

  if (!res.ok) {
    throw new Error(await parseError(res, "No se pudo registrar la copia de la rutina"));
  }

  return (await res.json()) as RoutineMetricSummary;
};

export const fetchRoutineSummary = async (routineId: number) => {
  const res = await fetch(`${API}/rutinas/${routineId}`);
  if (!res.ok) {
    throw new Error(await parseError(res, "No se pudo cargar la rutina"));
  }
  return (await res.json()) as RoutineSummary;
};

export const fetchRoutineExercises = async (routineId: number) => {
  const res = await fetch(`${API}/rutinas/${routineId}/ejercicios`);
  if (!res.ok) {
    throw new Error(await parseError(res, "No se pudieron cargar los ejercicios de la rutina"));
  }
  return (await res.json()) as RoutineExerciseDetailed[];
};

export const buildTrainingSeedFromRoutine = (
  routine: RoutineSummary,
  exercises: RoutineExerciseDetailed[],
): TrainingSeed => ({
  origin: "rutina",
  sourceId: routine.id_rutina,
  sourceRoutineId: routine.id_rutina,
  title: routine.nombre,
  description: routine.descripcion,
  durationMinutes: routine.duracion_estimada,
  exercises: exercises
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((exercise) => ({
      id_ejercicio: exercise.id_ejercicio,
      nombre: exercise.nombre,
      grupo_muscular: exercise.grupo_muscular,
      tipo_disciplina: exercise.tipo_disciplina,
      descansoSegundos: Math.max(0, exercise.descanso ?? 0),
      series: Array.from({ length: Math.max(1, exercise.series) }, () => ({
        kg: "",
        reps: String(exercise.repeticiones || ""),
        tipo: "serie" as const,
      })),
    })),
});

export const fetchRoutineSeed = async (routineId: number) => {
  const [routine, exercises] = await Promise.all([
    fetchRoutineSummary(routineId),
    fetchRoutineExercises(routineId),
  ]);

  return {
    routine,
    exercises,
    seed: buildTrainingSeedFromRoutine(routine, exercises),
  };
};

export const fetchSessionSeed = async (training: EntrenamientoResumen): Promise<TrainingSeed> => {
  const res = await fetch(`${API}/entrenamientos/sesion/${training.id_sesion}/series`);
  if (!res.ok) {
    throw new Error(await parseError(res, "No se pudo cargar el detalle del entrenamiento"));
  }

  const series = (await res.json()) as SerieSesionDetalle[];
  const grouped = new Map<
    number,
    {
      id_ejercicio: number;
      nombre: string;
      grupo_muscular: string;
      tipo_disciplina: string;
      orden_ejercicio: number;
      descansoSegundos: number;
      series: SerieSesionDetalle[];
    }
  >();

  series.forEach((serie) => {
    const existing = grouped.get(serie.ejercicio_id);
    if (existing) {
      existing.series.push(serie);
      return;
    }

    grouped.set(serie.ejercicio_id, {
      id_ejercicio: serie.ejercicio_id,
      nombre: serie.nombre,
      grupo_muscular: serie.grupo_muscular || "Sin grupo",
      tipo_disciplina: serie.tipo_disciplina || "Sin disciplina",
      orden_ejercicio: serie.orden_ejercicio ?? 9999,
      descansoSegundos: Math.max(0, serie.descanso ?? 0),
      series: [serie],
    });
  });

  const durationMinutes =
    training.duracion_segundos == null
      ? null
      : Math.max(1, Math.round(training.duracion_segundos / 60));

  return {
    origin: "sesion",
    sourceId: training.id_sesion,
    sourceRoutineId: training.rutina_id,
    title: training.titulo,
    description: training.descripcion,
    durationMinutes,
    exercises: Array.from(grouped.values())
      .sort((a, b) => {
        if (a.orden_ejercicio !== b.orden_ejercicio) {
          return a.orden_ejercicio - b.orden_ejercicio;
        }
        return a.nombre.localeCompare(b.nombre);
      })
      .map((exercise) => ({
        id_ejercicio: exercise.id_ejercicio,
        nombre: exercise.nombre,
        grupo_muscular: exercise.grupo_muscular,
        tipo_disciplina: exercise.tipo_disciplina,
        descansoSegundos: exercise.descansoSegundos,
        series: exercise.series
          .slice()
          .sort((a, b) => a.orden - b.orden)
          .map((serie) => ({
            kg: serie.peso == null ? "" : String(serie.peso),
            reps: String(serie.repeticiones),
            tipo: "serie" as const,
          })),
      })),
  };
};

export const saveTrainingSeedAsRoutine = async (
  seed: TrainingSeed,
  userId: number,
  options?: {
    name?: string;
    description?: string | null;
    folderId?: number | null;
  },
) => {
  const name = options?.name?.trim() || seed.title || `Rutina ${seed.sourceId}`;
  const descripcion =
    options?.description !== undefined ? options.description : seed.description ?? null;
  const folderId = options?.folderId ?? null;

  const createRes = await fetch(`${API}/rutinas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre: name,
      descripcion,
      duracion_estimada: seed.durationMinutes,
      creador_id: userId,
      id_carpeta: folderId,
    }),
  });

  if (!createRes.ok) {
    throw new Error(await parseError(createRes, "No se pudo crear la rutina"));
  }

  const routine = (await createRes.json()) as RoutineSummary;

  for (let index = 0; index < seed.exercises.length; index += 1) {
    const exercise = seed.exercises[index];
    const reps = Number(exercise.series.find((serie) => serie.reps.trim())?.reps ?? "10");

    const addRes = await fetch(`${API}/rutinas/ejercicios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_rutina: routine.id_rutina,
        id_ejercicio: exercise.id_ejercicio,
        series: Math.max(1, exercise.series.length),
        repeticiones: Number.isNaN(reps) ? 10 : Math.max(1, reps),
        descanso: Math.max(0, exercise.descansoSegundos),
        orden: index + 1,
      }),
    });

    if (!addRes.ok) {
      throw new Error(await parseError(addRes, "No se pudo agregar ejercicio a la rutina"));
    }
  }

  savePersistedRutinaEjercicios(
    routine.id_rutina,
    seed.exercises.map((exercise) => ({
      id_ejercicio: exercise.id_ejercicio,
      descansoSegundos: Math.max(0, exercise.descansoSegundos),
      series: exercise.series.map((serie) => ({
        kg: serie.kg,
        reps: serie.reps,
        tipo: serie.tipo,
      })),
    })),
  );

  const sourceRoutineId = getSourceRoutineIdFromSeed(seed);
  if (sourceRoutineId != null) {
    try {
      await recordRoutineSave(sourceRoutineId, userId);
    } catch (error) {
      console.error("No se pudo registrar el guardado de rutina", error);
    }
  }

  return routine;
};
