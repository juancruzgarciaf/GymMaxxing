import { pool } from "../db";

type UsuarioRow = {
  id: number;
  username: string;
  email: string;
  password?: string;
  edad: number | null;
  peso: number | null;
  altura: number | null;
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

type SessionSummaryRow = {
  id_sesion: number;
  usuario_id: number;
  username: string;
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
  likes_count: number;
  comments_count: number;
  viewer_liked: boolean;
};

type ExercisePreviewRow = {
  sesion_id: number;
  nombre: string;
  series: number;
};

const sanitizeUser = (user: UsuarioRow | BasicUserRow) => {
  const { password: _password, ...safeUser } = user as UsuarioRow;
  return safeUser;
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

const getSessionSummaries = async (
  whereClause: string,
  params: Array<number | string>,
  limit: number,
  viewerId?: number
) => {
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
  const finalParams = [...queryParams, limit];

  const result = await pool.query<SessionSummaryRow>(
    `SELECT se.id_sesion,
            se.usuario_id,
            u.username,
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
     ORDER BY COALESCE(se.fecha_fin, se.fecha_inicio, se.fecha) DESC, se.id_sesion DESC
     LIMIT $${finalParams.length}`,
    finalParams
  );

  return buildSessionsWithPreview(result.rows);
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

export const getUserRoleById = async (id: number) => {
  const result = await pool.query<{ tipo_usuario: string }>(
    `SELECT tipo_usuario
     FROM usuario
     WHERE id = $1`,
    [id]
  );

  const role = result.rows[0]?.tipo_usuario;
  return role ? role.toLowerCase() : null;
};

export const updateUser = async (id: number, data: Partial<UsuarioRow>) => {
  const {
    username,
    email,
    edad,
    peso,
    altura,
    nacionalidad,
    nivel_entrenamiento,
    objetivo_entrenamiento,
    tipo_usuario,
  } = data;

  const result = await pool.query<UsuarioRow>(
    `UPDATE usuario SET
       username = $1,
       email = $2,
       edad = $3,
       peso = $4,
       altura = $5,
       nacionalidad = $6,
       nivel_entrenamiento = $7,
       objetivo_entrenamiento = $8,
       tipo_usuario = $9
     WHERE id = $10
     RETURNING *`,
    [
      username,
      email,
      edad ?? null,
      peso ?? null,
      altura ?? null,
      nacionalidad ?? null,
      nivel_entrenamiento ?? null,
      objetivo_entrenamiento ?? null,
      tipo_usuario,
      id,
    ]
  );

  return result.rows[0] ? sanitizeUser(result.rows[0]) : null;
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
  userId: number
) => {
  const result = await pool.query<
    BasicUserRow & {
      fecha_seguimiento: string;
    }
  >(
    `SELECT u.id,
            u.username,
            u.email,
            u.tipo_usuario,
            su.fecha::text AS fecha_seguimiento
     FROM seguimientousuario su
     JOIN usuario u ON u.id = su.${targetColumn}
     WHERE su.${joinColumn} = $1
     ORDER BY su.fecha DESC, u.username ASC`,
    [userId]
  );

  return result.rows.map((row) => ({
    ...sanitizeUser(row),
    fecha_seguimiento: row.fecha_seguimiento,
  }));
};

export const getFollowers = async (userId: number) =>
  getSocialList("id_seguido", "id_seguidor", userId);

export const getFollowing = async (userId: number) =>
  getSocialList("id_seguidor", "id_seguido", userId);

export const getUserProfile = async (profileId: number, viewerId?: number) => {
  const userResult = await pool.query<
    UsuarioRow & {
      followers_count: number;
      following_count: number;
      trainings_count: number;
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
            ) AS trainings_count
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

  const trainings = await getSessionSummaries(
    `se.usuario_id = $1
      AND se.estado = 'finalizada'`,
    [profileId],
    20,
    viewerId
  );

  return {
    usuario: sanitizeUser(user),
    followers_count: user.followers_count,
    following_count: user.following_count,
    trainings_count: user.trainings_count,
    viewer_follows: user.viewer_follows ?? false,
    is_own_profile: viewerId != null ? viewerId === profileId : false,
    entrenamientos: trainings,
  };
};

export const getFeed = async (userId: number) =>
  getSessionSummaries(
    `se.estado = 'finalizada'
      AND (
        se.usuario_id = $1
        OR se.usuario_id IN (
          SELECT su.id_seguido
          FROM seguimientousuario su
          WHERE su.id_seguidor = $1
        )
      )`,
    [userId],
    30,
    userId
  );
