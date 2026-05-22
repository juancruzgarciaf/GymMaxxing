import { useEffect, useMemo, useState } from "react";
import type { DiscoverRoutineSummary, EntrenamientoResumen, Usuario } from "../types";
import VerifiedBadge from "../components/VerifiedBadge";
import trendsEmptyBodybuilder from "../assets/trends-empty-bodybuilder.png";

type TrendUser = Usuario & {
  followers_count: number;
  following_count: number;
  trainings_count: number;
  viewer_follows: boolean;
};

type TrendsResponse = {
  rutinas_mas_copiadas: DiscoverRoutineSummary[];
  rutinas_mas_guardadas: DiscoverRoutineSummary[];
  usuarios_mas_seguidos: TrendUser[];
  entrenamientos_mas_likeados: EntrenamientoResumen[];
  entrenamientos_mas_comentados: EntrenamientoResumen[];
  entrenamientos_mayor_volumen: EntrenamientoResumen[];
};

type TrendKind = keyof TrendsResponse;
type TrendItem = DiscoverRoutineSummary | TrendUser | EntrenamientoResumen;

type TrendConfig = {
  key: TrendKind;
  title: string;
  subtitle: string;
  empty: string;
};

type TendenciasProps = {
  usuario: Usuario;
  onOpenProfile?: (username: string) => void;
  onOpenTraining?: (training: EntrenamientoResumen) => void;
};

const API = "http://localhost:3000";

const TREND_CONFIGS: TrendConfig[] = [
  {
    key: "rutinas_mas_copiadas",
    title: "Top 10 Rutinas mas usadas",
    subtitle: "Las rutinas que mas gente copio para entrenar.",
    empty: "Todavia no hay rutinas copiadas.",
  },
  {
    key: "rutinas_mas_guardadas",
    title: "Top 10 Rutinas mas guardadas",
    subtitle: "Las rutinas que mas usuarios guardaron.",
    empty: "Todavia no hay rutinas guardadas.",
  },
  {
    key: "usuarios_mas_seguidos",
    title: "Top 10 Usuarios mas seguidos",
    subtitle: "Los perfiles que mas comunidad estan juntando.",
    empty: "Todavia no hay seguidores suficientes.",
  },
  {
    key: "entrenamientos_mas_likeados",
    title: "Top 10 Entrenamientos mas bancados",
    subtitle: "Sesiones finalizadas con mas likes.",
    empty: "Todavia no hay entrenamientos con likes.",
  },
  {
    key: "entrenamientos_mas_comentados",
    title: "Top 10 Entrenamientos mas hablados",
    subtitle: "Sesiones que mas conversacion generaron.",
    empty: "Todavia no hay entrenamientos comentados.",
  },
  {
    key: "entrenamientos_mayor_volumen",
    title: "Top 10 Mayor volumen levantado",
    subtitle: "Sesiones ordenadas por kg x reps totales.",
    empty: "Todavia no hay volumen registrado.",
  },
];

const isRoutine = (item: TrendItem): item is DiscoverRoutineSummary =>
  "id_rutina" in item;

const isTrendUser = (item: TrendItem): item is TrendUser =>
  "followers_count" in item && "tipo_usuario" in item && !("id_sesion" in item);

const isTraining = (item: TrendItem): item is EntrenamientoResumen =>
  "id_sesion" in item;

const formatNumber = (value: number | null | undefined) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value ?? 0);

const getMetricText = (kind: TrendKind, item: TrendItem) => {
  if (isRoutine(item)) {
    return kind === "rutinas_mas_copiadas"
      ? `${formatNumber(item.copy_count)} copias`
      : `${formatNumber(item.save_count)} guardados`;
  }

  if (isTrendUser(item)) {
    return `${formatNumber(item.followers_count)} seguidores`;
  }

  if (kind === "entrenamientos_mas_likeados") {
    return `${formatNumber(item.likes_count)} likes`;
  }

  if (kind === "entrenamientos_mas_comentados") {
    return `${formatNumber(item.comments_count)} comentarios`;
  }

  return `${formatNumber(item.volumen_total)} kg x reps`;
};

const getTitle = (item: TrendItem) => {
  if (isRoutine(item)) {
    return item.nombre;
  }

  if (isTrendUser(item)) {
    return item.username;
  }

  return item.titulo;
};

const getSubtitle = (item: TrendItem) => {
  if (isRoutine(item)) {
    return `Por ${item.creador_username} · ${item.total_ejercicios} ejercicios`;
  }

  if (isTrendUser(item)) {
    return `${item.trainings_count} entrenamientos · ${item.following_count} seguidos`;
  }

  return `Por ${item.username} · ${item.total_series} series · ${item.total_ejercicios} ejercicios`;
};

function Tendencias({ usuario, onOpenProfile, onOpenTraining }: TendenciasProps) {
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [selectedTrend, setSelectedTrend] = useState<TrendKind | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadTrends = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API}/users/trends?viewer_id=${usuario.id}`);
        const data = (await res.json()) as TrendsResponse | { error?: string };

        if (!res.ok) {
          throw new Error("error" in data ? data.error || "No se pudieron cargar tendencias" : "No se pudieron cargar tendencias");
        }

        if (!cancelled) {
          setTrends(data as TrendsResponse);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar tendencias");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadTrends();

    return () => {
      cancelled = true;
    };
  }, [usuario.id]);

  const selectedConfig = useMemo(
    () =>
      selectedTrend == null
        ? null
        : TREND_CONFIGS.find((config) => config.key === selectedTrend) ?? null,
    [selectedTrend],
  );

  const selectedItems = selectedTrend == null ? [] : trends?.[selectedTrend] ?? [];

  return (
    <>
      <section className="trend-switcher" aria-label="Rankings de tendencias">
        {TREND_CONFIGS.map((config) => (
          <button
            key={config.key}
            type="button"
            className={`trend-tab ${selectedTrend === config.key ? "active" : ""}`}
            onClick={() => setSelectedTrend(config.key)}
          >
            <span>{config.title}</span>
            <small>{config.subtitle}</small>
          </button>
        ))}
      </section>

      {loading ? <div className="status">Cargando tendencias...</div> : null}
      {error ? <div className="status error">{error}</div> : null}

      {!loading && !error && selectedConfig ? (
        <section className="trend-panel">
          <div className="trend-panel-head">
            <div>
              <h2>{selectedConfig.title}</h2>
              <p>{selectedConfig.subtitle}</p>
            </div>
          </div>

          {selectedItems.length > 0 ? (
            <ol className="trend-list">
              {selectedItems.map((item, index) => (
                <li
                  key={
                    isRoutine(item)
                      ? `routine-${item.id_rutina}`
                      : isTrendUser(item)
                        ? `user-${item.id}`
                        : `training-${item.id_sesion}`
                  }
                  className="trend-row"
                >
                  <strong className="trend-rank">#{index + 1}</strong>
                  <div className="trend-row-main">
                    <h3 className="verified-name">
                      {getTitle(item)}
                      {isTrendUser(item) ? <VerifiedBadge tipoUsuario={item.tipo_usuario} /> : null}
                    </h3>
                    {isRoutine(item) ? (
                      <small className="verified-name">
                        Por {item.creador_username} - {item.total_ejercicios} ejercicios
                        <VerifiedBadge tipoUsuario={item.creador_tipo_usuario} />
                      </small>
                    ) : isTraining(item) ? (
                      <small className="verified-name">
                        Por {item.username} - {item.total_series} series - {item.total_ejercicios} ejercicios
                        <VerifiedBadge tipoUsuario={item.tipo_usuario} />
                      </small>
                    ) : (
                      <small>{getSubtitle(item)}</small>
                    )}
                    {isRoutine(item) && item.grupos_musculares.length > 0 ? (
                      <div className="trend-tags">
                        {item.grupos_musculares.slice(0, 3).map((group) => (
                          <span key={group}>{group}</span>
                        ))}
                      </div>
                    ) : null}
                    {isTraining(item) && item.descripcion ? (
                      <p>{item.descripcion}</p>
                    ) : null}
                  </div>
                  <div className="trend-row-side">
                    <span>{getMetricText(selectedConfig.key, item)}</span>
                    {isTrendUser(item) && onOpenProfile ? (
                      <button type="button" className="btn secondary" onClick={() => onOpenProfile(item.username)}>
                        Ver perfil
                      </button>
                    ) : null}
                    {isTraining(item) && onOpenTraining ? (
                      <button type="button" className="btn secondary" onClick={() => onOpenTraining(item)}>
                        Ver
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <article className="empty-state discover-empty">
              <p>{selectedConfig.empty}</p>
              <small>Cuando haya mas actividad, este top se llena solo.</small>
            </article>
          )}
        </section>
      ) : null}

      {!loading && !error && !selectedConfig ? (
        <section className="empty-state discover-empty">
          <p>Elegí una categoría de tendencias para ver el ranking.</p>
          <img
            className="trend-empty-image"
            src={trendsEmptyBodybuilder}
            alt="Fisicoculturista posando"
          />
        </section>
      ) : null}
    </>
  );
}

export default Tendencias;
