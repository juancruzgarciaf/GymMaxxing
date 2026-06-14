import { pool } from "../db";
import { limitDescription, limitTitle } from "../utils/textLimits";
import { createNotificationIfAllowed } from "./notification.service";

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
  imagen_url: string | null;
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

type Queryable = {
  query: <T = any>(text: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

export type SerieAnteriorRow = {
  orden: number;
  repeticiones: number;
  peso: number | null;
  distancia_km: number | null;
  tiempo_segundos: number | null;
  tipo_serie: string;
};

type SerieRecordInputRow = {
  ejercicio_id: number;
  orden: number;
  repeticiones: number;
  peso: number;
};

type ExerciseRecordRow = {
  mejor_volumen: number;
  mejor_peso: number;
  mejor_1rm: number;
};

type HistoricalExerciseRecordRow = {
  mejor_volumen: number | null;
  mejor_peso: number | null;
  mejor_1rm: number | null;
};

let serieTipoSerieColumnReady = false;
let recordTablesReady = false;

const ensureSerieTipoSerieColumn = async (queryable: Queryable) => {
  if (serieTipoSerieColumnReady) {
    return;
  }

  await queryable.query(
    `ALTER TABLE serie
     ADD COLUMN IF NOT EXISTS tipo_serie VARCHAR(20) NOT NULL DEFAULT 'serie'`
  );
  await queryable.query(
    `ALTER TABLE serie
     ADD COLUMN IF NOT EXISTS distancia_km DOUBLE PRECISION`
  );
  await queryable.query(
    `ALTER TABLE serie
     ADD COLUMN IF NOT EXISTS tiempo_segundos INT`
  );
  await queryable.query(
    `ALTER TABLE serie
     ADD COLUMN IF NOT EXISTS nota_ejercicio TEXT`
  );
  await queryable.query(
    `DO $$
     BEGIN
       IF NOT EXISTS (
         SELECT 1
         FROM pg_constraint
         WHERE conname = 'serie_tipo_serie_check'
           AND conrelid = 'serie'::regclass
       ) THEN
         ALTER TABLE serie
         ADD CONSTRAINT serie_tipo_serie_check
         CHECK (tipo_serie IN ('warmup', 'serie', 'dropset', 'failure'));
       END IF;
     END $$`
  );

  serieTipoSerieColumnReady = true;
};

const ensureRecordTables = async (queryable: Queryable) => {
  if (recordTablesReady) {
    return;
  }

  await queryable.query(
    `CREATE TABLE IF NOT EXISTS usuario_ejercicio_record (
       usuario_id INT NOT NULL,
       ejercicio_id INT NOT NULL,
       mejor_volumen DOUBLE PRECISION NOT NULL DEFAULT 0,
       mejor_peso DOUBLE PRECISION NOT NULL DEFAULT 0,
       mejor_1rm DOUBLE PRECISION NOT NULL DEFAULT 0,
       fecha_actualizacion TIMESTAMP DEFAULT NOW(),
       PRIMARY KEY (usuario_id, ejercicio_id)
     )`
  );
  await queryable.query(
    `CREATE TABLE IF NOT EXISTS sesion_record_evaluacion (
       sesion_id INT PRIMARY KEY,
       usuario_id INT NOT NULL,
       fecha TIMESTAMP DEFAULT NOW()
     )`
  );
  await queryable.query(
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
  await queryable.query(
    `DO $$
     BEGIN
       IF NOT EXISTS (
         SELECT 1
         FROM pg_constraint
         WHERE conname = 'serie_record_trofeo_tipo_record_check'
           AND conrelid = 'serie_record_trofeo'::regclass
       ) THEN
         ALTER TABLE serie_record_trofeo
         ADD CONSTRAINT serie_record_trofeo_tipo_record_check
         CHECK (tipo_record IN ('volumen', 'peso', '1rm'));
       END IF;
     END $$`
  );

  recordTablesReady = true;
};

const estimateOneRm = (peso: number, repeticiones: number) =>
  peso * (1 + repeticiones / 30);

const countTrophiesForSession = async (sesion_id: string, queryable: Queryable = pool) => {
  await ensureRecordTables(pool);
  const result = await queryable.query<{ total_trofeos: number }>(
    `SELECT COUNT(*)::int AS total_trofeos
     FROM serie_record_trofeo
     WHERE sesion_id = $1`,
    [sesion_id]
  );

  return result.rows[0]?.total_trofeos ?? 0;
};

const evaluarRecordsDeSesion = async (sesion: SesionEntrenamientoRow) => {
  await ensureRecordTables(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const alreadyEvaluated = await client.query(
      `SELECT 1
       FROM sesion_record_evaluacion
       WHERE sesion_id = $1`,
      [sesion.id_sesion]
    );

    if (alreadyEvaluated.rows.length > 0) {
      const total = await countTrophiesForSession(String(sesion.id_sesion), client);
      await client.query("COMMIT");
      return total;
    }

    const seriesResult = await client.query<SerieRecordInputRow>(
      `SELECT ejercicio_id,
              orden,
              repeticiones,
              COALESCE(peso, 0)::float AS peso
       FROM serie
       WHERE sesion_id = $1
       ORDER BY ejercicio_id ASC, orden ASC`,
      [sesion.id_sesion]
    );

    const records = new Map<number, ExerciseRecordRow>();
    let totalTrofeos = 0;

    for (const serie of seriesResult.rows) {
      const peso = Number(serie.peso);
      const repeticiones = Number(serie.repeticiones);

      if (!Number.isFinite(peso) || !Number.isFinite(repeticiones) || peso <= 0 || repeticiones <= 0) {
        continue;
      }

      let current = records.get(serie.ejercicio_id);
      if (!current) {
        await client.query(
          `SELECT 1
           FROM usuario_ejercicio_record
           WHERE usuario_id = $1
             AND ejercicio_id = $2
           FOR UPDATE`,
          [sesion.usuario_id, serie.ejercicio_id]
        );
        const historicalResult = await client.query<HistoricalExerciseRecordRow>(
          `SELECT
             COALESCE(MAX(COALESCE(s.peso, 0) * COALESCE(s.repeticiones, 0)), 0)::float AS mejor_volumen,
             COALESCE(MAX(COALESCE(s.peso, 0)), 0)::float AS mejor_peso,
             COALESCE(MAX(COALESCE(s.peso, 0) * (1 + COALESCE(s.repeticiones, 0)::float / 30)), 0)::float AS mejor_1rm
           FROM serie s
           JOIN sesionentrenamiento se ON se.id_sesion = s.sesion_id
           WHERE se.usuario_id = $1
             AND s.ejercicio_id = $2
             AND se.estado = 'finalizada'
             AND se.id_sesion <> $3`,
          [sesion.usuario_id, serie.ejercicio_id, sesion.id_sesion]
        );

        current = {
          mejor_volumen: Number(historicalResult.rows[0]?.mejor_volumen ?? 0),
          mejor_peso: Number(historicalResult.rows[0]?.mejor_peso ?? 0),
          mejor_1rm: Number(historicalResult.rows[0]?.mejor_1rm ?? 0),
        };

        records.set(serie.ejercicio_id, current);
      }

      const volumen = peso * repeticiones;
      const oneRm = estimateOneRm(peso, repeticiones);
      const mejoras: Array<{
        tipo: "volumen" | "peso" | "1rm";
        anterior: number;
        nuevo: number;
      }> = [];

      if (volumen > current.mejor_volumen) {
        mejoras.push({ tipo: "volumen", anterior: current.mejor_volumen, nuevo: volumen });
        current.mejor_volumen = volumen;
      }

      if (peso > current.mejor_peso) {
        mejoras.push({ tipo: "peso", anterior: current.mejor_peso, nuevo: peso });
        current.mejor_peso = peso;
      }

      if (oneRm > current.mejor_1rm) {
        mejoras.push({ tipo: "1rm", anterior: current.mejor_1rm, nuevo: oneRm });
        current.mejor_1rm = oneRm;
      }

      for (const mejora of mejoras) {
        await client.query(
          `INSERT INTO serie_record_trofeo
           (sesion_id, usuario_id, ejercicio_id, orden, tipo_record, valor_anterior, valor_nuevo)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (sesion_id, ejercicio_id, orden, tipo_record) DO NOTHING`,
          [
            sesion.id_sesion,
            sesion.usuario_id,
            serie.ejercicio_id,
            serie.orden,
            mejora.tipo,
            mejora.anterior,
            mejora.nuevo,
          ]
        );
        totalTrofeos += 1;
      }
    }

    for (const [ejercicioId, record] of records) {
      await client.query(
        `INSERT INTO usuario_ejercicio_record
         (usuario_id, ejercicio_id, mejor_volumen, mejor_peso, mejor_1rm, fecha_actualizacion)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (usuario_id, ejercicio_id)
         DO UPDATE SET
           mejor_volumen = EXCLUDED.mejor_volumen,
           mejor_peso = EXCLUDED.mejor_peso,
           mejor_1rm = EXCLUDED.mejor_1rm,
           fecha_actualizacion = NOW()`,
        [
          sesion.usuario_id,
          ejercicioId,
          record.mejor_volumen,
          record.mejor_peso,
          record.mejor_1rm,
        ]
      );
    }

    await client.query(
      `INSERT INTO sesion_record_evaluacion (sesion_id, usuario_id)
       VALUES ($1, $2)
       ON CONFLICT (sesion_id) DO NOTHING`,
      [sesion.id_sesion, sesion.usuario_id]
    );

    await client.query("COMMIT");
    return totalTrofeos;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const reconstruirRecordsDeUsuario = async (usuario_id: number, queryable: Queryable) => {
  await queryable.query(
    `DELETE FROM usuario_ejercicio_record
     WHERE usuario_id = $1`,
    [usuario_id]
  );

  await queryable.query(
    `INSERT INTO usuario_ejercicio_record
     (usuario_id, ejercicio_id, mejor_volumen, mejor_peso, mejor_1rm, fecha_actualizacion)
     SELECT se.usuario_id,
            s.ejercicio_id,
            COALESCE(MAX(COALESCE(s.peso, 0) * COALESCE(s.repeticiones, 0)), 0)::float AS mejor_volumen,
            COALESCE(MAX(COALESCE(s.peso, 0)), 0)::float AS mejor_peso,
            COALESCE(MAX(COALESCE(s.peso, 0) * (1 + COALESCE(s.repeticiones, 0)::float / 30)), 0)::float AS mejor_1rm,
            NOW()
     FROM sesionentrenamiento se
     JOIN serie s ON s.sesion_id = se.id_sesion
     WHERE se.usuario_id = $1
       AND se.estado = 'finalizada'
     GROUP BY se.usuario_id, s.ejercicio_id`,
    [usuario_id]
  );
};

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
      limitDescription(descripcion),
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
      limitDescription(data.descripcion),
      limitTitle(data.nombre_rutina_snapshot ?? data.nombre ?? null),
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
    tipo_serie,
    distancia_km,
    tiempo_segundos,
    nota_ejercicio,
  } = data;

  await ensureSerieTipoSerieColumn(pool);
  const result = await pool.query(
    `INSERT INTO serie
     (repeticiones, peso, descanso, orden, ejercicio_id, sesion_id, tipo_serie, distancia_km, tiempo_segundos, nota_ejercicio)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      repeticiones ?? 0,
      peso ?? null,
      descanso ?? null,
      orden,
      ejercicio_id,
      sesion_id,
      tipo_serie ?? "serie",
      distancia_km ?? null,
      tiempo_segundos ?? null,
      typeof nota_ejercicio === "string" ? nota_ejercicio.trim() || null : null,
    ]
  );

  return result.rows[0];
};

export const getSeriesDeSesion = async (sesion_id: string) => {
  await ensureSerieTipoSerieColumn(pool);
  await ensureRecordTables(pool);
  const result = await pool.query(
    `SELECT s.*,
            e.nombre,
            e.descripcion,
            e.grupo_muscular,
            e.tipo_disciplina,
            e.imagen_url,
            s.nota_ejercicio,
            COALESCE(
              ARRAY(
                SELECT srt.tipo_record
                FROM serie_record_trofeo srt
                WHERE srt.sesion_id = s.sesion_id
                  AND srt.ejercicio_id = s.ejercicio_id
                  AND srt.orden = s.orden
                ORDER BY CASE srt.tipo_record
                  WHEN 'peso' THEN 1
                  WHEN 'volumen' THEN 2
                  WHEN '1rm' THEN 3
                  ELSE 4
                END
              ),
              ARRAY[]::text[]
            ) AS trofeos,
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

export const getSeriesAnterioresDeEjercicio = async (
  usuario_id: number,
  ejercicio_id: number
) => {
  await ensureSerieTipoSerieColumn(pool);
  const result = await pool.query<SerieAnteriorRow>(
    `WITH ultima_sesion AS (
       SELECT se.id_sesion
       FROM sesionentrenamiento se
       JOIN serie s ON s.sesion_id = se.id_sesion
       WHERE se.usuario_id = $1
         AND s.ejercicio_id = $2
         AND se.estado = 'finalizada'
       ORDER BY COALESCE(se.fecha_fin, se.fecha_inicio, se.fecha) DESC,
                se.id_sesion DESC
       LIMIT 1
     )
     SELECT s.orden,
            s.repeticiones,
            s.peso,
            s.distancia_km,
            s.tiempo_segundos,
            COALESCE(s.tipo_serie, 'serie') AS tipo_serie
     FROM serie s
     JOIN ultima_sesion us ON us.id_sesion = s.sesion_id
     WHERE s.ejercicio_id = $2
     ORDER BY s.orden ASC`,
    [usuario_id, ejercicio_id]
  );

  return result.rows;
};

export const addLikeToSesion = async (sesion_id: string, usuario_id: number) => {
  const insertResult = await pool.query(
    `INSERT INTO sesion_like (sesion_id, usuario_id, fecha)
     VALUES ($1, $2, NOW())
     ON CONFLICT (sesion_id, usuario_id) DO NOTHING
     RETURNING sesion_id`,
    [sesion_id, usuario_id]
  );

  if ((insertResult.rowCount ?? 0) > 0) {
    const [sesion, actorResult] = await Promise.all([
      getSesionPorId(sesion_id),
      pool.query<{ username: string }>(
        `SELECT username
         FROM usuario
         WHERE id = $1`,
        [usuario_id]
      ),
    ]);

    if (sesion) {
      const actorUsername = actorResult.rows[0]?.username ?? "Alguien";

      await createNotificationIfAllowed({
        usuario_id: sesion.usuario_id,
        actor_id: usuario_id,
        tipo: "training_like",
        titulo: "Nuevo like en tu entrenamiento",
        mensaje: `${actorUsername} le dio like a tu entrenamiento`,
        referencia_tipo: "sesion_entrenamiento",
        referencia_id: Number(sesion_id),
      });
    }
  }

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
  const [comments, sesion] = await Promise.all([
    getComentariosDeSesion(sesion_id),
    getSesionPorId(sesion_id),
  ]);
  const comentario = comments.find((item) => item.id_comentario === commentId) ?? null;
  const summary = await getSessionInteractionSummary(sesion_id, usuario_id);

  if (sesion && comentario) {
    await createNotificationIfAllowed({
      usuario_id: sesion.usuario_id,
      actor_id: usuario_id,
      tipo: "training_comment",
      titulo: "Nuevo comentario en tu entrenamiento",
      mensaje: `${comentario.username} comentó tu entrenamiento`,
      referencia_tipo: "sesion_entrenamiento",
      referencia_id: Number(sesion_id),
    });
  }

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
    tipo_serie?: string | null;
    distancia_km?: number | null;
    tiempo_segundos?: number | null;
    nota_ejercicio?: string | null;
  }>
) => {
  await ensureSerieTipoSerieColumn(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureRecordTables(pool);
    await client.query(`DELETE FROM serie_record_trofeo WHERE sesion_id = $1`, [sesion_id]);
    await client.query(`DELETE FROM sesion_record_evaluacion WHERE sesion_id = $1`, [sesion_id]);
    await client.query(`DELETE FROM serie WHERE sesion_id = $1`, [sesion_id]);

    for (const serie of series) {
      await client.query(
        `INSERT INTO serie
         (repeticiones, peso, descanso, orden, ejercicio_id, sesion_id, tipo_serie, distancia_km, tiempo_segundos, nota_ejercicio)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          serie.repeticiones ?? 0,
          serie.peso ?? null,
          serie.descanso ?? null,
          serie.orden,
          serie.ejercicio_id,
          sesion_id,
          serie.tipo_serie ?? "serie",
          serie.distancia_km ?? null,
          serie.tiempo_segundos ?? null,
          typeof serie.nota_ejercicio === "string" ? serie.nota_ejercicio.trim() || null : null,
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

  const totalTrofeos = await evaluarRecordsDeSesion(sesionActualizada.rows[0] ?? sesion);
  const series = await getSeriesDeSesion(sesion_id);

  return {
    sesion: sesionActualizada.rows[0] ?? sesion,
    series,
    total_trofeos: totalTrofeos,
    estado: "finalizada" as const,
  };
};

export const abandonarSesion = async (sesion_id: string) => {
  const result = await pool.query<SesionEntrenamientoRow>(
    `UPDATE sesionentrenamiento
     SET fecha_fin = COALESCE(fecha_fin, NOW()),
         estado = 'abandonada'
     WHERE id_sesion = $1
     RETURNING *`,
    [sesion_id]
  );

  return result.rows[0] ?? null;
};

export const deleteSesionEntrenamiento = async (sesion_id: string) => {
  await ensureRecordTables(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const sesionActual = await client.query<{ usuario_id: number }>(
      `SELECT usuario_id
       FROM sesionentrenamiento
       WHERE id_sesion = $1`,
      [sesion_id]
    );
    const usuarioId = sesionActual.rows[0]?.usuario_id ?? null;

    await client.query(`DELETE FROM serie_record_trofeo WHERE sesion_id = $1`, [sesion_id]);
    await client.query(`DELETE FROM sesion_record_evaluacion WHERE sesion_id = $1`, [sesion_id]);
    await client.query(`DELETE FROM sesion_comentario WHERE sesion_id = $1`, [sesion_id]);
    await client.query(`DELETE FROM sesion_like WHERE sesion_id = $1`, [sesion_id]);
    await client.query(`DELETE FROM serie WHERE sesion_id = $1`, [sesion_id]);
    const result = await client.query<SesionEntrenamientoRow>(
      `DELETE FROM sesionentrenamiento
       WHERE id_sesion = $1
       RETURNING *`,
      [sesion_id]
    );

    if (usuarioId != null) {
      await reconstruirRecordsDeUsuario(usuarioId, client);
    }

    await client.query("COMMIT");
    return result.rows[0] ?? null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
