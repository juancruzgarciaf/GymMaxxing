import { pool } from "../db";
import { getTrends, getUsuarioPorId } from "./user.service";
import { getGeminiClient, getGeminiModel, isGeminiConfigured } from "./gemini.service";
import {
  agregarEjercicioARutina,
  crearRutina,
  deleteRutina,
  getEjerciciosDeRutina,
  getRutinaPorId,
} from "./rutina.service";

export type GenerateRoutineDraftInput = {
  usuarioId: number;
  prompt: string;
  objetivo?: string;
  diasPorSemana?: number;
};

export type RoutineGenerationCreateResponse = {
  status: "routine_created";
  proveedor: "gemini";
  usuario_id: number;
  gemini_configurado: boolean;
  modelo_usado: string;
  solicitud_usuario: {
    prompt: string;
    objetivo: string | null;
    dias_por_semana: number | null;
  };
  contexto: {
    perfil_usuario: {
      username: string;
      edad: number | null;
      genero: string | null;
      peso: number | null;
      altura: number | null;
      nivel_entrenamiento: string | null;
      objetivo_entrenamiento: string | null;
      tipo_usuario: string;
    };
    tendencias_plataforma: {
      rutinas_mas_copiadas: Array<{
        id_rutina: number;
        nombre: string;
        duracion_estimada: number | null;
        total_ejercicios: number;
        grupos_musculares: string[];
        creador_username: string;
        creador_tipo_usuario: string;
        copy_count: number;
      }>;
      rutinas_mas_guardadas: Array<{
        id_rutina: number;
        nombre: string;
        duracion_estimada: number | null;
        total_ejercicios: number;
        grupos_musculares: string[];
        creador_username: string;
        creador_tipo_usuario: string;
        save_count: number;
      }>;
      usuarios_mas_seguidos: Array<{
        id: number;
        username: string;
        tipo_usuario: string;
        followers_count: number;
        trainings_count: number;
      }>;
    };
    ejercicios_populares_por_grupo: Array<{
      grupo_muscular: string;
      ejercicios: Array<{
        id_ejercicio: number;
        nombre: string;
        tipo_disciplina: string | null;
        veces_usado_en_rutinas: number;
      }>;
    }>;
    ejercicios_populares_de_entrenadores: Array<{
      id_ejercicio: number;
      nombre: string;
      grupo_muscular: string | null;
      tipo_disciplina: string | null;
      veces_usado_por_entrenadores: number;
    }>;
    catalogo_referencia: Array<{
      id_ejercicio: number;
      nombre: string;
      grupo_muscular: string | null;
      tipo_disciplina: string | null;
      veces_usado_en_rutinas: number;
    }>;
  };
  prompt_sistema: string;
  prompt_usuario: string;
  rutina_generada: {
    nombre: string;
    descripcion: string;
    objetivo: string;
    dias_por_semana_recomendados: number | null;
    duracion_estimada: number | null;
    advertencias: string[];
    ejercicios: Array<{
      id_ejercicio: number;
      nombre: string;
      grupo_muscular: string | null;
      series: number;
      repeticiones: number;
      descanso: number;
      orden: number;
    }>;
  };
  rutina_creada: {
    id_rutina: number;
    nombre: string;
    descripcion: string | null;
    duracion_estimada: number | null;
    fecha_creacion: string | null;
    creador_id: number;
    id_carpeta: number | null;
    visible_en_descubrir: boolean;
    save_count: number;
    copy_count: number;
    likes_count: number;
    viewer_liked: boolean;
    ejercicios: Array<{
      id_ejercicio: number;
      id_rutina: number;
      series: number;
      repeticiones: number;
      descanso: number;
      orden: number;
      nombre: string;
      descripcion: string | null;
      grupo_muscular: string | null;
      tipo_disciplina: string | null;
    }>;
  };
  siguiente_paso: string;
};

type ExerciseUsageRow = {
  id_ejercicio: number;
  nombre: string;
  grupo_muscular: string | null;
  tipo_disciplina: string | null;
  veces_usado_en_rutinas: number;
};

type TrainerExerciseUsageRow = {
  id_ejercicio: number;
  nombre: string;
  grupo_muscular: string | null;
  tipo_disciplina: string | null;
  veces_usado_por_entrenadores: number;
};

type GeneratedRoutineExercise = {
  id_ejercicio: number;
  nombre: string;
  grupo_muscular: string | null;
  series: number;
  repeticiones: number;
  descanso: number;
  orden: number;
};

type GeneratedRoutineProposal = {
  nombre: string;
  descripcion: string;
  objetivo: string;
  dias_por_semana_recomendados: number | null;
  duracion_estimada: number | null;
  advertencias: string[];
  ejercicios: GeneratedRoutineExercise[];
};

type CatalogExercise = RoutineGenerationCreateResponse["contexto"]["catalogo_referencia"][number];

const ROUTINE_INTENT_KEYWORDS = [
  "rutina",
  "entrenamiento",
  "ejercicio",
  "hipertrofia",
  "fuerza",
  "masa muscular",
  "volumen",
  "full body",
  "push",
  "pull",
  "legs",
  "ppl",
  "upper",
  "lower",
  "pierna",
  "piernas",
  "pecho",
  "espalda",
  "hombro",
  "hombros",
  "biceps",
  "triceps",
  "gluteo",
  "gluteos",
  "core",
  "abdomen",
  "ganar musculo",
  "ganar masa",
  "musculacion",
];

const looksLikeRoutineRequest = (prompt: string, objetivo?: string) => {
  const base = `${prompt} ${objetivo ?? ""}`.toLowerCase();
  return ROUTINE_INTENT_KEYWORDS.some((keyword) => base.includes(keyword));
};

const getRequestedRoutineStyle = (prompt: string, objetivo?: string) => {
  const content = `${prompt} ${objetivo ?? ""}`.toLowerCase();

  if (
    content.includes("push pull legs") ||
    content.includes("ppl") ||
    (content.includes("push") && content.includes("pull") && content.includes("legs"))
  ) {
    return "push-pull-legs";
  }

  if (content.includes("full body")) {
    return "full-body";
  }

  if (content.includes("upper") || content.includes("torso")) {
    return "upper";
  }

  if (content.includes("lower")) {
    return "lower";
  }

  if (content.includes("push")) {
    return "push";
  }

  if (content.includes("pull")) {
    return "pull";
  }

  if (
    content.includes("pierna") ||
    content.includes("piernas") ||
    content.includes("gluteo") ||
    content.includes("gluteos")
  ) {
    return "legs";
  }

  if (content.includes("pecho") || content.includes("triceps")) {
    return "chest-triceps";
  }

  if (content.includes("espalda") || content.includes("biceps")) {
    return "back-biceps";
  }

  return "general";
};

const getFallbackObjective = (input: GenerateRoutineDraftInput) => {
  const content = `${input.prompt} ${input.objetivo ?? ""}`.toLowerCase();

  if (content.includes("fuerza")) {
    return "fuerza";
  }

  if (
    content.includes("hipertrofia") ||
    content.includes("masa muscular") ||
    content.includes("volumen")
  ) {
    return "hipertrofia";
  }

  if (
    content.includes("resistencia") ||
    content.includes("definicion") ||
    content.includes("quemar grasa")
  ) {
    return "resistencia";
  }

  return input.objetivo?.trim() || "hipertrofia";
};

const pickDistinctExercises = (
  catalog: CatalogExercise[],
  groups: string[],
  maxExercises: number
) => {
  const picked: CatalogExercise[] = [];
  const usedIds = new Set<number>();

  const pushExercise = (exercise: CatalogExercise | undefined) => {
    if (!exercise || usedIds.has(exercise.id_ejercicio)) {
      return;
    }

    usedIds.add(exercise.id_ejercicio);
    picked.push(exercise);
  };

  groups.forEach((group) => {
    const candidates = catalog.filter(
      (exercise) => (exercise.grupo_muscular ?? "").toLowerCase() === group.toLowerCase()
    );

    candidates.slice(0, 2).forEach(pushExercise);
  });

  if (picked.length < maxExercises) {
    catalog.forEach((exercise) => {
      if (picked.length >= maxExercises) {
        return;
      }
      pushExercise(exercise);
    });
  }

  return picked.slice(0, maxExercises);
};

const buildFallbackRoutineProposal = (
  input: GenerateRoutineDraftInput,
  catalog: CatalogExercise[]
): GeneratedRoutineProposal => {
  const style = getRequestedRoutineStyle(input.prompt, input.objetivo);
  const objective = getFallbackObjective(input);

  const groupMap: Record<string, string[]> = {
    "push-pull-legs": ["Pecho", "Espalda", "Piernas", "Hombros", "Triceps", "Biceps"],
    "full-body": ["Piernas", "Pecho", "Espalda", "Hombros", "Core"],
    upper: ["Pecho", "Espalda", "Hombros", "Biceps", "Triceps"],
    lower: ["Piernas", "Gluteos", "Core"],
    push: ["Pecho", "Hombros", "Triceps"],
    pull: ["Espalda", "Biceps", "Hombros"],
    legs: ["Piernas", "Gluteos", "Core"],
    "chest-triceps": ["Pecho", "Triceps", "Hombros"],
    "back-biceps": ["Espalda", "Biceps", "Hombros"],
    general: ["Piernas", "Pecho", "Espalda", "Hombros", "Core"],
  };

  const selectedGroups =
    groupMap[style] ?? ["Piernas", "Pecho", "Espalda", "Hombros", "Core"];
  const maxExercises =
    style === "push-pull-legs" || style === "full-body" ? 6 : 5;
  const selectedExercises = pickDistinctExercises(
    catalog,
    selectedGroups,
    maxExercises
  );

  if (selectedExercises.length === 0) {
    throw new Error("No se pudo armar una rutina fallback con el catalogo actual");
  }

  let series = 4;
  let repeticiones = 10;
  let descanso = 90;

  if (objective.toLowerCase().includes("fuerza")) {
    series = 4;
    repeticiones = 5;
    descanso = 150;
  } else if (objective.toLowerCase().includes("resistencia")) {
    series = 3;
    repeticiones = 15;
    descanso = 60;
  }

  const styleLabelMap: Record<string, string> = {
    "push-pull-legs": "Push Pull Legs",
    "full-body": "Full Body",
    upper: "Upper",
    lower: "Lower",
    push: "Push",
    pull: "Pull",
    legs: "Piernas",
    "chest-triceps": "Pecho y Triceps",
    "back-biceps": "Espalda y Biceps",
    general: "General",
  };

  return {
    nombre: `Rutina ${styleLabelMap[style] ?? "General"} generada`,
    descripcion:
      "Rutina generada en modo fallback usando el catalogo real de ejercicios de GymMaxxing.",
    objetivo: objective,
    dias_por_semana_recomendados: input.diasPorSemana ?? null,
    duracion_estimada: selectedExercises.length >= 6 ? 75 : 60,
    advertencias: [
      "Se uso una generacion de respaldo para evitar que el pedido falle.",
    ],
    ejercicios: selectedExercises.map((exercise, index) => ({
      id_ejercicio: exercise.id_ejercicio,
      nombre: exercise.nombre,
      grupo_muscular: exercise.grupo_muscular,
      series,
      repeticiones,
      descanso,
      orden: index + 1,
    })),
  };
};

const buildSystemPrompt = () =>
  [
    "Sos Gemini integrado en GymMaxxing como motor de generacion de rutinas.",
    "No respondas como chatbot conversacional ni expliques de mas.",
    "Tu tarea es generar una propuesta de rutina personalizada usando el perfil del usuario y datos reales de la plataforma.",
    "Prioriza ejercicios existentes en GymMaxxing y patrones observados en rutinas populares, guardadas o copiadas.",
    "Debes responder unicamente JSON valido siguiendo exactamente el schema solicitado.",
    "No agregues markdown, comentarios ni texto fuera del JSON.",
    "No inventes ejercicios fuera del catalogo de referencia si hay equivalentes disponibles.",
  ].join(" ");

const buildUserPrompt = (payload: {
  prompt: string;
  objetivo: string | null;
  diasPorSemana: number | null;
  perfil: {
    username: string;
    edad: number | null;
    genero: string | null;
    peso: number | null;
    altura: number | null;
    nivel_entrenamiento: string | null;
    objetivo_entrenamiento: string | null;
    tipo_usuario: string;
  };
  tendencias: RoutineGenerationCreateResponse["contexto"]["tendencias_plataforma"];
  ejerciciosPorGrupo: RoutineGenerationCreateResponse["contexto"]["ejercicios_populares_por_grupo"];
  ejerciciosEntrenadores: RoutineGenerationCreateResponse["contexto"]["ejercicios_populares_de_entrenadores"];
  catalogoReferencia: RoutineGenerationCreateResponse["contexto"]["catalogo_referencia"];
}) => {
  const lines = [
    "Solicitud del usuario:",
    payload.prompt,
    "",
    "Preferencias explicitas del pedido:",
    `- objetivo solicitado: ${payload.objetivo ?? "no especificado"}`,
    `- dias por semana: ${payload.diasPorSemana ?? "no especificado"}`,
    "",
    "Perfil del usuario:",
    `- username: ${payload.perfil.username}`,
    `- edad: ${payload.perfil.edad ?? "sin dato"}`,
    `- genero: ${payload.perfil.genero ?? "sin dato"}`,
    `- peso: ${payload.perfil.peso ?? "sin dato"}`,
    `- altura: ${payload.perfil.altura ?? "sin dato"}`,
    `- nivel de entrenamiento: ${payload.perfil.nivel_entrenamiento ?? "sin dato"}`,
    `- objetivo de entrenamiento en perfil: ${payload.perfil.objetivo_entrenamiento ?? "sin dato"}`,
    `- tipo de usuario: ${payload.perfil.tipo_usuario}`,
    "",
    "Rutinas mas copiadas en GymMaxxing:",
    ...payload.tendencias.rutinas_mas_copiadas.map(
      (routine) =>
        `- ${routine.nombre} (id ${routine.id_rutina}) | creador: ${routine.creador_username} (${routine.creador_tipo_usuario}) | copias: ${routine.copy_count} | ejercicios: ${routine.total_ejercicios} | grupos: ${routine.grupos_musculares.join(", ") || "sin grupos"}`
    ),
    "",
    "Rutinas mas guardadas en GymMaxxing:",
    ...payload.tendencias.rutinas_mas_guardadas.map(
      (routine) =>
        `- ${routine.nombre} (id ${routine.id_rutina}) | creador: ${routine.creador_username} (${routine.creador_tipo_usuario}) | guardados: ${routine.save_count} | ejercicios: ${routine.total_ejercicios} | grupos: ${routine.grupos_musculares.join(", ") || "sin grupos"}`
    ),
    "",
    "Usuarios mas seguidos:",
    ...payload.tendencias.usuarios_mas_seguidos.map(
      (user) =>
        `- ${user.username} (${user.tipo_usuario}) | seguidores: ${user.followers_count} | entrenamientos finalizados: ${user.trainings_count}`
    ),
    "",
    "Ejercicios mas usados por grupo muscular:",
    ...payload.ejerciciosPorGrupo.map(
      (group) =>
        `- ${group.grupo_muscular}: ${group.ejercicios
          .map((exercise) => `${exercise.nombre} [id ${exercise.id_ejercicio}] (${exercise.veces_usado_en_rutinas})`)
          .join(", ")}`
    ),
    "",
    "Ejercicios mas usados por entrenadores:",
    ...payload.ejerciciosEntrenadores.map(
      (exercise) =>
        `- ${exercise.nombre} [id ${exercise.id_ejercicio}] | grupo: ${exercise.grupo_muscular ?? "sin grupo"} | usos: ${exercise.veces_usado_por_entrenadores}`
    ),
    "",
    "Catalogo de referencia disponible para elegir ejercicios:",
    ...payload.catalogoReferencia.map(
      (exercise) =>
        `- ${exercise.nombre} [id ${exercise.id_ejercicio}] | grupo: ${exercise.grupo_muscular ?? "sin grupo"} | disciplina: ${exercise.tipo_disciplina ?? "sin disciplina"} | usos: ${exercise.veces_usado_en_rutinas}`
    ),
    "",
    "Genera una propuesta de rutina alineada con GymMaxxing.",
    "Responde solo con JSON estructurado.",
  ];

  return lines.join("\n");
};

const routineProposalJsonSchema = {
  type: "object",
  properties: {
    nombre: {
      type: "string",
      description: "Nombre corto de la rutina propuesta.",
    },
    descripcion: {
      type: "string",
      description: "Descripcion breve y concreta de la rutina.",
    },
    objetivo: {
      type: "string",
      description: "Objetivo principal de la rutina.",
    },
    dias_por_semana_recomendados: {
      anyOf: [{ type: "integer" }, { type: "null" }],
      description: "Cantidad sugerida de dias por semana.",
    },
    duracion_estimada: {
      anyOf: [{ type: "integer" }, { type: "null" }],
      description: "Duracion estimada en minutos.",
    },
    advertencias: {
      type: "array",
      items: { type: "string" },
      description: "Advertencias o aclaraciones breves.",
    },
    ejercicios: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id_ejercicio: {
            type: "integer",
            description: "ID real del ejercicio en GymMaxxing.",
          },
          nombre: {
            type: "string",
            description: "Nombre del ejercicio.",
          },
          grupo_muscular: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description: "Grupo muscular principal.",
          },
          series: {
            type: "integer",
            description: "Cantidad total de series.",
          },
          repeticiones: {
            type: "integer",
            description: "Repeticiones objetivo por serie.",
          },
          descanso: {
            type: "integer",
            description: "Descanso entre series en segundos.",
          },
          orden: {
            type: "integer",
            description: "Orden del ejercicio dentro de la rutina.",
          },
        },
        required: [
          "id_ejercicio",
          "nombre",
          "grupo_muscular",
          "series",
          "repeticiones",
          "descanso",
          "orden",
        ],
      },
    },
  },
  required: [
    "nombre",
    "descripcion",
    "objetivo",
    "dias_por_semana_recomendados",
    "duracion_estimada",
    "advertencias",
    "ejercicios",
  ],
} as const;

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isRetryableGeminiError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('"status":"UNAVAILABLE"') ||
    error.message.includes('"code":503') ||
    error.message.includes("high demand") ||
    error.message.includes("fetch failed") ||
    error.message.includes("ECONNRESET") ||
    error.message.includes("ENOTFOUND") ||
    error.message.includes("ETIMEDOUT")
  );
};

const getGeminiRateLimitRetryDelayMs = (error: unknown) => {
  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message;
  if (
    !message.includes('"status":"RESOURCE_EXHAUSTED"') &&
    !message.includes('"code":429') &&
    !message.toLowerCase().includes("please retry in")
  ) {
    return null;
  }

  const retryDelayMatch = message.match(/"retryDelay":"(\d+)s"/);
  if (retryDelayMatch?.[1]) {
    return Number(retryDelayMatch[1]) * 1000;
  }

  const plainTextMatch = message.match(/Please retry in ([\d.]+)s/i);
  if (plainTextMatch?.[1]) {
    return Math.ceil(Number(plainTextMatch[1]) * 1000);
  }

  return null;
};

const generateGeminiContentWithRetry = async (params: {
  model: string;
  promptSistema: string;
  promptUsuario: string;
}) => {
  const ai = getGeminiClient();
  const maxAttempts = 4;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await ai.models.generateContent({
        model: params.model,
        contents: params.promptUsuario,
        config: {
          systemInstruction: params.promptSistema,
          responseMimeType: "application/json",
          responseJsonSchema: routineProposalJsonSchema,
          temperature: 0.4,
          maxOutputTokens: 1600,
        },
      });
    } catch (error) {
      lastError = error;
      const rateLimitDelay = getGeminiRateLimitRetryDelayMs(error);
      const shouldRetry =
        isRetryableGeminiError(error) || rateLimitDelay != null;

      if (!shouldRetry || attempt === maxAttempts - 1) {
        throw error;
      }

      const fallbackDelays = [1200, 2500, 4000];
      const delay = rateLimitDelay ?? fallbackDelays[attempt] ?? 2500;
      await sleep(delay);
    }
  }

  throw lastError ?? new Error("No se pudo generar contenido con Gemini");
};

const parsePositiveInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const normalizeExerciseNameKey = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

const getExerciseNameSimilarityScore = (
  requestedName: string,
  existingName: string
) => {
  if (!requestedName || !existingName) {
    return 0;
  }

  if (requestedName === existingName) {
    return 100;
  }

  if (
    requestedName.includes(existingName) ||
    existingName.includes(requestedName)
  ) {
    return 80;
  }

  const requestedTokens = new Set(requestedName.split(" ").filter(Boolean));
  const existingTokens = new Set(existingName.split(" ").filter(Boolean));
  const shared = Array.from(requestedTokens).filter((token) =>
    existingTokens.has(token)
  ).length;

  if (shared === 0) {
    return 0;
  }

  return Math.round(
    (shared / Math.max(requestedTokens.size, existingTokens.size)) * 70
  );
};

const parseGeminiJsonResponse = (rawText: string) => {
  const trimmed = rawText.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fencedMatch?.[1]) {
        return JSON.parse(fencedMatch[1].trim());
      }

      const firstBrace = trimmed.indexOf("{");
      const lastBrace = trimmed.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      }
    } catch {
      throw new Error("Gemini devolvio un JSON invalido para la rutina");
    }

    throw new Error("Gemini devolvio un JSON invalido para la rutina");
  }
};

const normalizeGeneratedRoutineProposal = (
  raw: unknown,
  input: GenerateRoutineDraftInput
): GeneratedRoutineProposal => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Gemini devolvio un JSON invalido para la rutina");
  }

  const data = raw as Record<string, unknown>;
  const nombre =
    typeof data.nombre === "string" && data.nombre.trim()
      ? data.nombre.trim()
      : `Rutina generada para ${input.prompt}`;
  const descripcion =
    typeof data.descripcion === "string" && data.descripcion.trim()
      ? data.descripcion.trim()
      : "Rutina generada automaticamente con Gemini para GymMaxxing.";
  const objetivo =
    typeof data.objetivo === "string" && data.objetivo.trim()
      ? data.objetivo.trim()
      : input.objetivo ?? "Mejorar rendimiento general";
  const diasPorSemana =
    data.dias_por_semana_recomendados == null
      ? input.diasPorSemana ?? null
      : parsePositiveInteger(data.dias_por_semana_recomendados, input.diasPorSemana ?? 3);
  const duracionEstimada =
    data.duracion_estimada == null
      ? null
      : parsePositiveInteger(data.duracion_estimada, 60);
  const advertencias = Array.isArray(data.advertencias)
    ? data.advertencias
        .filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0
        )
        .map((item) => item.trim())
    : [];

  const ejerciciosRaw = Array.isArray(data.ejercicios) ? data.ejercicios : [];
  const ejercicios = ejerciciosRaw
    .map((exercise, index) => {
      if (!exercise || typeof exercise !== "object" || Array.isArray(exercise)) {
        return null;
      }

      const item = exercise as Record<string, unknown>;
      return {
        id_ejercicio: parsePositiveInteger(item.id_ejercicio, 0),
        nombre:
          typeof item.nombre === "string" && item.nombre.trim()
            ? item.nombre.trim()
            : `Ejercicio ${index + 1}`,
        grupo_muscular:
          typeof item.grupo_muscular === "string" && item.grupo_muscular.trim()
            ? item.grupo_muscular.trim()
            : null,
        series: parsePositiveInteger(item.series, 3),
        repeticiones: parsePositiveInteger(item.repeticiones, 10),
        descanso: parsePositiveInteger(item.descanso, 90),
        orden: parsePositiveInteger(item.orden, index + 1),
      };
    })
    .filter((item): item is GeneratedRoutineExercise => item != null)
    .sort((a, b) => a.orden - b.orden);

  return {
    nombre,
    descripcion,
    objetivo,
    dias_por_semana_recomendados: diasPorSemana,
    duracion_estimada: duracionEstimada,
    advertencias,
    ejercicios,
  };
};

const sanitizeExercisesForPersistence = async (
  ejercicios: GeneratedRoutineExercise[]
) => {
  const requestedNames = Array.from(
    new Set(
      ejercicios
        .map((exercise) => normalizeExerciseNameKey(exercise.nombre))
        .filter(Boolean)
    )
  );

  const requestedIds = Array.from(
    new Set(
      ejercicios
        .map((exercise) => exercise.id_ejercicio)
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );

  if (requestedIds.length === 0 && requestedNames.length === 0) {
    throw new Error("La rutina generada no contiene ejercicios validos");
  }

  const result = await pool.query<{
    id_ejercicio: number;
    nombre: string;
    grupo_muscular: string | null;
  }>(
    `SELECT id_ejercicio, nombre, grupo_muscular
     FROM ejercicio`
  );

  if (result.rows.length === 0) {
    throw new Error("No hay ejercicios cargados en GymMaxxing para generar rutinas con Gemini");
  }

  const existingExercises = new Map(
    result.rows.map((row) => [row.id_ejercicio, row] as const)
  );
  const existingExercisesByName = new Map(
    result.rows.map((row) => [normalizeExerciseNameKey(row.nombre), row] as const)
  );

  const seenIds = new Set<number>();
  const sanitized = ejercicios
    .map((exercise) => {
      const byId = existingExercises.get(exercise.id_ejercicio);
      const byName = existingExercisesByName.get(
        normalizeExerciseNameKey(exercise.nombre)
      );
      let matched = byId ?? byName;

      if (!matched) {
        const requestedName = normalizeExerciseNameKey(exercise.nombre);
        let bestMatch: (typeof result.rows)[number] | null = null;
        let bestScore = 0;

        for (const candidate of result.rows) {
          const score = getExerciseNameSimilarityScore(
            requestedName,
            normalizeExerciseNameKey(candidate.nombre)
          );
          if (score > bestScore) {
            bestScore = score;
            bestMatch = candidate;
          }
        }

        if (bestMatch && bestScore >= 50) {
          matched = bestMatch;
        }
      }

      if (!matched) {
        return null;
      }

      if (seenIds.has(matched.id_ejercicio)) {
        return false;
      }

      seenIds.add(matched.id_ejercicio);
      return {
        id_ejercicio: matched.id_ejercicio,
        nombre: matched.nombre,
        grupo_muscular: matched.grupo_muscular,
        series: parsePositiveInteger(exercise.series, 3),
        repeticiones: parsePositiveInteger(exercise.repeticiones, 10),
        descanso: Math.max(0, Number(exercise.descanso) || 0),
        orden: exercise.orden,
      };
    })
    .filter(
      (
        exercise
      ): exercise is {
        id_ejercicio: number;
        nombre: string;
        grupo_muscular: string | null;
        series: number;
        repeticiones: number;
        descanso: number;
        orden: number;
      } => exercise != null
    )
    .sort((a, b) => a.orden - b.orden)
    .map((exercise, index) => {
      return {
        id_ejercicio: exercise.id_ejercicio,
        nombre: exercise.nombre,
        grupo_muscular: exercise.grupo_muscular,
        series: parsePositiveInteger(exercise.series, 3),
        repeticiones: parsePositiveInteger(exercise.repeticiones, 10),
        descanso: Math.max(0, Number(exercise.descanso) || 0),
        orden: index + 1,
      };
    });

  if (sanitized.length === 0) {
    throw new Error("La rutina generada no contiene ejercicios validos");
  }

  return sanitized;
};

const getPopularExercisesByMuscleGroup = async () => {
  const result = await pool.query<
    ExerciseUsageRow & {
      ranking: number;
    }
  >(
    `WITH ranked AS (
       SELECT e.grupo_muscular,
              e.id_ejercicio,
              e.nombre,
              e.tipo_disciplina,
              COUNT(*)::int AS veces_usado_en_rutinas,
              ROW_NUMBER() OVER (
                PARTITION BY e.grupo_muscular
                ORDER BY COUNT(*) DESC, e.nombre ASC
              ) AS ranking
       FROM rutinaejercicio re
       JOIN ejercicio e ON e.id_ejercicio = re.id_ejercicio
       WHERE e.grupo_muscular IS NOT NULL
         AND e.grupo_muscular <> ''
       GROUP BY e.grupo_muscular, e.id_ejercicio, e.nombre, e.tipo_disciplina
     )
     SELECT grupo_muscular,
            id_ejercicio,
            nombre,
            tipo_disciplina,
            veces_usado_en_rutinas,
            ranking
     FROM ranked
     WHERE ranking <= 3
     ORDER BY grupo_muscular ASC, ranking ASC`
  );

  const grouped = new Map<
    string,
    RoutineGenerationCreateResponse["contexto"]["ejercicios_populares_por_grupo"][number]["ejercicios"]
  >();

  result.rows.forEach((row) => {
    const current = grouped.get(row.grupo_muscular ?? "Sin grupo") ?? [];
    current.push({
      id_ejercicio: row.id_ejercicio,
      nombre: row.nombre,
      tipo_disciplina: row.tipo_disciplina,
      veces_usado_en_rutinas: row.veces_usado_en_rutinas,
    });
    grouped.set(row.grupo_muscular ?? "Sin grupo", current);
  });

  return Array.from(grouped.entries()).map(([grupo_muscular, ejercicios]) => ({
    grupo_muscular,
    ejercicios,
  }));
};

const getPopularExercisesByTrainers = async () => {
  const result = await pool.query<TrainerExerciseUsageRow>(
    `SELECT e.id_ejercicio,
            e.nombre,
            e.grupo_muscular,
            e.tipo_disciplina,
            COUNT(*)::int AS veces_usado_por_entrenadores
     FROM rutinaejercicio re
     JOIN rutina r ON r.id_rutina = re.id_rutina
     JOIN usuario u ON u.id = r.creador_id
     JOIN ejercicio e ON e.id_ejercicio = re.id_ejercicio
     WHERE LOWER(u.tipo_usuario) = 'entrenador'
     GROUP BY e.id_ejercicio, e.nombre, e.grupo_muscular, e.tipo_disciplina
     ORDER BY veces_usado_por_entrenadores DESC, e.nombre ASC
     LIMIT 10`
  );

  return result.rows;
};

const getReferenceExerciseCatalog = async () => {
  const result = await pool.query<ExerciseUsageRow>(
    `SELECT e.id_ejercicio,
            e.nombre,
            e.grupo_muscular,
            e.tipo_disciplina,
            COUNT(re.id_rutina)::int AS veces_usado_en_rutinas
     FROM ejercicio e
     LEFT JOIN rutinaejercicio re ON re.id_ejercicio = e.id_ejercicio
     GROUP BY e.id_ejercicio, e.nombre, e.grupo_muscular, e.tipo_disciplina
     ORDER BY veces_usado_en_rutinas DESC, e.nombre ASC
     LIMIT 30`
  );

  return result.rows;
};

const persistGeneratedRoutine = async (params: {
  input: GenerateRoutineDraftInput;
  geminiConfigured: boolean;
  model: string;
  perfilUsuario: RoutineGenerationCreateResponse["contexto"]["perfil_usuario"];
  tendencias: RoutineGenerationCreateResponse["contexto"]["tendencias_plataforma"];
  popularExercisesByGroup: RoutineGenerationCreateResponse["contexto"]["ejercicios_populares_por_grupo"];
  popularExercisesByTrainers: RoutineGenerationCreateResponse["contexto"]["ejercicios_populares_de_entrenadores"];
  referenceCatalog: RoutineGenerationCreateResponse["contexto"]["catalogo_referencia"];
  promptSistema: string;
  promptUsuario: string;
  rutinaGenerada: GeneratedRoutineProposal;
}) => {
  const ejerciciosValidados = await sanitizeExercisesForPersistence(
    params.rutinaGenerada.ejercicios
  );

  const rutinaCreada = await crearRutina({
    nombre: params.rutinaGenerada.nombre,
    descripcion: params.rutinaGenerada.descripcion,
    duracion_estimada: params.rutinaGenerada.duracion_estimada,
    creador_id: params.input.usuarioId,
    id_carpeta: null,
    visible_en_descubrir: true,
  });

  if (!rutinaCreada) {
    throw new Error("No se pudo crear la rutina generada por Gemini");
  }

  try {
    for (const exercise of ejerciciosValidados) {
      await agregarEjercicioARutina({
        id_rutina: rutinaCreada.id_rutina,
        id_ejercicio: exercise.id_ejercicio,
        series: exercise.series,
        repeticiones: exercise.repeticiones,
        descanso: exercise.descanso,
        orden: exercise.orden,
      });
    }
  } catch (error) {
    await deleteRutina(String(rutinaCreada.id_rutina), params.input.usuarioId);
    throw error;
  }

  const rutinaPersistida =
    (await getRutinaPorId(String(rutinaCreada.id_rutina), params.input.usuarioId)) ??
    rutinaCreada;
  const ejerciciosPersistidos = await getEjerciciosDeRutina(
    String(rutinaCreada.id_rutina)
  );

  return {
    status: "routine_created" as const,
    proveedor: "gemini" as const,
    usuario_id: params.input.usuarioId,
    gemini_configurado: params.geminiConfigured,
    modelo_usado: params.model,
    solicitud_usuario: {
      prompt: params.input.prompt,
      objetivo: params.input.objetivo ?? null,
      dias_por_semana: params.input.diasPorSemana ?? null,
    },
    contexto: {
      perfil_usuario: params.perfilUsuario,
      tendencias_plataforma: params.tendencias,
      ejercicios_populares_por_grupo: params.popularExercisesByGroup,
      ejercicios_populares_de_entrenadores: params.popularExercisesByTrainers,
      catalogo_referencia: params.referenceCatalog,
    },
    prompt_sistema: params.promptSistema,
    prompt_usuario: params.promptUsuario,
    rutina_generada: {
      ...params.rutinaGenerada,
      ejercicios: ejerciciosValidados,
    },
    rutina_creada: {
      id_rutina: rutinaPersistida.id_rutina,
      nombre: rutinaPersistida.nombre,
      descripcion: rutinaPersistida.descripcion,
      duracion_estimada: rutinaPersistida.duracion_estimada,
      fecha_creacion: rutinaPersistida.fecha_creacion,
      creador_id: rutinaPersistida.creador_id,
      id_carpeta: rutinaPersistida.id_carpeta,
      visible_en_descubrir: rutinaPersistida.visible_en_descubrir,
      save_count: rutinaPersistida.save_count,
      copy_count: rutinaPersistida.copy_count,
      likes_count: rutinaPersistida.likes_count,
      viewer_liked: rutinaPersistida.viewer_liked ?? false,
      ejercicios: ejerciciosPersistidos,
    },
    siguiente_paso:
      "La rutina ya fue creada en GymMaxxing usando Gemini o un fallback seguro.",
  };
};

export const generateRoutineDraftFromPrompt = async (
  input: GenerateRoutineDraftInput
): Promise<RoutineGenerationCreateResponse> => {
  if (!looksLikeRoutineRequest(input.prompt, input.objetivo)) {
    throw new Error("Solo hago rutinas. Pedime una rutina o entrenamiento y la armo.");
  }

  const geminiConfigured = isGeminiConfigured();

  const [user, trends, popularExercisesByGroup, popularExercisesByTrainers, referenceCatalog] =
    await Promise.all([
      getUsuarioPorId(input.usuarioId),
      getTrends(input.usuarioId),
      getPopularExercisesByMuscleGroup(),
      getPopularExercisesByTrainers(),
      getReferenceExerciseCatalog(),
    ]);

  if (!user) {
    throw new Error("Usuario no encontrado para generar rutina");
  }

  if (referenceCatalog.length === 0) {
    throw new Error("No hay ejercicios cargados en GymMaxxing para generar rutinas con Gemini");
  }

  const perfilUsuario = {
    username: user.username,
    edad: user.edad ?? null,
    genero: user.genero ?? null,
    peso: user.peso ?? null,
    altura: user.altura ?? null,
    nivel_entrenamiento: user.nivel_entrenamiento ?? null,
    objetivo_entrenamiento: user.objetivo_entrenamiento ?? null,
    tipo_usuario: user.tipo_usuario,
  };

  const tendencias = {
    rutinas_mas_copiadas: trends.rutinas_mas_copiadas.slice(0, 5).map((routine) => ({
      id_rutina: routine.id_rutina,
      nombre: routine.nombre,
      duracion_estimada: routine.duracion_estimada,
      total_ejercicios: routine.total_ejercicios,
      grupos_musculares: routine.grupos_musculares,
      creador_username: routine.creador_username,
      creador_tipo_usuario: routine.creador_tipo_usuario,
      copy_count: routine.copy_count,
    })),
    rutinas_mas_guardadas: trends.rutinas_mas_guardadas.slice(0, 5).map((routine) => ({
      id_rutina: routine.id_rutina,
      nombre: routine.nombre,
      duracion_estimada: routine.duracion_estimada,
      total_ejercicios: routine.total_ejercicios,
      grupos_musculares: routine.grupos_musculares,
      creador_username: routine.creador_username,
      creador_tipo_usuario: routine.creador_tipo_usuario,
      save_count: routine.save_count,
    })),
    usuarios_mas_seguidos: trends.usuarios_mas_seguidos.slice(0, 5).map((user) => ({
      id: user.id,
      username: user.username,
      tipo_usuario: user.tipo_usuario,
      followers_count: user.followers_count,
      trainings_count: user.trainings_count,
    })),
  };

  const promptSistema = buildSystemPrompt();
  const promptUsuario = buildUserPrompt({
    prompt: input.prompt,
    objetivo: input.objetivo ?? null,
    diasPorSemana: input.diasPorSemana ?? null,
    perfil: perfilUsuario,
    tendencias,
    ejerciciosPorGrupo: popularExercisesByGroup,
    ejerciciosEntrenadores: popularExercisesByTrainers,
    catalogoReferencia: referenceCatalog,
  });

  const model = getGeminiModel();
  let rutinaGenerada: GeneratedRoutineProposal | null = null;
  let routineFromGemini = false;

  if (geminiConfigured) {
    try {
      const response = await generateGeminiContentWithRetry({
        model,
        promptSistema,
        promptUsuario,
      });

      const rawText = response.text;
      if (!rawText || !rawText.trim()) {
        throw new Error("Gemini no devolvio contenido para la rutina");
      }

      const parsed = parseGeminiJsonResponse(rawText);
      rutinaGenerada = normalizeGeneratedRoutineProposal(parsed, input);
      routineFromGemini = true;
    } catch (error) {
      console.warn("Gemini fallo; se usara rutina fallback", error);
    }
  }

  if (!rutinaGenerada) {
    rutinaGenerada = buildFallbackRoutineProposal(input, referenceCatalog);
  }

  try {
    return await persistGeneratedRoutine({
      input,
      geminiConfigured,
      model,
      perfilUsuario,
      tendencias,
      popularExercisesByGroup,
      popularExercisesByTrainers,
      referenceCatalog,
      promptSistema,
      promptUsuario,
      rutinaGenerada,
    });
  } catch (error) {
    if (!routineFromGemini) {
      throw error;
    }

    console.warn(
      "La rutina devuelta por Gemini no se pudo persistir; se intentara rutina fallback",
      error
    );

    const fallbackRoutine = buildFallbackRoutineProposal(input, referenceCatalog);

    try {
      return await persistGeneratedRoutine({
        input,
        geminiConfigured,
        model,
        perfilUsuario,
        tendencias,
        popularExercisesByGroup,
        popularExercisesByTrainers,
        referenceCatalog,
        promptSistema,
        promptUsuario,
        rutinaGenerada: fallbackRoutine,
      });
    } catch {
      throw new Error(
        "No se pudo crear una rutina valida de GymMaxxing ni con Gemini ni con el fallback."
      );
    }
  }
};
