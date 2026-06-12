import { useEffect, useMemo, useState } from "react";
import "./ProMuscleDistribution.css";

type PeriodDays = 30 | 90 | 180;

type MuscleGroup = {
  muscleGroup: string;
  currentSets: number;
  previousSets: number;
};

type MuscleDistributionResponse = {
  periodDays: PeriodDays;
  groups: MuscleGroup[];
  totals: {
    currentSets: number;
    previousSets: number;
  };
};

type ProMuscleDistributionProps = {
  authToken: string;
  onAuthExpired: () => void;
};

const API = "http://localhost:3000";
const CHART_SIZE = 420;
const CENTER = CHART_SIZE / 2;
const RADIUS = 130;

const getPoint = (index: number, total: number, radius: number) => {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
  };
};

const toPolygon = (values: number[], maxValue: number) =>
  values
    .map((value, index) => {
      const point = getPoint(index, values.length, (value / maxValue) * RADIUS);
      return `${point.x},${point.y}`;
    })
    .join(" ");

function ProMuscleDistribution({
  authToken,
  onAuthExpired,
}: ProMuscleDistributionProps) {
  const [period, setPeriod] = useState<PeriodDays>(30);
  const [data, setData] = useState<MuscleDistributionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API}/suscripciones/stats/muscle-distribution?days=${period}`,
          { headers: { Authorization: `Bearer ${authToken}` } },
        );
        const payload = (await response.json()) as
          | MuscleDistributionResponse
          | { error?: string };

        if (response.status === 401) {
          onAuthExpired();
          return;
        }
        if (!response.ok) {
          throw new Error(
            "error" in payload
              ? payload.error || "No se pudo cargar la distribucion muscular"
              : "No se pudo cargar la distribucion muscular",
          );
        }

        if (!cancelled) {
          setData(payload as MuscleDistributionResponse);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo cargar la distribucion muscular",
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
    const groups = data?.groups.slice(0, 8) ?? [];
    const maxValue = Math.max(
      ...groups.flatMap((group) => [group.currentSets, group.previousSets]),
      1,
    );

    return {
      groups,
      maxValue,
      current: toPolygon(
        groups.map((group) => group.currentSets),
        maxValue,
      ),
      previous: toPolygon(
        groups.map((group) => group.previousSets),
        maxValue,
      ),
    };
  }, [data]);

  const summary = useMemo(() => {
    const groups = chart.groups;
    const mainGroup = groups.reduce<MuscleGroup | null>(
      (best, group) =>
        !best || group.currentSets > best.currentSets ? group : best,
      null,
    );
    const previousTotal = data?.totals.previousSets ?? 0;
    const currentTotal = data?.totals.currentSets ?? 0;
    const difference = currentTotal - previousTotal;

    return {
      mainGroup,
      activeGroups: groups.filter((group) => group.currentSets > 0).length,
      difference,
    };
  }, [chart.groups, data]);

  return (
    <section className="pro-muscle-distribution">
      <header className="pro-muscle-header">
        <div>
          <p className="eyebrow">Balance muscular</p>
          <h2>Distribucion de grupos musculares</h2>
          <p>Compara las series realizadas por cada zona de tu cuerpo.</p>
        </div>
        <label>
          <span>Periodo</span>
          <select
            className="field"
            value={period}
            onChange={(event) => setPeriod(Number(event.target.value) as PeriodDays)}
          >
            <option value={30}>Ultimos 30 dias</option>
            <option value={90}>Ultimos 3 meses</option>
            <option value={180}>Ultimos 6 meses</option>
          </select>
        </label>
      </header>

      {loading ? <div className="status">Analizando tus grupos musculares...</div> : null}
      {error ? <div className="status error">{error}</div> : null}

      {!loading && !error && data ? (
        chart.groups.length >= 3 ? (
          <div className="pro-muscle-content">
            <div className="pro-radar-wrap">
              <svg
                className="pro-radar"
                viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
                role="img"
                aria-label="Comparacion de series por grupo muscular"
              >
                {[0.25, 0.5, 0.75, 1].map((level) => (
                  <polygon
                    className="pro-radar-grid"
                    key={level}
                    points={chart.groups
                      .map((_, index) => {
                        const point = getPoint(
                          index,
                          chart.groups.length,
                          RADIUS * level,
                        );
                        return `${point.x},${point.y}`;
                      })
                      .join(" ")}
                  />
                ))}
                {chart.groups.map((group, index) => {
                  const edge = getPoint(index, chart.groups.length, RADIUS);
                  const label = getPoint(index, chart.groups.length, RADIUS + 38);
                  return (
                    <g key={group.muscleGroup}>
                      <line
                        className="pro-radar-axis"
                        x1={CENTER}
                        y1={CENTER}
                        x2={edge.x}
                        y2={edge.y}
                      />
                      <text
                        className="pro-radar-label"
                        x={label.x}
                        y={label.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {group.muscleGroup}
                      </text>
                    </g>
                  );
                })}
                <polygon className="pro-radar-previous" points={chart.previous} />
                <polygon className="pro-radar-current" points={chart.current} />
              </svg>
              <div className="pro-radar-legend">
                <span><i className="current" />Actual</span>
                <span><i className="previous" />Anterior</span>
              </div>
            </div>

            <div className="pro-muscle-summary">
              <article>
                <span>Series</span>
                <strong>{data.totals.currentSets}</strong>
                <small>
                  {summary.difference >= 0 ? "+" : ""}
                  {summary.difference} vs. periodo anterior
                </small>
              </article>
              <article>
                <span>Grupos trabajados</span>
                <strong>{summary.activeGroups}</strong>
                <small>zonas con series registradas</small>
              </article>
              <article>
                <span>Mayor enfoque</span>
                <strong>{summary.mainGroup?.muscleGroup ?? "-"}</strong>
                <small>{summary.mainGroup?.currentSets ?? 0} series</small>
              </article>
              <article>
                <span>Periodo anterior</span>
                <strong>{data.totals.previousSets}</strong>
                <small>series para comparar</small>
              </article>
            </div>
          </div>
        ) : (
          <div className="pro-muscle-empty">
            <strong>Todavia faltan datos para armar tu distribucion.</strong>
            <p>Registra series en al menos tres grupos musculares diferentes.</p>
          </div>
        )
      ) : null}
    </section>
  );
}

export default ProMuscleDistribution;
