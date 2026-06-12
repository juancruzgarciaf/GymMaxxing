import { useEffect, useMemo, useState } from "react";
import "./ProExerciseProgress.css";

type Metric = "maxWeight" | "repetitions" | "volume";
type PeriodDays = 90 | 180 | 365;

type TrainedExercise = {
  exerciseId: number;
  name: string;
  muscleGroup: string | null;
  sessions: number;
  lastTrained: string;
};

type ProgressPoint = {
  sessionId: number;
  trainedOn: string;
  maxWeight: number;
  repetitions: number;
  volume: number;
  estimatedOneRm: number;
};

type ExerciseProgressResponse = {
  periodDays: PeriodDays;
  exercise: {
    exerciseId: number;
    name: string;
    muscleGroup: string | null;
  };
  points: ProgressPoint[];
  records: {
    maxWeight: number;
    maxVolume: number;
    maxRepetitions: number;
    estimatedOneRm: number;
  };
};

type ProExerciseProgressProps = {
  authToken: string;
  onAuthExpired: () => void;
};

const API = "http://localhost:3000";
const WIDTH = 820;
const HEIGHT = 300;
const PADDING_X = 48;
const PADDING_Y = 32;

const metricConfig: Record<Metric, { label: string; suffix: string }> = {
  maxWeight: { label: "Peso maximo", suffix: "kg" },
  repetitions: { label: "Repeticiones", suffix: "reps" },
  volume: { label: "Volumen", suffix: "kg" },
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));

function ProExerciseProgress({
  authToken,
  onAuthExpired,
}: ProExerciseProgressProps) {
  const [exercises, setExercises] = useState<TrainedExercise[]>([]);
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [metric, setMetric] = useState<Metric>("maxWeight");
  const [period, setPeriod] = useState<PeriodDays>(180);
  const [data, setData] = useState<ExerciseProgressResponse | null>(null);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadExercises = async () => {
      try {
        setLoadingExercises(true);
        setError("");
        const response = await fetch(`${API}/suscripciones/stats/exercises`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const payload = (await response.json()) as TrainedExercise[] | { error?: string };

        if (response.status === 401) {
          onAuthExpired();
          return;
        }
        if (!response.ok || !Array.isArray(payload)) {
          throw new Error(
            !Array.isArray(payload) && payload.error
              ? payload.error
              : "No se pudieron cargar tus ejercicios",
          );
        }

        if (!cancelled) {
          setExercises(payload);
          setExerciseId((current) => current ?? payload[0]?.exerciseId ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudieron cargar tus ejercicios",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingExercises(false);
        }
      }
    };

    void loadExercises();
    return () => {
      cancelled = true;
    };
  }, [authToken, onAuthExpired]);

  useEffect(() => {
    if (!exerciseId) {
      setData(null);
      return;
    }

    let cancelled = false;
    const loadProgress = async () => {
      try {
        setLoadingProgress(true);
        setError("");
        const params = new URLSearchParams({
          exerciseId: String(exerciseId),
          days: String(period),
        });
        const response = await fetch(
          `${API}/suscripciones/stats/exercise-progress?${params.toString()}`,
          { headers: { Authorization: `Bearer ${authToken}` } },
        );
        const payload = (await response.json()) as
          | ExerciseProgressResponse
          | { error?: string };

        if (response.status === 401) {
          onAuthExpired();
          return;
        }
        if (!response.ok) {
          throw new Error(
            "error" in payload
              ? payload.error || "No se pudo cargar el progreso"
              : "No se pudo cargar el progreso",
          );
        }
        if (!cancelled) {
          setData(payload as ExerciseProgressResponse);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo cargar el progreso",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingProgress(false);
        }
      }
    };

    void loadProgress();
    return () => {
      cancelled = true;
    };
  }, [authToken, exerciseId, onAuthExpired, period]);

  const chart = useMemo(() => {
    const points = data?.points ?? [];
    const values = points.map((point) => point[metric]);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = Math.max(max - min, 1);
    const drawableWidth = WIDTH - PADDING_X * 2;
    const drawableHeight = HEIGHT - PADDING_Y * 2;

    return points.map((point, index) => ({
      ...point,
      value: values[index],
      x:
        points.length === 1
          ? WIDTH / 2
          : PADDING_X + (index / (points.length - 1)) * drawableWidth,
      y: PADDING_Y + (1 - (values[index] - min) / range) * drawableHeight,
    }));
  }, [data, metric]);

  const linePoints = chart.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <section className="pro-exercise-progress">
      <header className="pro-exercise-header">
        <div>
          <p className="eyebrow">Progreso por ejercicio</p>
          <h2>Tu evolucion, movimiento por movimiento</h2>
          <p>Revisa como cambian tu peso, repeticiones y volumen con el tiempo.</p>
        </div>
        <div className="pro-exercise-filters">
          <label>
            <span>Ejercicio</span>
            <select
              className="field"
              value={exerciseId ?? ""}
              disabled={exercises.length === 0}
              onChange={(event) => setExerciseId(Number(event.target.value))}
            >
              {exercises.map((exercise) => (
                <option value={exercise.exerciseId} key={exercise.exerciseId}>
                  {exercise.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Periodo</span>
            <select
              className="field"
              value={period}
              onChange={(event) => setPeriod(Number(event.target.value) as PeriodDays)}
            >
              <option value={90}>Ultimos 3 meses</option>
              <option value={180}>Ultimos 6 meses</option>
              <option value={365}>Ultimo ano</option>
            </select>
          </label>
        </div>
      </header>

      {loadingExercises || loadingProgress ? (
        <div className="status">Calculando el progreso del ejercicio...</div>
      ) : null}
      {error ? <div className="status error">{error}</div> : null}

      {!loadingExercises && exercises.length === 0 && !error ? (
        <div className="pro-exercise-empty">
          <strong>Todavia no hay ejercicios con series registradas.</strong>
          <p>Finaliza un entrenamiento con peso o repeticiones para ver su evolucion.</p>
        </div>
      ) : null}

      {!loadingProgress && data && !error ? (
        <>
          <div className="pro-exercise-tabs" role="tablist" aria-label="Metrica del ejercicio">
            {(Object.keys(metricConfig) as Metric[]).map((item) => (
              <button
                type="button"
                role="tab"
                aria-selected={metric === item}
                className={metric === item ? "active" : ""}
                onClick={() => setMetric(item)}
                key={item}
              >
                {metricConfig[item].label}
              </button>
            ))}
          </div>

          {chart.length > 0 ? (
            <div className="pro-line-scroll">
              <svg
                className="pro-line-chart"
                viewBox={`0 0 ${WIDTH} ${HEIGHT + 36}`}
                role="img"
                aria-label={`Evolucion de ${metricConfig[metric].label.toLowerCase()}`}
              >
                {[0, 1, 2, 3].map((line) => {
                  const y = PADDING_Y + (line / 3) * (HEIGHT - PADDING_Y * 2);
                  return (
                    <line
                      className="pro-line-grid"
                      x1={PADDING_X}
                      x2={WIDTH - PADDING_X}
                      y1={y}
                      y2={y}
                      key={line}
                    />
                  );
                })}
                {chart.length > 1 ? (
                  <polyline className="pro-line-path" points={linePoints} />
                ) : null}
                {chart.map((point) => (
                  <g key={point.sessionId}>
                    <circle className="pro-line-dot" cx={point.x} cy={point.y} r="6" />
                    <text className="pro-line-value" x={point.x} y={point.y - 14}>
                      {formatNumber(point.value)} {metricConfig[metric].suffix}
                    </text>
                    <text className="pro-line-date" x={point.x} y={HEIGHT + 18}>
                      {formatDate(point.trainedOn)}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          ) : (
            <div className="pro-exercise-empty">
              <strong>No hay registros dentro de este periodo.</strong>
              <p>Prueba seleccionando un periodo mas amplio.</p>
            </div>
          )}

          <div className="pro-exercise-records">
            <article>
              <span>Mejor peso</span>
              <strong>{formatNumber(data.records.maxWeight)} kg</strong>
            </article>
            <article>
              <span>Mayor volumen</span>
              <strong>{formatNumber(data.records.maxVolume)} kg</strong>
            </article>
            <article>
              <span>Maximo de reps</span>
              <strong>{formatNumber(data.records.maxRepetitions)}</strong>
            </article>
            <article>
              <span>1RM estimado</span>
              <strong>{formatNumber(data.records.estimatedOneRm)} kg</strong>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default ProExerciseProgress;
