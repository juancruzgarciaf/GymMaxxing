import { pool } from "../db";
import { getTrends, getUsuarioPorId } from "./user.service";
import { getGeminiModel, isGeminiConfigured } from "./gemini.service";

export type GenerateRoutineDraftInput = {
  usuarioId: number;
  prompt: string;
  objetivo?: string;
  diasPorSemana?: number;
};

export type RoutineGenerationDraftResponse = {
  status: "prompt_ready";
  proveedor: "gemini";
  usuario_id: number;
  gemini_configurado: boolean;
  modelo_sugerido: string;
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

const buildSystemPrompt = () =>
  [
    "Sos Gemini integrado en GymMaxxing como motor de generacion de rutinas.",
    "No respondas como chatbot conversacional ni expliques de mas.",
    "Tu tarea es generar una propuesta de rutina personalizada usando el perfil del usuario y datos reales de la plataforma.",
    "Prioriza ejercicios existentes en GymMaxxing y patrones observados en rutinas populares, guardadas o copiadas.",
    "No inventes ejercicios fuera del catalogo de referencia si hay equivalentes disponibles.",
    "Todavia no devuelvas texto libre final para usuario: la siguiente etapa te pedira JSON estructurado.",
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
  tendencias: RoutineGenerationDraftResponse["contexto"]["tendencias_plataforma"];
  ejerciciosPorGrupo: RoutineGenerationDraftResponse["contexto"]["ejercicios_populares_por_grupo"];
  ejerciciosEntrenadores: RoutineGenerationDraftResponse["contexto"]["ejercicios_populares_de_entrenadores"];
  catalogoReferencia: RoutineGenerationDraftResponse["contexto"]["catalogo_referencia"];
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
    "Usa este contexto para preparar una rutina alineada con GymMaxxing y lista para convertirse luego en JSON estructurado.",
  ];

  return lines.join("\n");
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
    RoutineGenerationDraftResponse["contexto"]["ejercicios_populares_por_grupo"][number]["ejercicios"]
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

export const generateRoutineDraftFromPrompt = async (
  input: GenerateRoutineDraftInput
): Promise<RoutineGenerationDraftResponse> => {
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

  return {
    status: "prompt_ready",
    proveedor: "gemini",
    usuario_id: input.usuarioId,
    gemini_configurado: geminiConfigured,
    modelo_sugerido: getGeminiModel(),
    solicitud_usuario: {
      prompt: input.prompt,
      objetivo: input.objetivo ?? null,
      dias_por_semana: input.diasPorSemana ?? null,
    },
    contexto: {
      perfil_usuario: perfilUsuario,
      tendencias_plataforma: tendencias,
      ejercicios_populares_por_grupo: popularExercisesByGroup,
      ejercicios_populares_de_entrenadores: popularExercisesByTrainers,
      catalogo_referencia: referenceCatalog,
    },
    prompt_sistema: promptSistema,
    prompt_usuario: promptUsuario,
    siguiente_paso:
      "Etapa 5: pedirle a Gemini una respuesta en JSON estructurado para convertirla en rutina real.",
  };
};
