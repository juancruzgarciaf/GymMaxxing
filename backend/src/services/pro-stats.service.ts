import { pool } from "../db";

export type ProStatsPeriod = 4 | 12 | 26;
export type MuscleStatsPeriod = 30 | 90 | 180;
export type ExerciseProgressPeriod = 90 | 180 | 365;

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

type TrainedExerciseRow = {
  id_exercise: number;
  name: string;
  muscle_group: string | null;
  sessions: number;
  last_trained: string;
};

type ExerciseProgressRow = {
  session_id: number;
  trained_on: string;
  max_weight: number;
  repetitions: number;
  volume: number;
  estimated_one_rm: number;
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

export const getTrainedExercises = async (userId: number) => {
  const result = await pool.query<TrainedExerciseRow>(
    `SELECT
       e.id_ejercicio AS id_exercise,
       e.nombre AS name,
       e.grupo_muscular AS muscle_group,
       COUNT(DISTINCT se.id_sesion)::int AS sessions,
       MAX(COALESCE(se.fecha_fin, se.fecha_inicio, se.fecha))::date::text AS last_trained
     FROM serie s
     JOIN sesionentrenamiento se ON se.id_sesion = s.sesion_id
     JOIN ejercicio e ON e.id_ejercicio = s.ejercicio_id
     WHERE se.usuario_id = $1
       AND se.estado = 'finalizada'
     GROUP BY e.id_ejercicio, e.nombre, e.grupo_muscular
     ORDER BY last_trained DESC, e.nombre ASC`,
    [userId],
  );

  return result.rows.map((row) => ({
    exerciseId: Number(row.id_exercise),
    name: row.name,
    muscleGroup: row.muscle_group,
    sessions: Number(row.sessions),
    lastTrained: row.last_trained,
  }));
};

export const getExerciseProgress = async (
  userId: number,
  exerciseId: number,
  days: ExerciseProgressPeriod,
) => {
  const exerciseResult = await pool.query<{
    id_ejercicio: number;
    nombre: string;
    grupo_muscular: string | null;
  }>(
    `SELECT id_ejercicio, nombre, grupo_muscular
     FROM ejercicio
     WHERE id_ejercicio = $1`,
    [exerciseId],
  );

  if (!exerciseResult.rows[0]) {
    return null;
  }

  const result = await pool.query<ExerciseProgressRow>(
    `SELECT
       se.id_sesion AS session_id,
       COALESCE(se.fecha_fin, se.fecha_inicio, se.fecha)::date::text AS trained_on,
       COALESCE(MAX(COALESCE(s.peso, 0)), 0)::float AS max_weight,
       COALESCE(SUM(COALESCE(s.repeticiones, 0)), 0)::int AS repetitions,
       COALESCE(SUM(COALESCE(s.peso, 0) * COALESCE(s.repeticiones, 0)), 0)::float AS volume,
       COALESCE(
         MAX(COALESCE(s.peso, 0) * (1 + COALESCE(s.repeticiones, 0)::float / 30)),
         0
       )::float AS estimated_one_rm
     FROM sesionentrenamiento se
     JOIN serie s ON s.sesion_id = se.id_sesion
     WHERE se.usuario_id = $1
       AND s.ejercicio_id = $2
       AND se.estado = 'finalizada'
       AND COALESCE(se.fecha_fin, se.fecha_inicio, se.fecha)
         >= CURRENT_DATE - ($3::int * INTERVAL '1 day')
     GROUP BY se.id_sesion, COALESCE(se.fecha_fin, se.fecha_inicio, se.fecha)::date
     ORDER BY trained_on ASC, se.id_sesion ASC`,
    [userId, exerciseId, days],
  );

  const points = result.rows.map((row) => ({
    sessionId: Number(row.session_id),
    trainedOn: row.trained_on,
    maxWeight: Number(row.max_weight),
    repetitions: Number(row.repetitions),
    volume: Number(row.volume),
    estimatedOneRm: Number(row.estimated_one_rm),
  }));

  return {
    periodDays: days,
    exercise: {
      exerciseId: Number(exerciseResult.rows[0].id_ejercicio),
      name: exerciseResult.rows[0].nombre,
      muscleGroup: exerciseResult.rows[0].grupo_muscular,
    },
    points,
    records: points.reduce(
      (records, point) => ({
        maxWeight: Math.max(records.maxWeight, point.maxWeight),
        maxVolume: Math.max(records.maxVolume, point.volume),
        maxRepetitions: Math.max(records.maxRepetitions, point.repetitions),
        estimatedOneRm: Math.max(records.estimatedOneRm, point.estimatedOneRm),
      }),
      {
        maxWeight: 0,
        maxVolume: 0,
        maxRepetitions: 0,
        estimatedOneRm: 0,
      },
    ),
  };
};
