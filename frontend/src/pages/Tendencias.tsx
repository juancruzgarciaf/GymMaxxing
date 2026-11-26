import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
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
  // Segmento de la URL: /descubrir/tendencias/<slug>
  slug: string;
  title: string;
  subtitle: string;
  empty: string;
};

type TendenciasProps = {
  usuario: Usuario;
  onOpenProfile?: (username: string) => void;
  onOpenTraining?: (training: EntrenamientoResumen) => void;
  onOpenRoutine?: (routineId: number) => void;
};

const API = "http://localhost:3000";
const TRENDS_BASE_PATH = "/descubrir/tendencias";
const SCROLL_STORAGE_PREFIX = "gymmaxxing_trends_scroll:";

const TREND_CONFIGS: TrendConfig[] = [
  {
    key: "rutinas_mas_copiadas",
    slug: "rutinas-mas-usadas",
    title: "Top 10 Rutinas mas usadas",
    subtitle: "Las rutinas que mas gente copio para entrenar.",
    empty: "Todavia no hay rutinas copiadas.",
  },
  {
    key: "rutinas_mas_guardadas",
    slug: "rutinas-mas-guardadas",
    title: "Top 10 Rutinas mas guardadas",
    subtitle: "Las rutinas que mas usuarios guardaron.",
    empty: "Todavia no hay rutinas guardadas.",
  },
  {
    key: "usuarios_mas_seguidos",
    slug: "usuarios-mas-seguidos",
    title: "Top 10 Usuarios mas seguidos",
    subtitle: "Los perfiles que mas comunidad estan juntando.",
    empty: "Todavia no hay seguidores suficientes.",
  },
  {
    key: "entrenamientos_mas_likeados",
    slug: "entrenamientos-mas-bancados",
    title: "Top 10 Entrenamientos mas bancados",
    subtitle: "Sesiones finalizadas con mas likes.",
    empty: "Todavia no hay entrenamientos con likes.",
  },
  {
    key: "entrenamientos_mas_comentados",
    slug: "entrenamientos-mas-hablados",
    title: "Top 10 Entrenamientos mas hablados",
    subtitle: "Sesiones que mas conversacion generaron.",
    empty: "Todavia no hay entrenamientos comentados.",
  },
  {
    key: "entrenamientos_mayor_volumen",
    slug: "mayor-volumen",
    title: "Top 10 Mayor volumen levantado",
    subtitle: "Sesiones ordenadas por kg x reps totales.",
    empty: "Todavia no hay volumen registrado.",
  },
];

// Ultimos rankings cargados. Al volver desde un perfil, rutina o entrenamiento se muestran al
// instante (y se refrescan en segundo plano), asi el scroll puede volver a donde estaba.
let trendsCache: { viewerId: number; data: TrendsResponse } | null = null;

const getTrendConfigFromPath = (pathname: string) => {
  const slug = pathname.split("/")[3];
  return slug ? TREND_CONFIGS.find((config) => config.slug === slug) ?? null : null;
};

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

const getItemKey = (item: TrendItem) =>
  isRoutine(item)
    ? `routine-${item.id_rutina}`
    : isTrendUser(item)
      ? `user-${item.id}`
      : `training-${item.id_sesion}`;

const getOpenLabel = (item: TrendItem) => {
  if (isRoutine(item)) {
    return `Ver rutina ${item.nombre}`;
  }

  if (isTrendUser(item)) {
    return `Ver perfil de ${item.username}`;
  }

  return `Ver entrenamiento ${item.titulo}`;
};

function Tendencias({ usuario, onOpenProfile, onOpenTraining, onOpenRoutine }: TendenciasProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const cachedTrends = trendsCache?.viewerId === usuario.id ? trendsCache.data : null;
  const [trends, setTrends] = useState<TrendsResponse | null>(cachedTrends);
  const [loading, setLoading] = useState(cachedTrends == null);
  const [error, setError] = useState("");
  const scrollRestoredRef = useRef(false);

  // La categoria elegida vive en la URL (/descubrir/tendencias/<categoria>), asi "Volver" y el
  // boton atras del navegador regresan exactamente al ranking que se estaba mirando.
  const selectedConfig = getTrendConfigFromPath(location.pathname);
  const selectedTrend = selectedConfig?.key ?? null;
  const scrollStorageKey = `${SCROLL_STORAGE_PREFIX}${location.key}`;

  useEffect(() => {
    let cancelled = false;

    const loadTrends = async () => {
      try {
        const res = await fetch(`${API}/users/trends?viewer_id=${usuario.id}`);
        const data = (await res.json()) as TrendsResponse | { error?: string };

        if (!res.ok) {
          throw new Error("error" in data ? data.error || "No se pudieron cargar tendencias" : "No se pudieron cargar tendencias");
        }

        trendsCache = { viewerId: usuario.id, data: data as TrendsResponse };
        if (!cancelled) {
          setTrends(data as TrendsResponse);
          setError("");
        }
      } catch (err) {
        // Si ya habia datos en pantalla, un fallo del refresco en segundo plano no los tapa.
        if (!cancelled && trendsCache?.viewerId !== usuario.id) {
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

  // Guardamos el scroll de esta entrada del historial mientras el usuario se mueve por la lista.
  useEffect(() => {
    let frame = 0;

    const saveScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(scrollStorageKey, String(Math.round(window.scrollY)));
        } catch {
          // sessionStorage no disponible: simplemente no se restaura el scroll.
        }
      });
    };

    window.addEventListener("scroll", saveScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", saveScroll);
    };
  }, [scrollStorageKey]);

  // Al volver con atras (navegacion POP), restauramos el scroll una vez que la lista esta dibujada.
  useEffect(() => {
    if (scrollRestoredRef.current || navigationType !== "POP" || !trends) {
      return;
    }

    scrollRestoredRef.current = true;

    let savedScroll = 0;
    try {
      savedScroll = Number(sessionStorage.getItem(scrollStorageKey) ?? "0");
    } catch {
      savedScroll = 0;
    }

    if (Number.isFinite(savedScroll) && savedScroll > 0) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: savedScroll });
      });
    }
  }, [navigationType, scrollStorageKey, trends]);

  const selectTrend = (config: TrendConfig) => {
    if (config.key === selectedTrend) {
      return;
    }

    // replace: cambiar de categoria no agrega entradas al historial ni recarga nada.
    navigate(`${TRENDS_BASE_PATH}/${config.slug}`, { replace: true });
  };

  const openItem = (item: TrendItem) => {
    if (isRoutine(item)) {
      onOpenRoutine?.(item.id_rutina);
      return;
    }

    if (isTrendUser(item)) {
      onOpenProfile?.(item.username);
      return;
    }

    onOpenTraining?.(item);
  };

  const canOpenItem = (item: TrendItem) =>
    isRoutine(item) ? Boolean(onOpenRoutine) : isTrendUser(item) ? Boolean(onOpenProfile) : Boolean(onOpenTraining);

  const selectedItems = selectedTrend == null ? [] : trends?.[selectedTrend] ?? [];

  return (
    <>
      <section className="trend-switcher" aria-label="Rankings de tendencias">
        {TREND_CONFIGS.map((config) => (
          <button
            key={config.key}
            type="button"
            className={`trend-tab ${selectedTrend === config.key ? "active" : ""}`}
            onClick={() => selectTrend(config)}
            aria-pressed={selectedTrend === config.key}
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
              {selectedItems.map((item, index) => {
                const clickable = canOpenItem(item);

                return (
                  <li key={getItemKey(item)} className={`trend-row ${clickable ? "is-clickable" : ""}`}>
                    {clickable ? (
                      // Boton invisible que cubre toda la capsula: cualquier click en la fila la abre.
                      <button
                        type="button"
                        className="trend-row-hit"
                        onClick={() => openItem(item)}
                        aria-label={getOpenLabel(item)}
                      />
                    ) : null}
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
                    </div>
                  </li>
                );
              })}
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
