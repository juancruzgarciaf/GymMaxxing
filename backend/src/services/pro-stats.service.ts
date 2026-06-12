import { pool } from "../db";

export type ProStatsPeriod = 4 | 12 | 26;
export type MuscleStatsPeriod = 30 | 90 | 180;

type WeeklyEvolutionRow = {
  week_start: string;
  workouts: number;
  duration_seconds: number;
  volume: number;
  repetitions: number;
};

type MuscleDistributionRow = {
  muscle_group: string;
  current_sets: number;
  previous_sets: number;
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

export const getMuscleDistribution = async (
  userId: number,
  days: MuscleStatsPeriod,
) => {
  const result = await pool.query<MuscleDistributionRow>(
    `WITH categorized_sets AS (
       SELECT
         CASE
           WHEN LOWER(COALESCE(e.grupo_muscular, '')) ~ 'pecho|pectoral' THEN 'Pecho'
           WHEN LOWER(COALESCE(e.grupo_muscular, '')) ~ 'espalda|dorsal|trapecio' THEN 'Espalda'
           WHEN LOWER(COALESCE(e.grupo_muscular, '')) ~ 'hombro|deltoide' THEN 'Hombros'
           WHEN LOWER(COALESCE(e.grupo_muscular, '')) ~ 'biceps|bíceps|triceps|tríceps|brazo|antebrazo' THEN 'Brazos'
           WHEN LOWER(COALESCE(e.grupo_muscular, '')) ~ 'pierna|cuadriceps|cuádriceps|femoral|isquio|gemelo|pantorrilla|gluteo|glúteo' THEN 'Piernas'
           WHEN LOWER(COALESCE(e.grupo_muscular, '')) ~ 'core|abdomen|abdominal|lumbar' THEN 'Core'
           ELSE INITCAP(NULLIF(TRIM(e.grupo_muscular), ''))
         END AS muscle_group,
         COALESCE(se.fecha_fin, se.fecha_inicio, se.fecha)::date AS trained_on
       FROM serie s
       JOIN sesionentrenamiento se ON se.id_sesion = s.sesion_id
       JOIN ejercicio e ON e.id_ejercicio = s.ejercicio_id
       WHERE se.usuario_id = $1
         AND se.estado = 'finalizada'
         AND COALESCE(se.fecha_fin, se.fecha_inicio, se.fecha)
           >= CURRENT_DATE - (($2::int * 2) * INTERVAL '1 day')
     )
     SELECT
       muscle_group,
       COUNT(*) FILTER (
         WHERE trained_on >= CURRENT_DATE - ($2::int * INTERVAL '1 day')
       )::int AS current_sets,
       COUNT(*) FILTER (
         WHERE trained_on < CURRENT_DATE - ($2::int * INTERVAL '1 day')
           AND trained_on >= CURRENT_DATE - (($2::int * 2) * INTERVAL '1 day')
       )::int AS previous_sets
     FROM categorized_sets
     WHERE muscle_group IS NOT NULL
     GROUP BY muscle_group
     HAVING COUNT(*) > 0
     ORDER BY current_sets DESC, previous_sets DESC, muscle_group ASC`,
    [userId, days],
  );

  const groups = result.rows.map((row) => ({
    muscleGroup: row.muscle_group,
    currentSets: Number(row.current_sets),
    previousSets: Number(row.previous_sets),
  }));

  return {
    periodDays: days,
    groups,
    totals: groups.reduce(
      (acc, group) => ({
        currentSets: acc.currentSets + group.currentSets,
        previousSets: acc.previousSets + group.previousSets,
      }),
      { currentSets: 0, previousSets: 0 },
    ),
  };
};
