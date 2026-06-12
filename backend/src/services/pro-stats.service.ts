import { pool } from "../db";

export type ProStatsPeriod = 4 | 12 | 26;

type WeeklyEvolutionRow = {
  week_start: string;
  workouts: number;
  duration_seconds: number;
  volume: number;
  repetitions: number;
};

export const getWeeklyEvolution = async (
  userId: number,
  weeks: ProStatsPeriod,
) => {
  const result = await pool.query<WeeklyEvolutionRow>(
    `WITH requested_weeks AS (
       SELECT generate_series(
         date_trunc('week', CURRENT_DATE) - (($2::int - 1) * INTERVAL '1 week'),
         date_trunc('week', CURRENT_DATE),
         INTERVAL '1 week'
       ) AS week_start
     ),
     session_metrics AS (
       SELECT
         se.id_sesion,
         date_trunc('week', COALESCE(se.fecha_fin, se.fecha_inicio, se.fecha)) AS week_start,
         COALESCE(
           se.duracion_segundos,
           CASE
             WHEN se.fecha_inicio IS NOT NULL AND se.fecha_fin IS NOT NULL
               THEN GREATEST(EXTRACT(EPOCH FROM (se.fecha_fin - se.fecha_inicio))::int, 0)
             ELSE 0
           END,
           0
         )::float AS duration_seconds,
         COALESCE(
           se.volumen_total,
           (
             SELECT SUM(COALESCE(s.peso, 0) * COALESCE(s.repeticiones, 0))
             FROM serie s
             WHERE s.sesion_id = se.id_sesion
           ),
           0
         )::float AS volume,
         COALESCE(
           (
             SELECT SUM(COALESCE(s.repeticiones, 0))
             FROM serie s
             WHERE s.sesion_id = se.id_sesion
           ),
           0
         )::int AS repetitions
       FROM sesionentrenamiento se
       WHERE se.usuario_id = $1
         AND se.estado = 'finalizada'
         AND COALESCE(se.fecha_fin, se.fecha_inicio, se.fecha)
           >= date_trunc('week', CURRENT_DATE) - (($2::int - 1) * INTERVAL '1 week')
     )
     SELECT
       rw.week_start::date::text,
       COUNT(sm.id_sesion)::int AS workouts,
       COALESCE(SUM(sm.duration_seconds), 0)::float AS duration_seconds,
       COALESCE(SUM(sm.volume), 0)::float AS volume,
       COALESCE(SUM(sm.repetitions), 0)::int AS repetitions
     FROM requested_weeks rw
     LEFT JOIN session_metrics sm ON sm.week_start = rw.week_start
     GROUP BY rw.week_start
     ORDER BY rw.week_start ASC`,
    [userId, weeks],
  );

  const points = result.rows.map((row) => ({
    weekStart: row.week_start,
    workouts: Number(row.workouts),
    durationSeconds: Number(row.duration_seconds),
    volume: Number(row.volume),
    repetitions: Number(row.repetitions),
  }));

  return {
    periodWeeks: weeks,
    points,
    totals: points.reduce(
      (acc, point) => ({
        workouts: acc.workouts + point.workouts,
        durationSeconds: acc.durationSeconds + point.durationSeconds,
        volume: acc.volume + point.volume,
        repetitions: acc.repetitions + point.repetitions,
      }),
      {
        workouts: 0,
        durationSeconds: 0,
        volume: 0,
        repetitions: 0,
      },
    ),
  };
};
