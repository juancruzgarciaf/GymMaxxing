import { pool } from "../db";

type UsuarioRow = {
  id: number;
  username: string;
  email: string;
  password?: string;
  edad: number | null;
  peso: number | null;
  altura: number | null;
  genero: string | null;
  nacionalidad: string | null;
  nivel_entrenamiento: string | null;
  objetivo_entrenamiento: string | null;
  tipo_usuario: string;
};

type BasicUserRow = {
  id: number;
  username: string;
  email: string;
  tipo_usuario: string;
};

type GymDaySchedule = {
  abierto: boolean;
  apertura: string;
  cierre: string;
};

type GymHolidaySchedule = {
  activo: boolean;
  nota: string;
  apertura: string;
  cierre: string;
};

export type GymProfileData = {
  nombre_gimnasio: string | null;
  telefono: string | null;
  sitio_web: string | null;
  instagram: string | null;
  descripcion_corta: string | null;
  tipo_gimnasio: string | null;
  direccion: string | null;
  ciudad: string | null;
  provincia: string | null;
  pais: string | null;
  google_maps_url: string | null;
  horarios: Record<string, GymDaySchedule>;
  horarios_feriados: GymHolidaySchedule;
  servicios: string[];
};

type GymProfileRow = Omit<GymProfileData, "horarios" | "horarios_feriados"> & {
  horarios: Record<string, GymDaySchedule> | null;
  horarios_feriados: GymHolidaySchedule | null;
};

type RutinaMetricSupport = {
  has_save: boolean;
  has_copy: boolean;
  has_like: boolean;
};

type TrendRoutineRow = {
  id_rutina: number;
  nombre: string;
  descripcion: string | null;
  duracion_estimada: number | null;
  fecha_creacion: string | null;
  creador_id: number;
  id_carpeta: number | null;
  save_count: number;
  copy_count: number;
  creador_username: string;
  creador_tipo_usuario: string;
  total_ejercicios: number;
  grupos_musculares: string[];
};

type TrendUserRow = BasicUserRow & {
  followers_count: number;
  following_count: number;
  trainings_count: number;
  viewer_follows?: boolean;
};

type SuggestedUserRow = TrendUserRow & {
  mutual_following_count: number;
};

type UserTrainingSearchFilters = {
  q?: string;
  gruposMusculares?: string[];
  tiposDisciplina?: string[];
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
};

type SessionSummaryRow = {
  id_sesion: number;
  usuario_id: number;
  username: string;
  tipo_usuario: string;
  rutina_id: number | null;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  fecha_actividad: string | null;
  duracion_segundos: number | null;
  volumen_total: number | null;
  total_series: number;
  total_ejercicios: number;
  total_trofeos: number;
  likes_count: number;
  comments_count: number;
  viewer_liked: boolean;
};

type ExercisePreviewRow = {
  sesion_id: number;
  nombre: string;
  series: number;
};

type RoutinePostSummaryRow = {
  content_type: "routine";
  id_rutina: number;
  usuario_id: number;
  username: string;
  tipo_usuario: string;
  titulo: string;
  descripcion: string | null;
  duracion_estimada: number | null;
  fecha_actividad: string | null;
  total_series: number;
  total_ejercicios: number;
  save_count: number;
  copy_count: number;
  likes_count: number;
  viewer_liked: boolean;
  ejercicios_preview: Array<{
    nombre: string;
    series: number;
    grupo_muscular: string | null;
  }>;
};

type RoutinePostRow = Omit<RoutinePostSummaryRow, "content_type" | "ejercicios_preview">;

type RoutineExercisePreviewRow = {
  id_rutina: number;
  nombre: string;
  series: number;
  grupo_muscular: string | null;
};

const sanitizeUser = (user: UsuarioRow | BasicUserRow) => {
  const { password: _password, ...safeUser } = user as UsuarioRow;
  return safeUser;
};

let trophyTablesReady = false;
let gymProfileTableReady = false;

const ensureTrophyTables = async () => {
  if (trophyTablesReady) {
    return;
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS serie_record_trofeo (
       id_trofeo SERIAL PRIMARY KEY,
       sesion_id INT NOT NULL,
       usuario_id INT NOT NULL,
       ejercicio_id INT NOT NULL,
       orden INT NOT NULL,
       tipo_record VARCHAR(20) NOT NULL,
       valor_anterior DOUBLE PRECISION NOT NULL DEFAULT 0,
       valor_nuevo DOUBLE PRECISION NOT NULL,
       fecha TIMESTAMP DEFAULT NOW(),
       UNIQUE (sesion_id, ejercicio_id, orden, tipo_record)
     )`
  );

  trophyTablesReady = true;
};

const DEFAULT_GYM_SCHEDULE: Record<string, GymDaySchedule> = {
  lunes: { abierto: true, apertura: "07:00", cierre: "22:00" },
  martes: { abierto: true, apertura: "07:00", cierre: "22:00" },
  miercoles: { abierto: true, apertura: "07:00", cierre: "22:00" },
  jueves: { abierto: true, apertura: "07:00", cierre: "22:00" },
  viernes: { abierto: true, apertura: "07:00", cierre: "22:00" },
  sabado: { abierto: true, apertura: "09:00", cierre: "18:00" },
  domingo: { abierto: false, apertura: "09:00", cierre: "14:00" },
};

const DEFAULT_GYM_HOLIDAYS: GymHolidaySchedule = {
  activo: false,
  nota: "",
  apertura: "09:00",
  cierre: "14:00",
};

const ensureGymProfileTable = async () => {
  if (gymProfileTableReady) {
    return;
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS gimnasio_perfil (
       usuario_id INT PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
       nombre_gimnasio TEXT,
       telefono TEXT,
       sitio_web TEXT,
       instagram TEXT,
       descripcion_corta TEXT,
       tipo_gimnasio TEXT,
       direccion TEXT,
       ciudad TEXT,
       provincia TEXT,
       pais TEXT,
       google_maps_url TEXT,
       horarios JSONB NOT NULL DEFAULT '{}'::jsonb,
       horarios_feriados JSONB NOT NULL DEFAULT '{}'::jsonb,
       servicios TEXT[] NOT NULL DEFAULT '{}',
       fecha_actualizacion TIMESTAMP DEFAULT NOW()
     )`
  );

  gymProfileTableReady = true;
};

const isGymRole = (role: string | null | undefined) =>
  (role ?? "").trim().toLowerCase() === "gimnasio";

const normalizeGymProfile = (
  row: GymProfileRow | null | undefined,
  fallbackName: string
): GymProfileData => ({
  nombre_gimnasio: row?.nombre_gimnasio ?? fallbackName,
  telefono: row?.telefono ?? null,
  sitio_web: row?.sitio_web ?? null,
  instagram: row?.instagram ?? null,
  descripcion_corta: row?.descripcion_corta ?? null,
  tipo_gimnasio: row?.tipo_gimnasio ?? null,
  direccion: row?.direccion ?? null,
  ciudad: row?.ciudad ?? null,
  provincia: row?.provincia ?? null,
  pais: row?.pais ?? null,
  google_maps_url: row?.google_maps_url ?? null,
  horarios: row?.horarios ?? DEFAULT_GYM_SCHEDULE,
  horarios_feriados: row?.horarios_feriados ?? DEFAULT_GYM_HOLIDAYS,
  servicios: row?.servicios ?? [],
});

const getGymProfile = async (userId: number, fallbackName: string) => {
  await ensureGymProfileTable();

  const result = await pool.query<GymProfileRow>(
    `SELECT nombre_gimnasio,
            telefono,
            sitio_web,
            instagram,
            descripcion_corta,
            tipo_gimnasio,
            direccion,
            ciudad,
            provincia,
            pais,
            google_maps_url,
            horarios,
            horarios_feriados,
            servicios
     FROM gimnasio_perfil
     WHERE usuario_id = $1`,
    [userId]
  );

  return normalizeGymProfile(result.rows[0], fallbackName);
};

const upsertGymProfile = async (
  userId: number,
  data: Partial<GymProfileData>,
  fallbackName: string
) => {
  await ensureGymProfileTable();

  const normalized = normalizeGymProfile(data as GymProfileRow, fallbackName);

  await pool.query(
    `INSERT INTO gimnasio_perfil (
       usuario_id,
       nombre_gimnasio,
       telefono,
       sitio_web,
       instagram,
       descripcion_corta,
       tipo_gimnasio,
       direccion,
       ciudad,
       provincia,
       pais,
       google_maps_url,
       horarios,
       horarios_feriados,
       servicios
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15::text[])
     ON CONFLICT (usuario_id)
     DO UPDATE SET
       nombre_gimnasio = EXCLUDED.nombre_gimnasio,
       telefono = EXCLUDED.telefono,
       sitio_web = EXCLUDED.sitio_web,
       instagram = EXCLUDED.instagram,
       descripcion_corta = EXCLUDED.descripcion_corta,
       tipo_gimnasio = EXCLUDED.tipo_gimnasio,
       direccion = EXCLUDED.direccion,
       ciudad = EXCLUDED.ciudad,
       provincia = EXCLUDED.provincia,
       pais = EXCLUDED.pais,
       google_maps_url = EXCLUDED.google_maps_url,
       horarios = EXCLUDED.horarios,
       horarios_feriados = EXCLUDED.horarios_feriados,
       servicios = EXCLUDED.servicios,
       fecha_actualizacion = NOW()`,
    [
      userId,
      normalized.nombre_gimnasio,
      normalized.telefono,
      normalized.sitio_web,
      normalized.instagram,
      normalized.descripcion_corta,
      normalized.tipo_gimnasio,
      normalized.direccion,
      normalized.ciudad,
      normalized.provincia,
      normalized.pais,
      normalized.google_maps_url,
      JSON.stringify(normalized.horarios),
      JSON.stringify(normalized.horarios_feriados),
      normalized.servicios,
    ]
  );

  return getGymProfile(userId, fallbackName);
};

const getRutinaMetricsSupport = async (): Promise<RutinaMetricSupport> => {
  const result = await pool.query<RutinaMetricSupport>(
    `SELECT
       to_regclass('public.rutina_guardado') IS NOT NULL AS has_save,
       to_regclass('public.rutina_copia') IS NOT NULL AS has_copy,
       to_regclass('public.rutina_like') IS NOT NULL AS has_like`
  );

  return (
    result.rows[0] ?? {
      has_save: false,
      has_copy: false,
      has_like: false,
    }
  );
};

const getExercisePreviewMap = async (sessionIds: number[]) => {
  if (sessionIds.length === 0) {
    return new Map<number, Array<{ nombre: string; series: number }>>();
  }

  const result = await pool.query<ExercisePreviewRow>(
    `WITH ejercicios_resumen AS (
       SELECT s.sesion_id,
              e.id_ejercicio,
              e.nombre,
              COUNT(*)::int AS series,
              MIN(s.orden) AS primer_orden
       FROM serie s
       JOIN ejercicio e ON e.id_ejercicio = s.ejercicio_id
       WHERE s.sesion_id = ANY($1::int[])
       GROUP BY s.sesion_id, e.id_ejercicio, e.nombre
     ),
     ejercicios_rankeados AS (
       SELECT *,
              ROW_NUMBER() OVER (
                PARTITION BY sesion_id
                ORDER BY primer_orden ASC, id_ejercicio ASC
              ) AS posicion
       FROM ejercicios_resumen
     )
     SELECT sesion_id, nombre, series
     FROM ejercicios_rankeados
     WHERE posicion <= 3
     ORDER BY sesion_id ASC, posicion ASC`,
    [sessionIds]
  );

  const previewMap = new Map<number, Array<{ nombre: string; series: number }>>();

  result.rows.forEach((row) => {
    const current = previewMap.get(row.sesion_id) ?? [];
    current.push({
      nombre: row.nombre,
      series: row.series,
    });
    previewMap.set(row.sesion_id, current);
  });

  return previewMap;
};

const buildSessionsWithPreview = async (sessions: SessionSummaryRow[]) => {
  const previewMap = await getExercisePreviewMap(
    sessions.map((session) => session.id_sesion)
  );

  return sessions.map((session) => ({
    ...session,
    ejercicios_preview: previewMap.get(session.id_sesion) ?? [],
  }));
};

const getRoutineExercisePreviewMap = async (routineIds: number[]) => {
  if (routineIds.length === 0) {
    return new Map<number, Array<{ nombre: string; series: number; grupo_muscular: string | null }>>();
  }

  const result = await pool.query<RoutineExercisePreviewRow>(
    `WITH ejercicios_rankeados AS (
       SELECT re.id_rutina,
              e.nombre,
              re.series,
              e.grupo_muscular,
              ROW_NUMBER() OVER (
                PARTITION BY re.id_rutina
                ORDER BY re.orden ASC, e.id_ejercicio ASC
              ) AS posicion
       FROM rutinaejercicio re
       JOIN ejercicio e ON e.id_ejercicio = re.id_ejercicio
       WHERE re.id_rutina = ANY($1::int[])
     )
     SELECT id_rutina, nombre, series, grupo_muscular
     FROM ejercicios_rankeados
     WHERE posicion <= 3
     ORDER BY id_rutina ASC, posicion ASC`,
    [routineIds]
  );

  const previewMap = new Map<number, Array<{ nombre: string; series: number; grupo_muscular: string | null }>>();

  result.rows.forEach((row) => {
    const current = previewMap.get(row.id_rutina) ?? [];
    current.push({
      nombre: row.nombre,
      series: row.series,
      grupo_muscular: row.grupo_muscular,
    });
    previewMap.set(row.id_rutina, current);
  });

  return previewMap;
};

const buildRoutinePostsWithPreview = async (routines: RoutinePostRow[]) => {
  const previewMap = await getRoutineExercisePreviewMap(
    routines.map((routine) => routine.id_rutina)
  );

  return routines.map((routine) => ({
    content_type: "routine" as const,
    ...routine,
    ejercicios_preview: previewMap.get(routine.id_rutina) ?? [],
  }));
};

const getRoutinePostSummaries = async (
  whereClause: string,
  params: Array<number | string | string[]>,
  limit: number,
  offset = 0
) => {
  const support = await getRutinaMetricsSupport();
  const finalParams = [...params, limit, offset];
  const limitParam = finalParams.length - 1;
  const offsetParam = finalParams.length;

  const result = await pool.query<RoutinePostRow>(
    `SELECT r.id_rutina,
            r.creador_id AS usuario_id,
            u.username,
            u.tipo_usuario,
            r.nombre AS titulo,
            r.descripcion,
            r.duracion_estimada,
            r.fecha_creacion::text AS fecha_actividad,
            COALESCE((
              SELECT SUM(re.series)::int
              FROM rutinaejercicio re
              WHERE re.id_rutina = r.id_rutina
            ), 0) AS total_series,
            (
              SELECT COUNT(*)::int
              FROM rutinaejercicio re
              WHERE re.id_rutina = r.id_rutina
            ) AS total_ejercicios,
            ${
              support.has_save
                ? `(SELECT COUNT(*)::int FROM rutina_guardado rg WHERE rg.rutina_id = r.id_rutina)`
                : `0::int`
            } AS save_count,
            ${
              support.has_copy
                ? `(SELECT COUNT(*)::int FROM rutina_copia rc WHERE rc.rutina_id = r.id_rutina)`
                : `0::int`
            } AS copy_count,
            ${
              support.has_like
                ? `(SELECT COUNT(*)::int FROM rutina_like rl WHERE rl.rutina_id = r.id_rutina)`
                : `0::int`
            } AS likes_count,
            FALSE AS viewer_liked
     FROM rutina r
     JOIN usuario u ON u.id = r.creador_id
     WHERE ${whereClause}
     ORDER BY r.fecha_creacion DESC, r.id_rutina DESC
     LIMIT $${limitParam}
     OFFSET $${offsetParam}`,
    finalParams
  );

  return buildRoutinePostsWithPreview(result.rows);
};

const getSessionSummaries = async (
  whereClause: string,
  params: Array<number | string | string[]>,
  limit: number,
  viewerId?: number,
  offset = 0,
  orderBySql = "COALESCE(se.fecha_fin, se.fecha_inicio, se.fecha) DESC, se.id_sesion DESC"
) => {
  await ensureTrophyTables();
  const queryParams = [...params];
  const viewerLikedSql =
    viewerId == null
      ? `FALSE AS viewer_liked`
      : (() => {
          queryParams.push(viewerId);
          return `EXISTS (
            SELECT 1
            FROM sesion_like sl
            WHERE sl.sesion_id = se.id_sesion
              AND sl.usuario_id = $${queryParams.length}
          ) AS viewer_liked`;
        })();
  const finalParams = [...queryParams, limit, offset];
  const limitParam = finalParams.length - 1;
  const offsetParam = finalParams.length;

  const result = await pool.query<SessionSummaryRow>(
    `SELECT se.id_sesion,
            se.usuario_id,
            u.username,
            u.tipo_usuario,
            se.rutina_id,
            COALESCE(se.nombre_rutina_snapshot, r.nombre, se.descripcion, 'Entrenamiento') AS titulo,
            se.descripcion,
            se.fecha_inicio::text,
            se.fecha_fin::text,
            COALESCE(se.fecha_fin, se.fecha_inicio, se.fecha)::text AS fecha_actividad,
            COALESCE(
              se.duracion_segundos,
              CASE
                WHEN se.fecha_inicio IS NOT NULL AND se.fecha_fin IS NOT NULL
                  THEN GREATEST(EXTRACT(EPOCH FROM (se.fecha_fin - se.fecha_inicio))::int, 0)
                ELSE NULL
              END
            ) AS duracion_segundos,
            COALESCE(
              se.volumen_total,
              (
                SELECT COALESCE(SUM(COALESCE(sr.peso, 0) * COALESCE(sr.repeticiones, 0)), 0)::float
                FROM serie sr
                WHERE sr.sesion_id = se.id_sesion
              )
            ) AS volumen_total,
            (
              SELECT COUNT(*)::int
              FROM serie sr
              WHERE sr.sesion_id = se.id_sesion
            ) AS total_series,
            (
              SELECT COUNT(DISTINCT sr.ejercicio_id)::int
              FROM serie sr
              WHERE sr.sesion_id = se.id_sesion
            ) AS total_ejercicios,
            (
              SELECT COUNT(*)::int
              FROM serie_record_trofeo srt
              WHERE srt.sesion_id = se.id_sesion
            ) AS total_trofeos,
            (
              SELECT COUNT(*)::int
              FROM sesion_like sl
              WHERE sl.sesion_id = se.id_sesion
            ) AS likes_count,
            (
              SELECT COUNT(*)::int
              FROM sesion_comentario sc
              WHERE sc.sesion_id = se.id_sesion
            ) AS comments_count,
            ${viewerLikedSql}
     FROM sesionentrenamiento se
     JOIN usuario u ON u.id = se.usuario_id
     LEFT JOIN rutina r ON r.id_rutina = se.rutina_id
     WHERE ${whereClause}
     ORDER BY ${orderBySql}
     LIMIT $${limitParam}
     OFFSET $${offsetParam}`,
    finalParams
  );

  return buildSessionsWithPreview(result.rows);
};

const SESSION_DURATION_SQL = `COALESCE(
  se.duracion_segundos,
  CASE
    WHEN se.fecha_inicio IS NOT NULL AND se.fecha_fin IS NOT NULL
      THEN GREATEST(EXTRACT(EPOCH FROM (se.fecha_fin - se.fecha_inicio))::int, 0)
    ELSE NULL
  END
)`;

const getTrainingCatalogFilters = async () => {
  const [groupsResult, disciplinesResult] = await Promise.all([
    pool.query<{ grupo_muscular: string }>(
      `SELECT DISTINCT grupo_muscular
       FROM ejercicio
       WHERE grupo_muscular IS NOT NULL
         AND grupo_muscular <> ''
       ORDER BY grupo_muscular ASC`
    ),
    pool.query<{ tipo_disciplina: string }>(
      `SELECT DISTINCT tipo_disciplina
       FROM ejercicio
       WHERE tipo_disciplina IS NOT NULL
         AND tipo_disciplina <> ''
       ORDER BY tipo_disciplina ASC`
    ),
  ]);

  return {
    gruposMusculares: groupsResult.rows.map((row) => row.grupo_muscular),
    tiposDisciplina: disciplinesResult.rows.map((row) => row.tipo_disciplina),
  };
};

export const searchUserTrainings = async (
  userId: number,
  viewerId: number | undefined,
  filters: UserTrainingSearchFilters
) => {
  const params: Array<number | string | string[]> = [userId];
  const whereClauses = [
    `se.usuario_id = $1`,
    `se.estado = 'finalizada'`,
  ];

  if (filters.q) {
    params.push(`%${filters.q}%`);
    whereClauses.push(`(
      COALESCE(se.nombre_rutina_snapshot, r.nombre, se.descripcion, 'Entrenamiento') ILIKE $${params.length}
      OR se.descripcion ILIKE $${params.length}
      OR EXISTS (
        SELECT 1
        FROM serie s
        JOIN ejercicio e ON e.id_ejercicio = s.ejercicio_id
        WHERE s.sesion_id = se.id_sesion
          AND e.nombre ILIKE $${params.length}
      )
    )`);
  }

  if (filters.gruposMusculares && filters.gruposMusculares.length > 0) {
    params.push(filters.gruposMusculares);
    whereClauses.push(`EXISTS (
      SELECT 1
      FROM serie s
      JOIN ejercicio e ON e.id_ejercicio = s.ejercicio_id
      WHERE s.sesion_id = se.id_sesion
        AND e.grupo_muscular = ANY($${params.length}::text[])
    )`);
  }

  if (filters.tiposDisciplina && filters.tiposDisciplina.length > 0) {
    params.push(filters.tiposDisciplina);
    whereClauses.push(`EXISTS (
      SELECT 1
      FROM serie s
      JOIN ejercicio e ON e.id_ejercicio = s.ejercicio_id
      WHERE s.sesion_id = se.id_sesion
        AND e.tipo_disciplina = ANY($${params.length}::text[])
    )`);
  }

  if (filters.minDurationSeconds != null) {
    params.push(filters.minDurationSeconds);
    whereClauses.push(`${SESSION_DURATION_SQL} >= $${params.length}`);
  }

  if (filters.maxDurationSeconds != null) {
    params.push(filters.maxDurationSeconds);
    whereClauses.push(`${SESSION_DURATION_SQL} <= $${params.length}`);
  }

  const [items, catalogFilters] = await Promise.all([
    getSessionSummaries(
      whereClauses.join(" AND "),
      params,
      100,
      viewerId,
      0
    ),
    getTrainingCatalogFilters(),
  ]);

  return {
    items,
    grupos_musculares: catalogFilters.gruposMusculares,
    tipos_disciplina: catalogFilters.tiposDisciplina,
  };
};

export const getUsuarios = async () => {
  const result = await pool.query<UsuarioRow>(
    `SELECT *
     FROM usuario
     ORDER BY username ASC`
  );

  return result.rows.map(sanitizeUser);
};

export const getUsuarioPorId = async (id: number) => {
  const result = await pool.query<UsuarioRow>(
    `SELECT *
     FROM usuario
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] ? sanitizeUser(result.rows[0]) : null;
};

export const isUsernameTaken = async (username: string, excludeUserId?: number) => {
  const params: Array<string | number> = [username.trim()];
  const excludeClause =
    excludeUserId == null
      ? ""
      : (() => {
          params.push(excludeUserId);
          return `AND id <> $${params.length}`;
        })();

  const result = await pool.query<{ id: number }>(
    `SELECT id
     FROM usuario
     WHERE LOWER(username) = LOWER($1)
       ${excludeClause}
     LIMIT 1`,
    params
  );

  return result.rows.length > 0;
};

export const isEmailTaken = async (email: string, excludeUserId?: number) => {
  const params: Array<string | number> = [email.trim()];
  const excludeClause =
    excludeUserId == null
      ? ""
      : (() => {
          params.push(excludeUserId);
          return `AND id <> $${params.length}`;
        })();

  const result = await pool.query<{ id: number }>(
    `SELECT id
     FROM usuario
     WHERE LOWER(email) = LOWER($1)
       ${excludeClause}
     LIMIT 1`,
    params
  );

  return result.rows.length > 0;
};

export const getUserRoleById = async (id: number) => {
  const result = await pool.query<{ tipo_usuario: string }>(
    `SELECT tipo_usuario
     FROM usuario
     WHERE id = $1`,
    [id]
  );

  const role = result.rows[0]?.tipo_usuario;
  return role ? role.trim().toLowerCase() : null;
};

export const updateUser = async (id: number, data: Partial<UsuarioRow> & { gimnasio_perfil?: Partial<GymProfileData> }) => {
  const {
    username,
    email,
    edad,
    peso,
    altura,
    genero,
    nacionalidad,
    nivel_entrenamiento,
    objetivo_entrenamiento,
    tipo_usuario,
  } = data;

  const normalizedRole = isGymRole(tipo_usuario) ? "gimnasio" : tipo_usuario;
  const result = await pool.query<UsuarioRow>(
    `UPDATE usuario SET
       username = $1,
       email = $2,
       edad = $3,
       peso = $4,
       altura = $5,
       genero = $6,
       nacionalidad = $7,
       nivel_entrenamiento = $8,
       objetivo_entrenamiento = $9,
       tipo_usuario = $10
     WHERE id = $11
     RETURNING *`,
    [
      username,
      email,
      isGymRole(normalizedRole) ? null : edad ?? null,
      isGymRole(normalizedRole) ? null : peso ?? null,
      isGymRole(normalizedRole) ? null : altura ?? null,
      isGymRole(normalizedRole) ? null : genero ?? null,
      isGymRole(normalizedRole) ? null : nacionalidad ?? null,
      isGymRole(normalizedRole) ? null : nivel_entrenamiento ?? null,
      isGymRole(normalizedRole) ? null : objetivo_entrenamiento ?? null,
      normalizedRole,
      id,
    ]
  );

  const updatedUser = result.rows[0] ? sanitizeUser(result.rows[0]) : null;

  if (updatedUser && isGymRole(updatedUser.tipo_usuario)) {
    await upsertGymProfile(id, data.gimnasio_perfil ?? {}, updatedUser.username);
  }

  return updatedUser;
};

export const searchUsers = async (query: string, viewerId?: number) => {
  const params: Array<string | number> = [`%${query.trim()}%`];
  let viewerClause = "";

  if (viewerId != null) {
    params.push(viewerId);
    viewerClause = `, EXISTS (
      SELECT 1
      FROM seguimientousuario su
      WHERE su.id_seguidor = $2
        AND su.id_seguido = u.id
    ) AS lo_sigo`;
  }

  const result = await pool.query<
    BasicUserRow & {
      followers_count: number;
      following_count: number;
      lo_sigo?: boolean;
    }
  >(
    `SELECT u.id,
            u.username,
            u.email,
            u.tipo_usuario,
            (
              SELECT COUNT(*)::int
              FROM seguimientousuario su
              WHERE su.id_seguido = u.id
            ) AS followers_count,
            (
              SELECT COUNT(*)::int
              FROM seguimientousuario su
              WHERE su.id_seguidor = u.id
            ) AS following_count
            ${viewerClause}
     FROM usuario u
     WHERE u.username ILIKE $1
     ORDER BY u.username ASC
     LIMIT 20`,
    params
  );

  return result.rows.map((row) => ({
    ...sanitizeUser(row),
    followers_count: row.followers_count,
    following_count: row.following_count,
    lo_sigo: row.lo_sigo ?? false,
  }));
};

const ensureUserExists = async (id: number) => {
  const result = await pool.query<{ id: number }>(
    `SELECT id
     FROM usuario
     WHERE id = $1`,
    [id]
  );

  return result.rows.length > 0;
};

export const followUser = async (seguidorId: number, seguidoId: number) => {
  const [seguidorExiste, seguidoExiste] = await Promise.all([
    ensureUserExists(seguidorId),
    ensureUserExists(seguidoId),
  ]);

  if (!seguidorExiste || !seguidoExiste) {
    return { error: "Usuario no encontrado" as const };
  }

  if (seguidorId === seguidoId) {
    return { error: "No te podes seguir a vos mismo" as const };
  }

  await pool.query(
    `INSERT INTO seguimientousuario (id_seguidor, id_seguido, fecha)
     VALUES ($1, $2, NOW())
     ON CONFLICT (id_seguidor, id_seguido) DO NOTHING`,
    [seguidorId, seguidoId]
  );

  return { ok: true as const };
};

export const unfollowUser = async (seguidorId: number, seguidoId: number) => {
  const result = await pool.query(
    `DELETE FROM seguimientousuario
     WHERE id_seguidor = $1
       AND id_seguido = $2`,
    [seguidorId, seguidoId]
  );

  return {
    deleted: (result.rowCount ?? 0) > 0,
  };
};

const getSocialList = async (
  joinColumn: "id_seguidor" | "id_seguido",
  targetColumn: "id_seguidor" | "id_seguido",
  userId: number,
  viewerId?: number
) => {
  const params: number[] = [userId];
  const viewerFollowsSql =
    viewerId == null
      ? `FALSE AS viewer_follows`
      : (() => {
          params.push(viewerId);
          return `EXISTS (
            SELECT 1
            FROM seguimientousuario viewer_su
            WHERE viewer_su.id_seguidor = $${params.length}
              AND viewer_su.id_seguido = u.id
          ) AS viewer_follows`;
        })();

  const result = await pool.query<
    UsuarioRow & {
      fecha_seguimiento: string;
      viewer_follows: boolean;
    }
  >(
    `SELECT u.*,
            su.fecha::text AS fecha_seguimiento,
            ${viewerFollowsSql}
     FROM seguimientousuario su
     JOIN usuario u ON u.id = su.${targetColumn}
     WHERE su.${joinColumn} = $1
     ORDER BY su.fecha DESC, u.username ASC`,
    params
  );

  return result.rows.map((row) => ({
    ...sanitizeUser(row),
    fecha_seguimiento: row.fecha_seguimiento,
    viewer_follows: row.viewer_follows,
  }));
};

export const getFollowers = async (userId: number, viewerId?: number) =>
  getSocialList("id_seguido", "id_seguidor", userId, viewerId);

export const getFollowing = async (userId: number, viewerId?: number) =>
  getSocialList("id_seguidor", "id_seguido", userId, viewerId);

export const getUserProfile = async (profileId: number, viewerId?: number) => {
  const userResult = await pool.query<
    UsuarioRow & {
      followers_count: number;
      following_count: number;
      trainings_count: number;
      routines_count: number;
      viewer_follows?: boolean;
    }
  >(
    `SELECT u.*,
            (
              SELECT COUNT(*)::int
              FROM seguimientousuario su
              WHERE su.id_seguido = u.id
            ) AS followers_count,
            (
              SELECT COUNT(*)::int
              FROM seguimientousuario su
              WHERE su.id_seguidor = u.id
            ) AS following_count,
            (
              SELECT COUNT(*)::int
              FROM sesionentrenamiento se
              WHERE se.usuario_id = u.id
                AND se.estado = 'finalizada'
            ) AS trainings_count,
            (
              SELECT COUNT(*)::int
              FROM rutina r
              WHERE r.creador_id = u.id
            ) AS routines_count
            ${
              viewerId != null
                ? `,
            EXISTS (
              SELECT 1
              FROM seguimientousuario su
              WHERE su.id_seguidor = $2
                AND su.id_seguido = u.id
            ) AS viewer_follows`
                : ""
            }
     FROM usuario u
     WHERE u.id = $1`,
    viewerId != null ? [profileId, viewerId] : [profileId]
  );

  const user = userResult.rows[0];
  if (!user) {
    return null;
  }

  const gymUser = isGymRole(user.tipo_usuario);
  const trainings = gymUser
    ? []
    : await getSessionSummaries(
        `se.usuario_id = $1
          AND se.estado = 'finalizada'`,
        [profileId],
        20,
        viewerId
      );
  const routines = gymUser
    ? await getRoutinePostSummaries(
        `r.creador_id = $1`,
        [profileId],
        20
      )
    : [];
  const gimnasioPerfil = gymUser ? await getGymProfile(profileId, user.username) : null;

  return {
    usuario: sanitizeUser(user),
    followers_count: user.followers_count,
    following_count: user.following_count,
    trainings_count: gymUser ? 0 : user.trainings_count,
    routines_count: gymUser ? user.routines_count : 0,
    viewer_follows: user.viewer_follows ?? false,
    is_own_profile: viewerId != null ? viewerId === profileId : false,
    entrenamientos: trainings,
    rutinas: routines,
    gimnasio_perfil: gimnasioPerfil,
  };
};

export const getUserProfileByUsername = async (username: string, viewerId?: number) => {
  const userResult = await pool.query<{ id: number }>(
    `SELECT id
     FROM usuario
     WHERE LOWER(username) = LOWER($1)`,
    [username.trim()]
  );

  const userId = userResult.rows[0]?.id;
  if (userId == null) {
    return null;
  }

  return getUserProfile(userId, viewerId);
};

export const getFeed = async (userId: number, page = 1, pageSize = 10) => {
  const viewerRole = await getUserRoleById(userId);
  const viewerIsGym = isGymRole(viewerRole);
  const feedWhereClause = `se.estado = 'finalizada'
    AND (
      se.usuario_id = $1
      OR se.usuario_id IN (
        SELECT su.id_seguido
        FROM seguimientousuario su
        WHERE su.id_seguidor = $1
      )
    )`;
  const routineFeedWhereClause = `LOWER(u.tipo_usuario) = 'gimnasio'
    AND (
      r.creador_id = $1
      OR r.creador_id IN (
        SELECT su.id_seguido
        FROM seguimientousuario su
        WHERE su.id_seguidor = $1
      )
    )`;
  const safePageSize = Math.min(Math.max(Math.floor(pageSize), 1), 30);

  const [totalResult, totalRoutineResult] = await Promise.all([
    pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM sesionentrenamiento se
     WHERE ${feedWhereClause}`,
    [userId]
    ),
    viewerIsGym
      ? pool.query<{ total: string }>(
          `SELECT COUNT(*)::text AS total
           FROM rutina r
           JOIN usuario u ON u.id = r.creador_id
           WHERE ${routineFeedWhereClause}`,
          [userId]
        )
      : Promise.resolve({ rows: [{ total: "0" }] }),
  ]);
  const total =
    Number(totalResult.rows[0]?.total ?? 0) +
    Number(totalRoutineResult.rows[0]?.total ?? 0);
  const totalPages = Math.max(Math.ceil(total / safePageSize), 1);
  const safePage = Math.min(Math.max(Math.floor(page), 1), totalPages);
  const offset = (safePage - 1) * safePageSize;
  const windowSize = safePageSize + offset;
  const [trainingItems, routineItems] = await Promise.all([
    getSessionSummaries(
      feedWhereClause,
      [userId],
      viewerIsGym ? windowSize : safePageSize,
      userId,
      viewerIsGym ? 0 : offset
    ),
    viewerIsGym
      ? getRoutinePostSummaries(
          routineFeedWhereClause,
          [userId],
          windowSize
        )
      : Promise.resolve([]),
  ]);
  const items = viewerIsGym
    ? [
        ...trainingItems.map((item) => ({ content_type: "training" as const, ...item })),
        ...routineItems,
      ]
        .sort((a, b) => {
          const aTime = a.fecha_actividad ? new Date(a.fecha_actividad).getTime() : 0;
          const bTime = b.fecha_actividad ? new Date(b.fecha_actividad).getTime() : 0;
          if (aTime !== bTime) {
            return bTime - aTime;
          }
          const aId = "id_sesion" in a ? a.id_sesion : a.id_rutina;
          const bId = "id_sesion" in b ? b.id_sesion : b.id_rutina;
          return bId - aId;
        })
        .slice(offset, offset + safePageSize)
    : trainingItems;

  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  };
};

export const getSuggestedUsers = async (userId: number, limit = 5) => {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 10);

  const secondDegreeResult = await pool.query<SuggestedUserRow>(
    `WITH viewer_following AS (
       SELECT su.id_seguido
       FROM seguimientousuario su
       WHERE su.id_seguidor = $1
     ),
     second_degree AS (
       SELECT su.id_seguido AS user_id,
              COUNT(DISTINCT su.id_seguidor)::int AS mutual_following_count
       FROM seguimientousuario su
       JOIN viewer_following vf ON vf.id_seguido = su.id_seguidor
       WHERE su.id_seguido <> $1
         AND su.id_seguido NOT IN (SELECT id_seguido FROM viewer_following)
       GROUP BY su.id_seguido
     )
     SELECT u.id,
            u.username,
            u.email,
            u.tipo_usuario,
            (
              SELECT COUNT(*)::int
              FROM seguimientousuario su
              WHERE su.id_seguido = u.id
            ) AS followers_count,
            (
              SELECT COUNT(*)::int
              FROM seguimientousuario su
              WHERE su.id_seguidor = u.id
            ) AS following_count,
            (
              SELECT COUNT(*)::int
              FROM sesionentrenamiento se
              WHERE se.usuario_id = u.id
                AND se.estado = 'finalizada'
            ) AS trainings_count,
            FALSE AS viewer_follows,
            sd.mutual_following_count
     FROM second_degree sd
     JOIN usuario u ON u.id = sd.user_id
     ORDER BY sd.mutual_following_count DESC, followers_count DESC, trainings_count DESC, u.username ASC
     LIMIT $2`,
    [userId, safeLimit]
  );

  const suggestions = secondDegreeResult.rows.map((row) => ({
    ...sanitizeUser(row),
    followers_count: row.followers_count,
    following_count: row.following_count,
    trainings_count: row.trainings_count,
    viewer_follows: row.viewer_follows ?? false,
    mutual_following_count: row.mutual_following_count,
  }));

  if (suggestions.length >= safeLimit) {
    return suggestions;
  }

  const excludedIds = [userId, ...suggestions.map((user) => user.id)];
  const fallbackResult = await pool.query<SuggestedUserRow>(
    `SELECT u.id,
            u.username,
            u.email,
            u.tipo_usuario,
            (
              SELECT COUNT(*)::int
              FROM seguimientousuario su
              WHERE su.id_seguido = u.id
            ) AS followers_count,
            (
              SELECT COUNT(*)::int
              FROM seguimientousuario su
              WHERE su.id_seguidor = u.id
            ) AS following_count,
            (
              SELECT COUNT(*)::int
              FROM sesionentrenamiento se
              WHERE se.usuario_id = u.id
                AND se.estado = 'finalizada'
            ) AS trainings_count,
            FALSE AS viewer_follows,
            0::int AS mutual_following_count
     FROM usuario u
     WHERE u.id <> ALL($2::int[])
       AND NOT EXISTS (
         SELECT 1
         FROM seguimientousuario su
         WHERE su.id_seguidor = $1
           AND su.id_seguido = u.id
       )
     ORDER BY trainings_count DESC, followers_count DESC, u.username ASC
     LIMIT $3`,
    [userId, excludedIds, safeLimit - suggestions.length]
  );

  return [
    ...suggestions,
    ...fallbackResult.rows.map((row) => ({
      ...sanitizeUser(row),
      followers_count: row.followers_count,
      following_count: row.following_count,
      trainings_count: row.trainings_count,
      viewer_follows: row.viewer_follows ?? false,
      mutual_following_count: row.mutual_following_count,
    })),
  ];
};

const getTrendRoutines = async (
  orderByMetric: "copy_count" | "save_count",
  support: RutinaMetricSupport
) => {
  const copyCountSql = support.has_copy
    ? `(SELECT COUNT(*)::int FROM rutina_copia rc WHERE rc.rutina_id = r.id_rutina)`
    : `0::int`;
  const saveCountSql = support.has_save
    ? `(SELECT COUNT(*)::int FROM rutina_guardado rg WHERE rg.rutina_id = r.id_rutina)`
    : `0::int`;

  const result = await pool.query<TrendRoutineRow>(
    `SELECT r.id_rutina,
            r.nombre,
            r.descripcion,
            r.duracion_estimada,
            r.fecha_creacion::text,
            r.creador_id,
            r.id_carpeta,
            ${saveCountSql} AS save_count,
            ${copyCountSql} AS copy_count,
            u.username AS creador_username,
            u.tipo_usuario AS creador_tipo_usuario,
            (
              SELECT COUNT(*)::int
              FROM rutinaejercicio re
              WHERE re.id_rutina = r.id_rutina
            ) AS total_ejercicios,
            COALESCE((
              SELECT ARRAY_AGG(DISTINCT e.grupo_muscular ORDER BY e.grupo_muscular)
              FROM rutinaejercicio re
              JOIN ejercicio e ON e.id_ejercicio = re.id_ejercicio
              WHERE re.id_rutina = r.id_rutina
            ), ARRAY[]::text[]) AS grupos_musculares
     FROM rutina r
     JOIN usuario u ON u.id = r.creador_id
     ORDER BY ${orderByMetric} DESC, r.fecha_creacion DESC, r.id_rutina DESC
     LIMIT 10`
  );

  return result.rows;
};

const getTrendUsers = async (viewerId?: number) => {
  const params: number[] = [];
  const whereClauses = ["TRUE"];

  if (viewerId != null) {
    params.push(viewerId);
    whereClauses.push(`u.id <> $${params.length}`);
  }

  const viewerFollowsSql =
    viewerId == null
      ? `FALSE AS viewer_follows`
      : (() => {
          params.push(viewerId);
          return `EXISTS (
            SELECT 1
            FROM seguimientousuario su
            WHERE su.id_seguidor = $${params.length}
              AND su.id_seguido = u.id
          ) AS viewer_follows`;
        })();

  const result = await pool.query<TrendUserRow>(
    `SELECT u.id,
            u.username,
            u.email,
            u.tipo_usuario,
            (
              SELECT COUNT(*)::int
              FROM seguimientousuario su
              WHERE su.id_seguido = u.id
            ) AS followers_count,
            (
              SELECT COUNT(*)::int
              FROM seguimientousuario su
              WHERE su.id_seguidor = u.id
            ) AS following_count,
            (
              SELECT COUNT(*)::int
              FROM sesionentrenamiento se
              WHERE se.usuario_id = u.id
                AND se.estado = 'finalizada'
            ) AS trainings_count,
            ${viewerFollowsSql}
     FROM usuario u
     WHERE ${whereClauses.join(" AND ")}
     ORDER BY followers_count DESC, trainings_count DESC, u.username ASC
     LIMIT 10`,
    params
  );

  return result.rows.map((row) => ({
    ...sanitizeUser(row),
    followers_count: row.followers_count,
    following_count: row.following_count,
    trainings_count: row.trainings_count,
    viewer_follows: row.viewer_follows ?? false,
  }));
};

export const getTrends = async (viewerId?: number) => {
  const support = await getRutinaMetricsSupport();
  const [rutinasMasCopiadas, rutinasMasGuardadas, usuariosMasSeguidos] =
    await Promise.all([
      getTrendRoutines("copy_count", support),
      getTrendRoutines("save_count", support),
      getTrendUsers(viewerId),
    ]);

  const [entrenamientosMasLikeados, entrenamientosMasComentados, entrenamientosMayorVolumen] =
    await Promise.all([
      getSessionSummaries(
        `se.estado = 'finalizada'`,
        [],
        10,
        viewerId,
        0,
        "likes_count DESC, comments_count DESC, COALESCE(se.fecha_fin, se.fecha_inicio, se.fecha) DESC, se.id_sesion DESC"
      ),
      getSessionSummaries(
        `se.estado = 'finalizada'`,
        [],
        10,
        viewerId,
        0,
        "comments_count DESC, likes_count DESC, COALESCE(se.fecha_fin, se.fecha_inicio, se.fecha) DESC, se.id_sesion DESC"
      ),
      getSessionSummaries(
        `se.estado = 'finalizada'`,
        [],
        10,
        viewerId,
        0,
        "volumen_total DESC NULLS LAST, total_series DESC, COALESCE(se.fecha_fin, se.fecha_inicio, se.fecha) DESC, se.id_sesion DESC"
      ),
    ]);

  return {
    rutinas_mas_copiadas: rutinasMasCopiadas,
    rutinas_mas_guardadas: rutinasMasGuardadas,
    usuarios_mas_seguidos: usuariosMasSeguidos,
    entrenamientos_mas_likeados: entrenamientosMasLikeados,
    entrenamientos_mas_comentados: entrenamientosMasComentados,
    entrenamientos_mayor_volumen: entrenamientosMayorVolumen,
  };
};
