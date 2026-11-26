import { pool } from "../db";
import { getTrends, getUsuarioPorId } from "./user.service";
import { getGeminiClient, getGeminiModel, isGeminiConfigured } from "./gemini.service";

export type GenerateRoutineDraftInput = {
  usuarioId: number;
  prompt: string;
  objetivo?: string;
  diasPorSemana?: number;
};

export type RoutineGenerationCreateResponse = {
  status: "routine_draft_ready";
  proveedor: "gemini";
  // "respaldo" = Gemini falló y la rutina se armó por reglas con el catálogo.
  origen: "gemini" | "respaldo";
  aviso: string | null;
  // Error técnico de Gemini (solo fuera de producción) para poder diagnosticar desde el panel.
  detalle_tecnico: string | null;
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
      imagen_url: string | null;
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
    ejercicios: ValidatedRoutineExercise[];
  };
  rutina_borrador: {
    nombre: string;
    descripcion: string | null;
    id_carpeta: number | null;
    visible_en_descubrir: boolean;
    duracion_estimada: number | null;
    ejercicios: Array<{
      id_ejercicio: number;
      series: number;
      repeticiones: number;
      descanso: number;
      orden: number;
      nombre: string;
      descripcion: string | null;
      grupo_muscular: string | null;
      tipo_disciplina: string | null;
      imagen_url: string | null;
    }>;
  };
  siguiente_paso: string;
};

// Ejercicio ya validado contra el catálogo real: todos los datos salen de la tabla `ejercicio`,
// nunca de lo que escribió Gemini (solo series/reps/descanso/orden vienen de la propuesta).
type ValidatedRoutineExercise = {
  id_ejercicio: number;
  nombre: string;
  grupo_muscular: string | null;
  tipo_disciplina: string | null;
  imagen_url: string | null;
  series: number;
  repeticiones: number;
  descanso: number;
  orden: number;
};

type ExerciseUsageRow = {
  id_ejercicio: number;
  nombre: string;
  grupo_muscular: string | null;
  tipo_disciplina: string | null;
  veces_usado_en_rutinas: number;
};

type CatalogExerciseRow = ExerciseUsageRow & {
  imagen_url: string | null;
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
  tipo_disciplina?: string | null;
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

const GEMINI_ROUTINE_DEBUG_PREFIX = "[GeminiRoutineDebug]";
const DEFAULT_GEMINI_MAX_OUTPUT_TOKENS = 8192;
// Se le pasa a Gemini el catálogo completo que el usuario puede usar (ejercicios globales + sus
// personalizados). Antes eran solo los 24 más usados, y si el pedido era de un grupo muscular que no
// aparecía ahí Gemini terminaba nombrando ejercicios que no existen en GymMaxxing.
const GEMINI_REFERENCE_CATALOG_LIMIT = 400;
// Si de la propuesta de Gemini sobreviven menos ejercicios válidos que esto, se usa el fallback.
const MIN_VALID_GENERATED_EXERCISES = 3;
const GEMINI_TREND_ROUTINES_LIMIT = 3;
const GEMINI_TREND_USERS_LIMIT = 3;
const GEMINI_POPULAR_EXERCISES_PER_GROUP_LIMIT = 2;
const GEMINI_TRAINER_EXERCISES_LIMIT = 6;

const readPositiveIntEnv = (key: string, fallback: number) => {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const isGeminiRoutineDebugEnabled = () => {
  const value = process.env.GEMINI_ROUTINE_DEBUG;
  return value === "1" || value?.toLowerCase() === "true";
};

const debugGeminiRoutine = (...args: Parameters<typeof console.warn>) => {
  if (isGeminiRoutineDebugEnabled()) {
    console.warn(...args);
  }
};

const getGeminiMaxOutputTokens = () =>
  readPositiveIntEnv("GEMINI_MAX_OUTPUT_TOKENS", DEFAULT_GEMINI_MAX_OUTPUT_TOKENS);

// Los modelos 2.5 "piensan" antes de responder y esos tokens cuentan dentro de maxOutputTokens.
// Con el catálogo completo en el prompt, el razonamiento se comía el límite y el JSON llegaba
// cortado (finishReason MAX_TOKENS), así que terminaba usándose la rutina de respaldo.
// Para armar una rutina con un catálogo cerrado no hace falta pensar: en los modelos flash lo apagamos.
// Se puede ajustar con GEMINI_THINKING_BUDGET (0 = sin razonamiento).
const getGeminiThinkingBudget = (model: string): number | null => {
  const raw = process.env.GEMINI_THINKING_BUDGET;
  if (raw != null && raw.trim() !== "") {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return model.toLowerCase().includes("flash") ? 0 : null;
};

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
  // Sin tildes ni mayúsculas, así "glúteos", "bíceps" o "Tríceps" matchean igual.
  const content = normalizeExerciseNameKey(`${prompt} ${objetivo ?? ""}`);
  const has = (...words: string[]) => words.some((word) => content.includes(word));

  if (has("push pull legs", "ppl") || (has("push") && has("pull") && has("legs"))) {
    return "push-pull-legs";
  }

  if (has("full body", "cuerpo completo", "fullbody")) {
    return "full-body";
  }

  if (has("upper", "torso", "tren superior")) {
    return "upper";
  }

  if (has("lower", "tren inferior")) {
    return "lower";
  }

  if (has("push")) {
    return "push";
  }

  if (has("pull")) {
    return "pull";
  }

  if (has("pierna", "gluteo", "cuadriceps", "isquio", "femoral", "gemelo", "pantorrilla", "legs")) {
    return "legs";
  }

  if (has("pecho", "triceps")) {
    return "chest-triceps";
  }

  if (has("espalda", "biceps", "dorsal")) {
    return "back-biceps";
  }

  if (has("hombro", "deltoide")) {
    return "shoulders";
  }

  if (has("brazo")) {
    return "arms";
  }

  if (has("core", "abdomen", "abdominal", "abs")) {
    return "core";
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

// Grupos del catálogo para cada estilo. `primary` son los grupos pedidos; `secondary` solo se usa si
// con los primarios no se llega al mínimo. Nunca se rellena con grupos que no tienen que ver.
type FallbackGroups = { primary: string[]; secondary: string[] };

const FALLBACK_GENERAL_GROUPS: FallbackGroups = {
  primary: ["Piernas", "Pecho", "Espalda", "Hombros", "Core"],
  secondary: [],
};

const FALLBACK_GROUPS: Record<string, FallbackGroups> = {
  "push-pull-legs": { primary: ["Pecho", "Espalda", "Piernas", "Hombros", "Triceps", "Biceps"], secondary: [] },
  "full-body": { primary: ["Piernas", "Pecho", "Espalda", "Hombros", "Core"], secondary: [] },
  upper: { primary: ["Pecho", "Espalda", "Hombros", "Biceps", "Triceps"], secondary: [] },
  lower: { primary: ["Piernas", "Gluteos"], secondary: ["Core"] },
  push: { primary: ["Pecho", "Hombros", "Triceps"], secondary: [] },
  pull: { primary: ["Espalda", "Biceps"], secondary: ["Hombros"] },
  legs: { primary: ["Piernas", "Gluteos"], secondary: ["Core"] },
  "chest-triceps": { primary: ["Pecho", "Triceps"], secondary: ["Hombros"] },
  "back-biceps": { primary: ["Espalda", "Biceps"], secondary: ["Hombros"] },
  shoulders: { primary: ["Hombros"], secondary: ["Triceps", "Core"] },
  arms: { primary: ["Biceps", "Triceps"], secondary: ["Hombros"] },
  core: { primary: ["Core"], secondary: [] },
  general: { primary: ["Piernas", "Pecho", "Espalda", "Hombros", "Core"], secondary: [] },
};

const FALLBACK_MIN_EXERCISES = 4;

// Reparte los lugares entre los grupos en ronda (1 de cada grupo, después el 2° de cada uno, etc.),
// respetando el orden del catálogo, que viene de más a menos usado.
const pickExercisesRoundRobin = (
  catalog: CatalogExercise[],
  groups: string[],
  maxExercises: number,
  usedIds: Set<number>
) => {
  const queues = groups.map((group) => {
    const key = normalizeExerciseNameKey(group);
    return catalog.filter(
      (exercise) =>
        normalizeExerciseNameKey(exercise.grupo_muscular) === key &&
        !usedIds.has(exercise.id_ejercicio)
    );
  });

  const picked: CatalogExercise[] = [];
  let added = true;
  while (picked.length < maxExercises && added) {
    added = false;
    for (const queue of queues) {
      const next = queue.shift();
      if (!next || usedIds.has(next.id_ejercicio)) {
        continue;
      }
      usedIds.add(next.id_ejercicio);
      picked.push(next);
      added = true;
      if (picked.length >= maxExercises) {
        break;
      }
    }
  }

  return picked;
};

const pickFallbackExercises = (
  catalog: CatalogExercise[],
  style: string,
  maxExercises: number
) => {
  const groups = FALLBACK_GROUPS[style] ?? FALLBACK_GENERAL_GROUPS;
  const usedIds = new Set<number>();
  const picked = pickExercisesRoundRobin(catalog, groups.primary, maxExercises, usedIds);

  if (picked.length < FALLBACK_MIN_EXERCISES && groups.secondary.length > 0) {
    picked.push(
      ...pickExercisesRoundRobin(
        catalog,
        groups.secondary,
        FALLBACK_MIN_EXERCISES - picked.length,
        usedIds
      )
    );
  }

  // Último recurso (catálogo casi vacío para esos grupos): lo más usado en general.
  if (picked.length === 0) {
    return catalog.slice(0, maxExercises);
  }

  return picked;
};

const buildFallbackRoutineProposal = (
  input: GenerateRoutineDraftInput,
  catalog: CatalogExercise[]
): GeneratedRoutineProposal => {
  const style = getRequestedRoutineStyle(input.prompt, input.objetivo);
  const objective = getFallbackObjective(input);

  const maxExercises =
    style === "push-pull-legs" || style === "full-body" || style === "upper" ? 7 : 6;
  const selectedExercises = pickFallbackExercises(catalog, style, maxExercises);

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
    "back-biceps": "Espalda y Bíceps",
    shoulders: "Hombros",
    arms: "Brazos",
    core: "Core",
    general: "General",
  };

  return {
    nombre: `Rutina de ${styleLabelMap[style] ?? "General"}`,
    descripcion:
      "Rutina básica armada con los ejercicios del catálogo de GymMaxxing.",
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
    "Tomá como referencia los patrones observados en rutinas populares, guardadas o copiadas.",
    "Debes responder unicamente JSON valido siguiendo exactamente el schema solicitado.",
    "No agregues markdown, comentarios ni texto fuera del JSON.",
    "REGLA ESTRICTA: solo podes usar ejercicios del catalogo de GymMaxxing que se te pasa.",
    "Cada ejercicio debe llevar el id_ejercicio y el nombre EXACTOS de una linea del catalogo.",
    "Nunca inventes ejercicios, variantes ni nombres nuevos: si algo no esta en el catalogo, elegi el ejercicio del catalogo mas parecido.",
    "No repitas el mismo id_ejercicio dentro de la rutina.",
    "Genera entre 4 y 8 ejercicios como maximo, salvo que el pedido exija algo mas corto.",
    "Manten nombres, descripciones y advertencias breves para evitar respuestas innecesariamente largas.",
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
    "CATALOGO DE EJERCICIOS DE GYMMAXXING (unicos ejercicios permitidos; formato: id | nombre | grupo | disciplina):",
    ...payload.catalogoReferencia.map(
      (exercise) =>
        `${exercise.id_ejercicio} | ${exercise.nombre} | ${exercise.grupo_muscular ?? "sin grupo"} | ${exercise.tipo_disciplina ?? "sin disciplina"}`
    ),
    "",
    "Genera una propuesta de rutina alineada con GymMaxxing.",
    "Usa entre 4 y 8 ejercicios en total, todos sacados del CATALOGO de arriba con su id y nombre exactos.",
    "Manten la descripcion y las advertencias cortas.",
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
      maxLength: 180,
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
      maxItems: 3,
      description: "Advertencias o aclaraciones breves.",
    },
    ejercicios: {
      type: "array",
      minItems: 4,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          id_ejercicio: {
            type: "integer",
            description: "ID real del ejercicio, copiado del catalogo de GymMaxxing.",
          },
          nombre: {
            type: "string",
            description: "Nombre exacto del ejercicio tal como figura en el catalogo.",
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
          maxOutputTokens: getGeminiMaxOutputTokens(),
          ...(() => {
            const thinkingBudget = getGeminiThinkingBudget(params.model);
            return thinkingBudget == null ? {} : { thinkingConfig: { thinkingBudget } };
          })(),
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

const parseGeminiJsonResponse = (rawText: string) => {
  const trimmed = rawText.trim();

  debugGeminiRoutine(`${GEMINI_ROUTINE_DEBUG_PREFIX} parseGeminiJsonResponse input`, {
    rawLength: rawText.length,
    trimmedLength: trimmed.length,
    startsWith: trimmed.slice(0, 80),
    endsWith: trimmed.slice(-80),
  });
  debugGeminiRoutine(`${GEMINI_ROUTINE_DEBUG_PREFIX} parseGeminiJsonResponse raw input START\n${rawText}\n${GEMINI_ROUTINE_DEBUG_PREFIX} parseGeminiJsonResponse raw input END`);

  try {
    return JSON.parse(trimmed);
  } catch (directParseError) {
    debugGeminiRoutine(`${GEMINI_ROUTINE_DEBUG_PREFIX} direct JSON.parse failed`, directParseError);
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
    } catch (recoveryParseError) {
      debugGeminiRoutine(`${GEMINI_ROUTINE_DEBUG_PREFIX} recovery JSON.parse failed`, recoveryParseError);
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

// Valida la propuesta contra el catálogo permitido. Solo se aceptan ejercicios cuyo id exista en el
// catálogo (o, si Gemini erró el id, cuyo nombre coincida exactamente con uno del catálogo).
// Lo que no matchea se descarta: nunca se crean ejercicios nuevos ni se "adivina" por parecido.
const validateExercisesAgainstCatalog = (
  ejercicios: GeneratedRoutineExercise[],
  catalog: CatalogExercise[]
): ValidatedRoutineExercise[] => {
  if (catalog.length === 0) {
    throw new Error("No hay ejercicios cargados en GymMaxxing para generar rutinas con Gemini");
  }

  const byId = new Map(catalog.map((row) => [row.id_ejercicio, row] as const));
  const byName = new Map(
    catalog.map((row) => [normalizeExerciseNameKey(row.nombre), row] as const)
  );

  const seenIds = new Set<number>();
  const validated: ValidatedRoutineExercise[] = [];
  const discarded: string[] = [];

  [...ejercicios]
    .sort((a, b) => a.orden - b.orden)
    .forEach((exercise) => {
      const matched =
        byId.get(exercise.id_ejercicio) ??
        byName.get(normalizeExerciseNameKey(exercise.nombre));

      if (!matched) {
        discarded.push(`${exercise.nombre} [id ${exercise.id_ejercicio}]`);
        return;
      }

      if (seenIds.has(matched.id_ejercicio)) {
        return;
      }

      seenIds.add(matched.id_ejercicio);
      validated.push({
        id_ejercicio: matched.id_ejercicio,
        nombre: matched.nombre,
        grupo_muscular: matched.grupo_muscular,
        tipo_disciplina: matched.tipo_disciplina,
        imagen_url: matched.imagen_url ?? null,
        series: parsePositiveInteger(exercise.series, 3),
        repeticiones: parsePositiveInteger(exercise.repeticiones, 10),
        descanso: Math.max(0, Number(exercise.descanso) || 0),
        orden: validated.length + 1,
      });
    });

  if (discarded.length > 0) {
    console.warn(
      "Gemini propuso ejercicios que no existen en el catalogo; se descartaron:",
      discarded
    );
  }

  if (validated.length < Math.min(MIN_VALID_GENERATED_EXERCISES, ejercicios.length || 1)) {
    throw new Error("La rutina generada no contiene ejercicios validos");
  }

  return validated;
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
         AND COALESCE(e.es_personalizado, FALSE) = FALSE
       GROUP BY e.grupo_muscular, e.id_ejercicio, e.nombre, e.tipo_disciplina
     )
     SELECT grupo_muscular,
            id_ejercicio,
            nombre,
            tipo_disciplina,
            veces_usado_en_rutinas,
            ranking
     FROM ranked
     WHERE ranking <= $1
     ORDER BY grupo_muscular ASC, ranking ASC`,
    [GEMINI_POPULAR_EXERCISES_PER_GROUP_LIMIT]
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
       AND COALESCE(e.es_personalizado, FALSE) = FALSE
     GROUP BY e.id_ejercicio, e.nombre, e.grupo_muscular, e.tipo_disciplina
     ORDER BY veces_usado_por_entrenadores DESC, e.nombre ASC
     LIMIT $1`,
    [GEMINI_TRAINER_EXERCISES_LIMIT]
  );

  return result.rows;
};

// Catálogo que el usuario ve en su lista de ejercicios: los globales + sus personalizados.
// Nunca incluye ejercicios personalizados de otros usuarios.
const getAllowedExerciseCatalog = async (usuarioId: number) => {
  const result = await pool.query<CatalogExerciseRow>(
    `SELECT e.id_ejercicio,
            e.nombre,
            e.grupo_muscular,
            e.tipo_disciplina,
            e.imagen_url,
            COUNT(re.id_rutina)::int AS veces_usado_en_rutinas
     FROM ejercicio e
     LEFT JOIN rutinaejercicio re ON re.id_ejercicio = e.id_ejercicio
     WHERE COALESCE(e.es_personalizado, FALSE) = FALSE
        OR e.creador_id = $1
     GROUP BY e.id_ejercicio, e.nombre, e.grupo_muscular, e.tipo_disciplina, e.imagen_url
     ORDER BY veces_usado_en_rutinas DESC, e.nombre ASC
     LIMIT $2`,
    [usuarioId, GEMINI_REFERENCE_CATALOG_LIMIT]
  );

  return result.rows.map((row) => ({
    ...row,
    imagen_url: row.imagen_url ?? null,
  }));
};

const buildGeneratedRoutineDraftResponse = async (params: {
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
  origen: "gemini" | "respaldo";
  aviso: string | null;
  detalleTecnico?: string | null;
}) => {
  const ejerciciosValidados = validateExercisesAgainstCatalog(
    params.rutinaGenerada.ejercicios,
    params.referenceCatalog
  );

  return {
    status: "routine_draft_ready" as const,
    proveedor: "gemini" as const,
    origen: params.origen,
    aviso: params.aviso,
    detalle_tecnico:
      process.env.NODE_ENV === "production" ? null : params.detalleTecnico ?? null,
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
    rutina_borrador: {
      nombre: params.rutinaGenerada.nombre,
      descripcion: params.rutinaGenerada.descripcion,
      id_carpeta: null,
      visible_en_descubrir: true,
      duracion_estimada: params.rutinaGenerada.duracion_estimada,
      ejercicios: ejerciciosValidados.map((exercise) => ({
        id_ejercicio: exercise.id_ejercicio,
        series: exercise.series,
        repeticiones: exercise.repeticiones,
        descanso: exercise.descanso,
        orden: exercise.orden,
        nombre: exercise.nombre,
        descripcion: null,
        grupo_muscular: exercise.grupo_muscular,
        tipo_disciplina: exercise.tipo_disciplina ?? null,
        imagen_url: exercise.imagen_url,
      })),
    },
    siguiente_paso:
      "La rutina quedo preparada como borrador en GymMaxxing y se guardara solo si el usuario confirma.",
  };
};

// Mensaje corto para mostrarle al usuario cuando se usó la rutina de respaldo.
const describeGeminiFailure = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("API_KEY_INVALID") ||
    message.includes("API key not valid") ||
    message.includes("PERMISSION_DENIED")
  ) {
    return "La API key de Gemini no es válida (revisá GEMINI_API_KEY en backend/.env), así que armamos una rutina básica con tu catálogo.";
  }
  if (
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes('"code":429') ||
    message.toLowerCase().includes("quota")
  ) {
    return "Gemini llegó al límite de uso de la API key, así que armamos una rutina básica con tu catálogo.";
  }
  if (isRetryableGeminiError(error)) {
    return "Gemini no respondió a tiempo, así que armamos una rutina básica con tu catálogo.";
  }
  return "Gemini devolvió una respuesta que no pudimos usar, así que armamos una rutina básica con tu catálogo.";
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
      getAllowedExerciseCatalog(input.usuarioId),
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
    rutinas_mas_copiadas: trends.rutinas_mas_copiadas.slice(0, GEMINI_TREND_ROUTINES_LIMIT).map((routine) => ({
      id_rutina: routine.id_rutina,
      nombre: routine.nombre,
      duracion_estimada: routine.duracion_estimada,
      total_ejercicios: routine.total_ejercicios,
      grupos_musculares: routine.grupos_musculares,
      creador_username: routine.creador_username,
      creador_tipo_usuario: routine.creador_tipo_usuario,
      copy_count: routine.copy_count,
    })),
    rutinas_mas_guardadas: trends.rutinas_mas_guardadas.slice(0, GEMINI_TREND_ROUTINES_LIMIT).map((routine) => ({
      id_rutina: routine.id_rutina,
      nombre: routine.nombre,
      duracion_estimada: routine.duracion_estimada,
      total_ejercicios: routine.total_ejercicios,
      grupos_musculares: routine.grupos_musculares,
      creador_username: routine.creador_username,
      creador_tipo_usuario: routine.creador_tipo_usuario,
      save_count: routine.save_count,
    })),
    usuarios_mas_seguidos: trends.usuarios_mas_seguidos.slice(0, GEMINI_TREND_USERS_LIMIT).map((user) => ({
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

  debugGeminiRoutine(`${GEMINI_ROUTINE_DEBUG_PREFIX} context summary`, {
    usuarioId: input.usuarioId,
    geminiConfigured,
    maxOutputTokens: getGeminiMaxOutputTokens(),
    catalogoReferenciaCount: referenceCatalog.length,
    catalogoReferenciaKeys: Object.keys(referenceCatalog[0] ?? {}),
    popularExercisesByGroupCount: popularExercisesByGroup.length,
    popularExercisesByTrainersCount: popularExercisesByTrainers.length,
    rutinasMasCopiadasCount: tendencias.rutinas_mas_copiadas.length,
    rutinasMasGuardadasCount: tendencias.rutinas_mas_guardadas.length,
    promptSistemaLength: promptSistema.length,
    promptUsuarioLength: promptUsuario.length,
    promptTotalLength: promptSistema.length + promptUsuario.length,
    includesImagenUrl: promptUsuario.includes("imagen_url"),
    includesUploadsPath: promptUsuario.includes("/uploads/"),
    includesMp4: promptUsuario.toLowerCase().includes(".mp4"),
    includesGif: promptUsuario.toLowerCase().includes(".gif"),
  });
  debugGeminiRoutine(`${GEMINI_ROUTINE_DEBUG_PREFIX} final system prompt START\n${promptSistema}\n${GEMINI_ROUTINE_DEBUG_PREFIX} final system prompt END`);
  debugGeminiRoutine(`${GEMINI_ROUTINE_DEBUG_PREFIX} final user prompt START\n${promptUsuario}\n${GEMINI_ROUTINE_DEBUG_PREFIX} final user prompt END`);

  const model = getGeminiModel();
  let rutinaGenerada: GeneratedRoutineProposal | null = null;
  let routineFromGemini = false;
  let avisoRespaldo: string | null = null;
  let detalleRespaldo: string | null = null;

  if (geminiConfigured) {
    try {
      const response = await generateGeminiContentWithRetry({
        model,
        promptSistema,
        promptUsuario,
      });

      const rawText = response.text;
      const responseDebug = response as unknown as {
        candidates?: Array<{
          finishReason?: string;
          finishMessage?: string;
          content?: unknown;
        }>;
        usageMetadata?: unknown;
        promptFeedback?: unknown;
      };
      debugGeminiRoutine(`${GEMINI_ROUTINE_DEBUG_PREFIX} raw Gemini response metadata`, {
        rawTextLength: rawText?.length ?? 0,
        candidates: responseDebug.candidates?.map((candidate) => ({
          finishReason: candidate.finishReason,
          finishMessage: candidate.finishMessage,
        })),
        usageMetadata: responseDebug.usageMetadata,
        promptFeedback: responseDebug.promptFeedback,
      });
      debugGeminiRoutine(`${GEMINI_ROUTINE_DEBUG_PREFIX} raw Gemini text START\n${rawText ?? ""}\n${GEMINI_ROUTINE_DEBUG_PREFIX} raw Gemini text END`);
      const finishReason = responseDebug.candidates?.[0]?.finishReason;
      if (finishReason === "MAX_TOKENS") {
        throw new Error(
          "Gemini corto la respuesta por limite de tokens (MAX_TOKENS). Subi GEMINI_MAX_OUTPUT_TOKENS."
        );
      }
      if (!rawText || !rawText.trim()) {
        throw new Error(
          `Gemini no devolvio contenido para la rutina (finishReason: ${finishReason ?? "desconocido"})`
        );
      }

      const parsed = parseGeminiJsonResponse(rawText);
      rutinaGenerada = normalizeGeneratedRoutineProposal(parsed, input);
      routineFromGemini = true;
    } catch (error) {
      console.warn(
        "[Gemini] fallo la generacion; se usa la rutina de respaldo. Motivo:",
        error instanceof Error ? error.message : error
      );
      avisoRespaldo = describeGeminiFailure(error);
      detalleRespaldo = (error instanceof Error ? error.message : String(error)).slice(0, 600);
    }
  } else {
    avisoRespaldo = "Gemini no está configurado en el backend (falta GEMINI_API_KEY).";
  }

  if (!rutinaGenerada) {
    rutinaGenerada = buildFallbackRoutineProposal(input, referenceCatalog);
  }

  try {
    return await buildGeneratedRoutineDraftResponse({
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
      origen: routineFromGemini ? "gemini" : "respaldo",
      aviso: routineFromGemini ? null : avisoRespaldo,
      detalleTecnico: routineFromGemini ? null : detalleRespaldo,
    });
  } catch (error) {
    if (!routineFromGemini) {
      throw error;
    }

    console.warn(
      "[Gemini] la propuesta no tenia suficientes ejercicios del catalogo; se usa la rutina de respaldo.",
      error instanceof Error ? error.message : error
    );

    const fallbackRoutine = buildFallbackRoutineProposal(input, referenceCatalog);

    try {
      return await buildGeneratedRoutineDraftResponse({
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
        origen: "respaldo",
        aviso:
          "Gemini propuso ejercicios que no están en tu biblioteca, así que armamos una rutina básica con tu catálogo.",
        detalleTecnico: error instanceof Error ? error.message : String(error),
      });
    } catch {
      throw new Error(
        "No se pudo preparar una rutina valida de GymMaxxing ni con Gemini ni con el fallback."
      );
    }
  }
};
