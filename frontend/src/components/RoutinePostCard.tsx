import type { RoutinePostSummary } from "../types";
import ProPlanBadge from "./ProPlanBadge";
import VerifiedBadge from "./VerifiedBadge";

type RoutinePostCardProps = {
  item: RoutinePostSummary;
  onOpenProfile?: (username: string) => void;
  onOpenRoutine: (routine: RoutinePostSummary) => void;
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

const formatDuration = (minutes: number | null) => {
  if (minutes == null) {
    return "-";
  }

  return `${Math.max(0, minutes)} min`;
};

function RoutinePostCard({ item, onOpenProfile, onOpenRoutine }: RoutinePostCardProps) {
  const remainingExercises = Math.max(0, item.total_ejercicios - item.ejercicios_preview.length);

  return (
    <article className="feed-card routine-post-card">
      <button
        type="button"
        className={`profile-chip ${onOpenProfile ? "" : "static"}`}
        onClick={() => onOpenProfile?.(item.username)}
        disabled={!onOpenProfile}
      >
        <span className="avatar-circle">{item.username.slice(0, 1).toUpperCase()}</span>
        <span>
          <strong className="verified-name">
            {item.username}
            <VerifiedBadge tipoUsuario={item.tipo_usuario} />
            <ProPlanBadge plan={item.pro_plan} />
          </strong>
          <small>{formatDate(item.fecha_actividad)}</small>
        </span>
      </button>

      <div className="feed-card-header">
        <div>
          <span className="routine-post-label">Rutina</span>
          <h2>{item.titulo}</h2>
          <p className="feed-description">{item.descripcion || "Rutina creada por el gimnasio"}</p>
        </div>
      </div>

      <div className="metrics-row">
        <div className="metric-box">
          <span>Duracion</span>
          <strong>{formatDuration(item.duracion_estimada)}</strong>
        </div>
        <div className="metric-box">
          <span>Series</span>
          <strong>{item.total_series}</strong>
        </div>
        <div className="metric-box">
          <span>Ejercicios</span>
          <strong>{item.total_ejercicios}</strong>
        </div>
        <div className="metric-box">
          <span>Guardados</span>
          <strong>{item.save_count}</strong>
        </div>
        <div className="metric-box">
          <span>Copias</span>
          <strong>{item.copy_count}</strong>
        </div>
      </div>

      <div className="exercise-preview-list">
        {item.ejercicios_preview.length > 0 ? (
          <>
            {item.ejercicios_preview.map((ejercicio) => (
              <div key={`${item.id_rutina}-${ejercicio.nombre}`} className="exercise-preview-item">
                <span>{ejercicio.nombre}</span>
                <small>
                  {ejercicio.series} series
                  {ejercicio.grupo_muscular ? ` - ${ejercicio.grupo_muscular}` : ""}
                </small>
              </div>
            ))}
            {remainingExercises > 0 ? (
              <p className="exercise-preview-more">Y {remainingExercises} ejercicio(s) más</p>
            ) : null}
          </>
        ) : (
          <p className="muted">No hay ejercicios cargados para mostrar.</p>
        )}
      </div>

      <div className="feed-card-actions">
        <div />
        <div className="feed-card-secondary-actions">
          <button type="button" className="btn secondary" onClick={() => onOpenRoutine(item)}>
            Ver rutina
          </button>
        </div>
      </div>
    </article>
  );
}

export default RoutinePostCard;
