import { pool } from "../db";

type SesionEntrenamientoRow = {
  id_sesion: number;
  fecha: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  descripcion: string | null;
  gimnasio_id: number | null;
  usuario_id: number;
  rutina_id: number | null;
  estado: string;
  duracion_segundos: number | null;
  volumen_total: number | null;
  nombre_rutina_snapshot: string | null;
};

type SessionInteractionSummaryRow = {
  likes_count: number;
  comments_count: number;
  viewer_liked: boolean;
};

type SessionCommentRow = {
  id_comentario: number;
  sesion_id: number;
  usuario_id: number;
  username: string;
  contenido: string;
  fecha: string;
};

type CommentDeleteResult =
  | { ok: true; summary: SessionInteractionSummaryRow }
  | { ok: false; reason: "not_found" | "forbidden" };

// =========================
// SESION_ENTRENAMIENTO
// =========================

export const iniciarSesionEntrenamiento = async (data: any) => {
  const { descripcion, gimnasio_id, usuario_id, rutina_id } = data;

  const rutinaResult = rutina_id
    ? await pool.query<{ nombre: string }>(
        `SELECT nombre
         FROM rutina
         WHERE id_rutina = $1`,
        [rutina_id]
      )
    : { rows: [] as Array<{ nombre: string }> };

  const result = await pool.query<SesionEntrenamientoRow>(
    `INSERT INTO sesionentrenamiento
     (
       fecha,
       fecha_inicio,
       descripcion,
       gimnasio_id,
       usuario_id,
       rutina_id,
       estado,
       nombre_rutina_snapshot
     )
     VALUES (NOW(), NOW(), $1, $2, $3, $4, 'en_curso', $5)
     RETURNING *`,
    [
      descripcion ?? null,
      gimnasio_id ?? null,
      usuario_id,
      rutina_id,
      rutinaResult.rows[0]?.nombre ?? null,
    ]
  );

  return result.rows[0];
};

export const getSesionPorId = async (id_sesion: string) => {
  const result = await pool.query<SesionEntrenamientoRow>(
    `SELECT * FROM sesionentrenamiento WHERE id_sesion = $1`,
    [id_sesion]
  );

  return result.rows[0];
};

export const getSessionInteractionSummary = async (
  sesion_id: string,
  viewerId?: number
) => {
  const params: Array<string | number> = [sesion_id];
  const viewerLikedSql =
    viewerId == null
      ? `FALSE AS viewer_liked`
      : (() => {
          params.push(viewerId);
          return `EXISTS (
            SELECT 1
            FROM sesion_like sl
            WHERE sl.sesion_id = $1
              AND sl.usuario_id = $2
          ) AS viewer_liked`;
        })();

  const result = await pool.query<SessionInteractionSummaryRow>(
    `SELECT
       (
         SELECT COUNT(*)::int
         FROM sesion_like sl
         WHERE sl.sesion_id = $1
       ) AS likes_count,
       (
         SELECT COUNT(*)::int
         FROM sesion_comentario sc
         WHERE sc.sesion_id = $1
       ) AS comments_count,
       ${viewerLikedSql}`,
    params
  );

  return (
    result.rows[0] ?? {
      likes_count: 0,
      comments_count: 0,
      viewer_liked: false,
    }
  );
};

export const updateSesionEntrenamiento = async (
  id_sesion: string,
  data: {
    descripcion?: string | null;
    nombre?: string | null;
    nombre_rutina_snapshot?: string | null;
  }
) => {
  const result = await pool.query<SesionEntrenamientoRow>(
    `UPDATE sesionentrenamiento
     SET descripcion = $2,
         nombre_rutina_snapshot = $3
     WHERE id_sesion = $1
     RETURNING *`,
    [
      id_sesion,
      data.descripcion ?? null,
      data.nombre_rutina_snapshot ?? data.nombre ?? null,
    ]
  );

  return result.rows[0] ?? null;
};

// =========================
// SERIE
// =========================

export const registrarSerie = async (data: any) => {
  const {
    repeticiones,
    peso,
    descanso,
    orden,
    ejercicio_id,
    sesion_id,
  } = data;

  const result = await pool.query(
    `INSERT INTO serie
     (repeticiones, peso, descanso, orden, ejercicio_id, sesion_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      repeticiones,
      peso ?? null,
      descanso ?? null,
      orden,
      ejercicio_id,
      sesion_id,
    ]
  );

  return result.rows[0];
};

export const getSeriesDeSesion = async (sesion_id: string) => {
  const result = await pool.query(
    `SELECT s.*,
            e.nombre,
            e.descripcion,
            e.grupo_muscular,
            e.tipo_disciplina,
            COALESCE(re.orden, 9999) AS orden_ejercicio
     FROM serie s
     JOIN ejercicio e ON e.id_ejercicio = s.ejercicio_id
     JOIN sesionentrenamiento se ON se.id_sesion = s.sesion_id
     LEFT JOIN rutinaejercicio re
       ON re.id_rutina = se.rutina_id
      AND re.id_ejercicio = s.ejercicio_id
     WHERE s.sesion_id = $1
     ORDER BY COALESCE(re.orden, 9999) ASC, s.orden ASC, e.nombre ASC`,
    [sesion_id]
  );

  return result.rows;
};

export const addLikeToSesion = async (sesion_id: string, usuario_id: number) => {
  await pool.query(
    `INSERT INTO sesion_like (sesion_id, usuario_id, fecha)
     VALUES ($1, $2, NOW())
     ON CONFLICT (sesion_id, usuario_id) DO NOTHING`,
    [sesion_id, usuario_id]
  );

  return getSessionInteractionSummary(sesion_id, usuario_id);
};

export const removeLikeFromSesion = async (sesion_id: string, usuario_id: number) => {
  await pool.query(
    `DELETE FROM sesion_like
     WHERE sesion_id = $1
       AND usuario_id = $2`,
    [sesion_id, usuario_id]
  );

  return getSessionInteractionSummary(sesion_id, usuario_id);
};

export const getComentariosDeSesion = async (sesion_id: string) => {
  const result = await pool.query<SessionCommentRow>(
    `SELECT sc.id_comentario,
            sc.sesion_id,
            sc.usuario_id,
            u.username,
            sc.contenido,
            sc.fecha::text AS fecha
     FROM sesion_comentario sc
     JOIN usuario u ON u.id = sc.usuario_id
     WHERE sc.sesion_id = $1
     ORDER BY sc.fecha ASC, sc.id_comentario ASC`,
    [sesion_id]
  );

  return result.rows;
};

export const createComentarioDeSesion = async (
  sesion_id: string,
  usuario_id: number,
  contenido: string
) => {
  const result = await pool.query<{ id_comentario: number }>(
    `INSERT INTO sesion_comentario (sesion_id, usuario_id, contenido, fecha)
     VALUES ($1, $2, $3, NOW())
     RETURNING id_comentario`,
    [sesion_id, usuario_id, contenido.trim()]
  );

  const commentId = result.rows[0]?.id_comentario;
  const comments = await getComentariosDeSesion(sesion_id);
  const comentario = comments.find((item) => item.id_comentario === commentId) ?? null;
  const summary = await getSessionInteractionSummary(sesion_id, usuario_id);

  return {
    comentario,
    summary,
  };
};

export const deleteComentarioDeSesion = async (
  sesion_id: string,
  comentario_id: string,
  usuario_id: number
): Promise<CommentDeleteResult> => {
  const comentarioResult = await pool.query<{ usuario_id: number }>(
    `SELECT usuario_id
     FROM sesion_comentario
     WHERE sesion_id = $1
       AND id_comentario = $2`,
    [sesion_id, comentario_id]
  );

  const comentario = comentarioResult.rows[0];

  if (!comentario) {
    return { ok: false, reason: "not_found" };
  }

  if (comentario.usuario_id !== usuario_id) {
    return { ok: false, reason: "forbidden" };
  }

  await pool.query(
    `DELETE FROM sesion_comentario
     WHERE sesion_id = $1
       AND id_comentario = $2
       AND usuario_id = $3`,
    [sesion_id, comentario_id, usuario_id]
  );

  return {
    ok: true,
    summary: await getSessionInteractionSummary(sesion_id, usuario_id),
  };
};

export const replaceSeriesDeSesion = async (
  sesion_id: string,
  series: Array<{
    repeticiones: number;
    peso?: number | null;
    descanso?: number | null;
    orden: number;
    ejercicio_id: number;
  }>
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM serie WHERE sesion_id = $1`, [sesion_id]);

    for (const serie of series) {
      await client.query(
        `INSERT INTO serie
         (repeticiones, peso, descanso, orden, ejercicio_id, sesion_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          serie.repeticiones,
          serie.peso ?? null,
          serie.descanso ?? null,
          serie.orden,
          serie.ejercicio_id,
          sesion_id,
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return getSeriesDeSesion(sesion_id);
};

// esto simula “finalizar” aunque tu DER no tenga fecha_fin.
// podemos dejarlo como cierre lógico devolviendo la sesión y sus series.
export const finalizarSesion = async (sesion_id: string) => {
  const sesion = await getSesionPorId(sesion_id);
  if (!sesion) {
    return null;
  }

  const volumenResult = await pool.query<{ volumen_total: number }>(
    `SELECT COALESCE(SUM(COALESCE(peso, 0) * COALESCE(repeticiones, 0)), 0)::float AS volumen_total
     FROM serie
     WHERE sesion_id = $1`,
    [sesion_id]
  );

  const sesionActualizada = await pool.query<SesionEntrenamientoRow>(
    `UPDATE sesionentrenamiento
     SET fecha_fin = NOW(),
         estado = 'finalizada',
         duracion_segundos = COALESCE(
           duracion_segundos,
           CASE
             WHEN fecha_inicio IS NOT NULL
               THEN GREATEST(EXTRACT(EPOCH FROM (NOW() - fecha_inicio))::int, 0)
             ELSE 0
           END
         ),
         volumen_total = $2
     WHERE id_sesion = $1
     RETURNING *`,
    [sesion_id, volumenResult.rows[0]?.volumen_total ?? 0]
  );

  const series = await getSeriesDeSesion(sesion_id);

  return {
    sesion: sesionActualizada.rows[0] ?? sesion,
    series,
    estado: "finalizada" as const,
  };
};

export const deleteSesionEntrenamiento = async (sesion_id: string) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM serie WHERE sesion_id = $1`, [sesion_id]);
    const result = await client.query<SesionEntrenamientoRow>(
      `DELETE FROM sesionentrenamiento
       WHERE id_sesion = $1
       RETURNING *`,
      [sesion_id]
    );
    await client.query("COMMIT");
    return result.rows[0] ?? null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
