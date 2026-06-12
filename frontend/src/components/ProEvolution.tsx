import { useEffect, useMemo, useState, type CSSProperties } from "react";
import "./ProEvolution.css";

type Metric = "durationSeconds" | "volume" | "repetitions";
type PeriodWeeks = 4 | 12 | 26;

type EvolutionPoint = {
  weekStart: string;
  workouts: number;
  durationSeconds: number;
  volume: number;
  repetitions: number;
};

type EvolutionResponse = {
  periodWeeks: PeriodWeeks;
  points: EvolutionPoint[];
  totals: {
    workouts: number;
    durationSeconds: number;
    volume: number;
    repetitions: number;
  };
};

type ProEvolutionProps = {
  authToken: string;
  onAuthExpired: () => void;
  onClose: () => void;
};

const API = "http://localhost:3000";

const metricConfig: Record<
  Metric,
  { label: string; shortLabel: string; value: (point: EvolutionPoint) => number }
> = {
  durationSeconds: {
    label: "Duracion",
    shortLabel: "de entrenamiento",
    value: (point) => point.durationSeconds,
  },
  volume: {
    label: "Volumen",
    shortLabel: "levantados",
    value: (point) => point.volume,
  },
  repetitions: {
    label: "Repeticiones",
    shortLabel: "realizadas",
    value: (point) => point.repetitions,
  },
};

const formatDuration = (seconds: number) => {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }
  return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
};

const formatCompact = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(Math.round(value));

const formatMetric = (metric: Metric, value: number) => {
  if (metric === "durationSeconds") {
    return formatDuration(value);
  }
  if (metric === "volume") {
    return `${formatCompact(value)} kg`;
  }
  return `${formatCompact(value)} reps`;
};

const formatWeek = (date: string) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

function ProEvolution({ authToken, onAuthExpired, onClose }: ProEvolutionProps) {
  const [metric, setMetric] = useState<Metric>("durationSeconds");
  const [period, setPeriod] = useState<PeriodWeeks>(12);
  const [data, setData] = useState<EvolutionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API}/suscripciones/stats/evolution?weeks=${period}`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          },
        );
        const payload = (await response.json()) as EvolutionResponse | { error?: string };

        if (response.status === 401) {
          onAuthExpired();
          return;
        }
        if (!response.ok) {
          throw new Error(
            "error" in payload
              ? payload.error || "No se pudieron cargar las estadisticas"
              : "No se pudieron cargar las estadisticas",
          );
        }

        if (!cancelled) {
          setData(payload as EvolutionResponse);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudieron cargar las estadisticas",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [authToken, onAuthExpired, period]);

  const chart = useMemo(() => {
    const values = data?.points.map(metricConfig[metric].value) ?? [];
    return {
      values,
      max: Math.max(...values, 1),
    };
  }, [data, metric]);

  const currentWeek = data?.points[data.points.length - 1];
  const currentValue = currentWeek ? metricConfig[metric].value(currentWeek) : 0;

  return (
    <section className="pro-evolution">
      <header className="pro-evolution-header">
        <div>
          <p className="eyebrow">Estadisticas avanzadas</p>
          <h2>Evolucion del entrenamiento</h2>
          <p>Compara tu constancia y rendimiento semana a semana.</p>
        </div>
        <button type="button" className="btn secondary compact" onClick={onClose}>
          Cerrar
        </button>
      </header>

      <div className="pro-evolution-toolbar">
        <div className="pro-evolution-current">
          <strong>{formatMetric(metric, currentValue)}</strong>
          <span>esta semana</span>
        </div>
        <label>
          <span>Periodo</span>
          <select
            className="field"
            value={period}
            onChange={(event) => setPeriod(Number(event.target.value) as PeriodWeeks)}
          >
            <option value={4}>Ultimas 4 semanas</option>
            <option value={12}>Ultimos 3 meses</option>
            <option value={26}>Ultimos 6 meses</option>
          </select>
        </label>
      </div>

      <div className="pro-metric-tabs" role="tablist" aria-label="Metrica del grafico">
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

      {loading ? <div className="status">Calculando tu progreso...</div> : null}
      {error ? <div className="status error">{error}</div> : null}

      {!loading && !error && data ? (
        <>
          <div className="pro-bars-scroll">
            <div
              className="pro-bars-chart"
              style={{ "--bar-count": data.points.length } as CSSProperties}
            >
              {data.points.map((point, index) => {
                const value = chart.values[index] ?? 0;
                const height = value === 0 ? 2 : Math.max((value / chart.max) * 100, 7);

                return (
                  <div className="pro-bar-column" key={point.weekStart}>
                    <div className="pro-bar-value">{value > 0 ? formatMetric(metric, value) : ""}</div>
                    <div className="pro-bar-track">
                      <span style={{ height: `${height}%` }} />
                    </div>
                    <small>{formatWeek(point.weekStart)}</small>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pro-evolution-summary">
            <article>
              <span>Entrenamientos</span>
              <strong>{data.totals.workouts}</strong>
            </article>
            <article>
              <span>Duracion total</span>
              <strong>{formatDuration(data.totals.durationSeconds)}</strong>
            </article>
            <article>
              <span>Volumen total</span>
              <strong>{formatCompact(data.totals.volume)} kg</strong>
            </article>
            <article>
              <span>Repeticiones</span>
              <strong>{formatCompact(data.totals.repetitions)}</strong>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default ProEvolution;
