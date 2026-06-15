import { useEffect, useMemo, useState } from "react";
import type { EntrenamientoResumen, SerieSesionDetalle } from "../types";
import VerifiedBadge from "../components/VerifiedBadge";
import { resolveMediaUrl } from "../lib/media";
import UserAvatar from "../components/UserAvatar";
import ExerciseMedia from "../components/ExerciseMedia";

type EntrenamientoDetalleProps = {
  entrenamiento: EntrenamientoResumen;
  canTrain: boolean;
  onBack: () => void;
  onOpenProfile: (username: string) => void;
  onCopyToTraining: (training: EntrenamientoResumen) => void;
};

const API = "http://localhost:3000";

const formatDate = (value: string | null) => {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const formatDuration = (seconds: number | null) => {
  if (seconds == null) {
    return "-";
  }

  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
};

const formatVolume = (value: number | null) => {
  if (value == null) {
    return "-";
  }

  return `${Math.round(value).toLocaleString()} kg`;
};

const formatWeight = (value: number | null) => {
  if (value == null) {
    return "-";
  }

  return `${value} kg`;
};

const formatRest = (value: number | null) => {
  if (value == null) {
    return "-";
  }

  return `${value}s`;
};

const formatDistance = (value: number | null | undefined) => {
  if (value == null) {
    return "-";
  }

  return `${value} km`;
};

type ExerciseInputMode = "strength" | "repsOnly" | "timed" | "cardio";

const normalizeText = (value: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const getExerciseInputMode = (ejercicio: {
  nombre: string;
  grupo_muscular: string | null;
}): ExerciseInputMode => {
  const nombre = normalizeText(ejercicio.nombre);
  const grupo = normalizeText(ejercicio.grupo_muscular);

  if (grupo === "cardio") {
    return "cardio";
  }

  if (grupo === "core" && nombre === "plancha") {
    return "timed";
  }

  if (
    grupo === "core" &&
    (nombre === "crunch abdominal" || nombre === "elevaciones de piernas")
  ) {
    return "repsOnly";
  }

  return "strength";
};

const TROPHY_LABELS: Record<NonNullable<SerieSesionDetalle["trofeos"]>[number], string> = {
  peso: "Peso",
  volumen: "Volumen",
  "1rm": "1RM",
};

const TROPHY_ORDER: NonNullable<SerieSesionDetalle["trofeos"]> = ["peso", "volumen", "1rm"];

const getOrderedTrophies = (trofeos: SerieSesionDetalle["trofeos"]) =>
  TROPHY_ORDER.filter((trofeo) => trofeos?.includes(trofeo));

const getSerieDisplay = (serie: SerieSesionDetalle, serieNumber: number) => {
  switch (serie.tipo_serie) {
    case "failure":
      return { label: "F", className: "failure" };
    case "dropset":
      return { label: "D", className: "dropset" };
    case "warmup":
      return { label: "W", className: "warmup" };
    default:
      return { label: String(serieNumber), className: "normal" };
  }
};


function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="9"
        y="9"
        width="10"
        height="10"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M7 15H6C4.9 15 4 14.1 4 13V6C4 4.9 4.9 4 6 4H13C14.1 4 15 4.9 15 6V7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4H16V8.5C16 11 14.2 13 12 13C9.8 13 8 11 8 8.5V4Z" fill="currentColor" />
      <path
        d="M8 6H5.5C5.5 8.8 6.8 10.5 9 10.8M16 6H18.5C18.5 8.8 17.2 10.5 15 10.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11 13H13V17H16.5V20H7.5V17H11V13Z" fill="currentColor" />
    </svg>
  );
}

function EntrenamientoDetalle({
  entrenamiento,
  canTrain,
  onBack,
  onOpenProfile,
  onCopyToTraining,
}: EntrenamientoDetalleProps) {
  const [series, setSeries] = useState<SerieSesionDetalle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadDetails = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API}/entrenamientos/sesion/${entrenamiento.id_sesion}/series`);
        const data = (await res.json()) as SerieSesionDetalle[] | { error?: string };

        if (!res.ok) {
          throw new Error("error" in data ? data.error || "No se pudo cargar el entrenamiento" : "No se pudo cargar el entrenamiento");
        }

        if (!cancelled) {
          setSeries(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el entrenamiento");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDetails();

    return () => {
      cancelled = true;
    };
  }, [entrenamiento.id_sesion]);

  const groupedExercises = useMemo(() => {
    const groups = new Map<
      number,
      {
        id_ejercicio: number;
        nombre: string;
        descripcion: string | null;
        grupo_muscular: string | null;
        tipo_disciplina: string | null;
        imagen_url: string | null;
        nota: string | null;
        orden_ejercicio: number;
        series: SerieSesionDetalle[];
      }
    >();

    series.forEach((serie) => {
      const existing = groups.get(serie.ejercicio_id);
      if (existing) {
        existing.series.push(serie);
        if (!existing.nota && serie.nota_ejercicio) {
          existing.nota = serie.nota_ejercicio;
        }
        return;
      }

      groups.set(serie.ejercicio_id, {
        id_ejercicio: serie.ejercicio_id,
        nombre: serie.nombre,
        descripcion: serie.descripcion,
        grupo_muscular: serie.grupo_muscular,
        tipo_disciplina: serie.tipo_disciplina,
        imagen_url: serie.imagen_url ?? null,
        nota: serie.nota_ejercicio ?? null,
        orden_ejercicio: serie.orden_ejercicio ?? 9999,
        series: [serie],
      });
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.orden_ejercicio !== b.orden_ejercicio) {
        return a.orden_ejercicio - b.orden_ejercicio;
      }
      return a.nombre.localeCompare(b.nombre);
    });
  }, [series]);

  return (
    <main className="page-shell">
      <section className="detail-topbar">
        <div className="detail-topbar-actions">
          <button type="button" className="btn secondary" onClick={onBack}>
            Volver
          </button>
          {canTrain ? (
            <button
              type="button"
              className="social-action icon-only"
              onClick={() => onCopyToTraining(entrenamiento)}
              aria-label="Copiar entrenamiento"
              title="Copiar entrenamiento"
            >
              <CopyIcon />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="profile-chip detail-author"
          onClick={() => onOpenProfile(entrenamiento.username)}
        >
          <UserAvatar username={entrenamiento.username} photoUrl={entrenamiento.foto_perfil_url} />
          <span>
            <strong className="verified-name">
              {entrenamiento.username}
              <VerifiedBadge tipoUsuario={entrenamiento.tipo_usuario} />
            </strong>
            <small>{formatDate(entrenamiento.fecha_actividad)}</small>
          </span>
        </button>
      </section>

      <section className="profile-banner training-banner">
        <div className="profile-main">
          <p className="eyebrow">Entrenamiento completo</p>
          <h1>{entrenamiento.titulo}</h1>
          <p className="subtitle">{entrenamiento.descripcion || "Rutina finalizada y guardada."}</p>

          <div className="metrics-row detail-metrics-row">
            <div className="metric-box detail-metric">
              <span>Duracion</span>
              <strong>{formatDuration(entrenamiento.duracion_segundos)}</strong>
            </div>
            <div className="metric-box detail-metric">
              <span>Volumen</span>
              <strong>{formatVolume(entrenamiento.volumen_total)}</strong>
            </div>
            <div className="metric-box detail-metric">
              <span>Series</span>
              <strong>{entrenamiento.total_series}</strong>
            </div>
            <div className="metric-box detail-metric">
              <span>Ejercicios</span>
              <strong>{entrenamiento.total_ejercicios}</strong>
            </div>
            {(entrenamiento.total_trofeos ?? 0) > 0 ? (
              <div className="metric-box detail-metric trophy-metric">
                <span>Trofeos</span>
                <strong>
                  <TrophyIcon />
                  {entrenamiento.total_trofeos}
                </strong>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {resolveMediaUrl(entrenamiento.imagen_url) ? (
        <img
          className="training-detail-cover"
          src={resolveMediaUrl(entrenamiento.imagen_url) ?? ""}
          alt={`Imagen de ${entrenamiento.titulo}`}
        />
      ) : null}

      {loading ? <div className="status">Cargando detalle del entrenamiento...</div> : null}
      {error ? <div className="status error">{error}</div> : null}

      {!loading && !error && groupedExercises.length === 0 ? (
        <section className="empty-state">
          <h2>No hay series registradas</h2>
          <p>Este entrenamiento no tiene series guardadas todavía.</p>
        </section>
      ) : null}

      <section className="detail-exercises">
        {!loading && !error
          ? groupedExercises.map((ejercicio) => {
              const inputMode = getExerciseInputMode(ejercicio);

              return (
              <article key={`${entrenamiento.id_sesion}-${ejercicio.id_ejercicio}`} className="exercise-card readonly detail-exercise-card">
                <div className="exercise-card-head">
                  <ExerciseMedia
                    exerciseId={ejercicio.id_ejercicio}
                    name={ejercicio.nombre}
                    imageUrl={ejercicio.imagen_url}
                  />
                  <div>
                    <h3>{ejercicio.nombre}</h3>
                    <small>
                      {ejercicio.grupo_muscular || "Sin grupo"} · {ejercicio.tipo_disciplina || "Sin disciplina"}
                    </small>
                  </div>
                  <span className="detail-series-count">{ejercicio.series.length} series</span>
                </div>

                <div className="exercise-note-readonly">
                  <span>Nota</span>
                  <p>{ejercicio.nota || "Sin nota"}</p>
                </div>

                <div className="set-table readonly-table detail-readonly-table">
                  <div className={`set-table-head readonly-grid detail-series-grid ${inputMode}`}>
                    <span>Serie</span>
                    {inputMode === "strength" ? <span>Peso</span> : null}
                    {inputMode === "strength" || inputMode === "repsOnly" ? <span>Reps</span> : null}
                    {inputMode === "cardio" ? <span>KM</span> : null}
                    {inputMode === "cardio" || inputMode === "timed" ? <span>Tiempo</span> : null}
                    <span>Descanso</span>
                    <span>Trofeos</span>
                  </div>

                  {ejercicio.series.map((serie, index) => {
                    const serieDisplay = getSerieDisplay(serie, index + 1);

                    return (
                      <div
                        key={`${entrenamiento.id_sesion}-${ejercicio.id_ejercicio}-${serie.orden}`}
                        className={`set-row readonly-grid detail-series-grid ${inputMode}`}
                      >
                        <div className={`readonly-cell serie-code ${serieDisplay.className}`}>
                          {serieDisplay.label}
                        </div>
                        {inputMode === "strength" ? (
                          <div className="readonly-cell">{formatWeight(serie.peso)}</div>
                        ) : null}
                        {inputMode === "strength" || inputMode === "repsOnly" ? (
                          <div className="readonly-cell">{serie.repeticiones}</div>
                        ) : null}
                        {inputMode === "cardio" ? (
                          <div className="readonly-cell">{formatDistance(serie.distancia_km)}</div>
                        ) : null}
                        {inputMode === "cardio" || inputMode === "timed" ? (
                          <div className="readonly-cell">{formatDuration(serie.tiempo_segundos ?? 0)}</div>
                        ) : null}
                        <div className="readonly-cell">{formatRest(serie.descanso)}</div>
                        <div className="readonly-cell series-trophy-cell">
                          {getOrderedTrophies(serie.trofeos).map((trofeo) => (
                            <span key={trofeo} className="series-trophy-badge">
                              <TrophyIcon />
                              {TROPHY_LABELS[trofeo]}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
              );
            })
          : null}
      </section>
    </main>
  );
}

export default EntrenamientoDetalle;
