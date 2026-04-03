import type { EntrenamientoResumen } from "../types";

type TrainingPostCardProps = {
  item: EntrenamientoResumen;
  onOpenProfile?: (userId: number) => void;
  onOpenTraining: (training: EntrenamientoResumen) => void;
};

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

function TrainingPostCard({ item, onOpenProfile, onOpenTraining }: TrainingPostCardProps) {
  const remainingExercises = Math.max(0, item.total_ejercicios - item.ejercicios_preview.length);

  return (
    <article className="feed-card">
      <button
        type="button"
        className={`profile-chip ${onOpenProfile ? "" : "static"}`}
        onClick={() => onOpenProfile?.(item.usuario_id)}
        disabled={!onOpenProfile}
      >
        <span className="avatar-circle">{item.username.slice(0, 1).toUpperCase()}</span>
        <span>
          <strong>{item.username}</strong>
          <small>{formatDate(item.fecha_actividad)}</small>
        </span>
      </button>

      <div className="feed-card-header">
        <div>
          <h2>{item.titulo}</h2>
          <p className="feed-description">{item.descripcion || "Entrenamiento finalizado"}</p>
        </div>
      </div>

      <div className="metrics-row">
        <div className="metric-box">
          <span>Duracion</span>
          <strong>{formatDuration(item.duracion_segundos)}</strong>
        </div>
        <div className="metric-box">
          <span>Volumen</span>
          <strong>{formatVolume(item.volumen_total)}</strong>
        </div>
        <div className="metric-box">
          <span>Series</span>
          <strong>{item.total_series}</strong>
        </div>
        <div className="metric-box">
          <span>Ejercicios</span>
          <strong>{item.total_ejercicios}</strong>
        </div>
      </div>

      <div className="exercise-preview-list">
        {item.ejercicios_preview.length > 0 ? (
          <>
            {item.ejercicios_preview.map((ejercicio) => (
              <div key={`${item.id_sesion}-${ejercicio.nombre}`} className="exercise-preview-item">
                <span>{ejercicio.nombre}</span>
                <small>{ejercicio.series} series</small>
              </div>
            ))}
            {remainingExercises > 0 ? (
              <p className="exercise-preview-more">Y {remainingExercises} ejercicio(s) más</p>
            ) : null}
          </>
        ) : (
          <p className="muted">No hay series registradas para mostrar.</p>
        )}
      </div>

      <div className="feed-card-actions">
        <button type="button" className="btn secondary" onClick={() => onOpenTraining(item)}>
          Ver entrenamiento completo
        </button>
      </div>
    </article>
  );
}

export default TrainingPostCard;
