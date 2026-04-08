import { useEffect, useMemo, useState } from "react";
import type { EntrenamientoResumen, SerieSesionDetalle } from "../types";

type EntrenamientoDetalleProps = {
  entrenamiento: EntrenamientoResumen;
  onBack: () => void;
  onOpenProfile: (userId: number) => void;
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

function EntrenamientoDetalle({
  entrenamiento,
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
        orden_ejercicio: number;
        series: SerieSesionDetalle[];
      }
    >();

    series.forEach((serie) => {
      const existing = groups.get(serie.ejercicio_id);
      if (existing) {
        existing.series.push(serie);
        return;
      }

      groups.set(serie.ejercicio_id, {
        id_ejercicio: serie.ejercicio_id,
        nombre: serie.nombre,
        descripcion: serie.descripcion,
        grupo_muscular: serie.grupo_muscular,
        tipo_disciplina: serie.tipo_disciplina,
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
          <button
            type="button"
            className="social-action icon-only"
            onClick={() => onCopyToTraining(entrenamiento)}
            aria-label="Copiar entrenamiento"
            title="Copiar entrenamiento"
          >
            <CopyIcon />
          </button>
        </div>
        <button
          type="button"
          className="profile-chip detail-author"
          onClick={() => onOpenProfile(entrenamiento.usuario_id)}
        >
          <span className="avatar-circle">{entrenamiento.username.slice(0, 1).toUpperCase()}</span>
          <span>
            <strong>{entrenamiento.username}</strong>
            <small>{formatDate(entrenamiento.fecha_actividad)}</small>
          </span>
        </button>
      </section>

      <section className="profile-banner training-banner">
        <div className="profile-main">
          <p className="eyebrow">Entrenamiento completo</p>
          <h1>{entrenamiento.titulo}</h1>
          <p className="subtitle">{entrenamiento.descripcion || "Rutina finalizada y guardada."}</p>

          <div className="metrics-row">
            <div className="metric-box">
              <span>Duracion</span>
              <strong>{formatDuration(entrenamiento.duracion_segundos)}</strong>
            </div>
            <div className="metric-box">
              <span>Volumen</span>
              <strong>{formatVolume(entrenamiento.volumen_total)}</strong>
            </div>
            <div className="metric-box">
              <span>Series</span>
              <strong>{entrenamiento.total_series}</strong>
            </div>
            <div className="metric-box">
              <span>Ejercicios</span>
              <strong>{entrenamiento.total_ejercicios}</strong>
            </div>
          </div>
        </div>
      </section>

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
          ? groupedExercises.map((ejercicio) => (
              <article key={`${entrenamiento.id_sesion}-${ejercicio.id_ejercicio}`} className="exercise-card readonly detail-exercise-card">
                <div className="exercise-card-head">
                  <div>
                    <h3>{ejercicio.nombre}</h3>
                    <small>
                      {ejercicio.grupo_muscular || "Sin grupo"} · {ejercicio.tipo_disciplina || "Sin disciplina"}
                    </small>
                  </div>
                  <span className="tag-soft">{ejercicio.series.length} series</span>
                </div>

                {ejercicio.descripcion ? <p className="feed-description">{ejercicio.descripcion}</p> : null}

                <div className="set-table readonly-table">
                  <div className="set-table-head readonly-grid">
                    <span>Serie</span>
                    <span>Peso</span>
                    <span>Reps</span>
                    <span>Descanso</span>
                  </div>

                  {ejercicio.series.map((serie) => (
                    <div
                      key={`${entrenamiento.id_sesion}-${ejercicio.id_ejercicio}-${serie.orden}`}
                      className="set-row readonly-grid"
                    >
                      <div className="readonly-cell">{serie.orden}</div>
                      <div className="readonly-cell">{formatWeight(serie.peso)}</div>
                      <div className="readonly-cell">{serie.repeticiones}</div>
                      <div className="readonly-cell">{formatRest(serie.descanso)}</div>
                    </div>
                  ))}
                </div>
              </article>
            ))
          : null}
      </section>
    </main>
  );
}

export default EntrenamientoDetalle;
