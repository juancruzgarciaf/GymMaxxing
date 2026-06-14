import { useEffect, useState } from "react";
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH, limitDescription, limitTitle } from "../lib/textLimits";
import type { EntrenamientoResumen, SessionComment } from "../types";
import ProPlanBadge from "./ProPlanBadge";
import VerifiedBadge from "./VerifiedBadge";
import { resolveMediaUrl } from "../lib/media";

type TrainingPostCardProps = {
  item: EntrenamientoResumen;
  viewerId: number;
  onOpenProfile?: (username: string) => void;
  onOpenTraining: (training: EntrenamientoResumen) => void;
  onSaveAsRoutine?: (training: EntrenamientoResumen, customName?: string) => void | Promise<void>;
  onTrainingUpdated?: (training: EntrenamientoResumen) => void;
  onTrainingDeleted?: (trainingId: number) => void;
};

const API = "http://localhost:3000";
const TRAINING_DELETED_EVENT = "gymmaxxing:training-deleted";
const AUTH_STORAGE_KEY = "gymmaxxing_auth_v1";

const getStoredAuthToken = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
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

function LikeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 10V21H5.5C4.7 21 4 20.3 4 19.5V11.5C4 10.7 4.7 10 5.5 10H9ZM11 21H17.5C18.2 21 18.8 20.5 19 19.8L20.9 13.1C21.1 12.3 20.5 11.5 19.7 11.5H15V6.8C15 5.8 14.2 5 13.2 5C12.8 5 12.4 5.2 12.2 5.5L8.9 10.2C8.6 10.6 8.5 11 8.5 11.4V19C8.5 20.1 9.4 21 10.5 21H11Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 5C7 5 3 8.6 3 13C3 15.2 4 17.2 5.7 18.6L5 21L8.2 19.3C9.4 19.8 10.7 20 12 20C17 20 21 16.4 21 12C21 7.6 17 5 12 5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4V16M12 4L7.5 8.5M12 4L16.5 8.5M6 19H18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 12H5.01M12 12H12.01M19 12H19.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 4.5H15M5.5 7H18.5M8 7V18C8 19.1 8.9 20 10 20H14C15.1 20 16 19.1 16 18V7M10.5 10V16M13.5 10V16M9.5 4.5L10.1 3.7C10.5 3.2 11 3 11.6 3H12.4C13 3 13.5 3.2 13.9 3.7L14.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
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

function TrainingPostCard({
  item,
  viewerId,
  onOpenProfile,
  onOpenTraining,
  onSaveAsRoutine,
  onTrainingUpdated,
  onTrainingDeleted,
}: TrainingPostCardProps) {
  const canManageTraining = item.usuario_id === viewerId;
  const [displayItem, setDisplayItem] = useState(item);
  const remainingExercises = Math.max(0, displayItem.total_ejercicios - displayItem.ejercicios_preview.length);
  const [liked, setLiked] = useState(item.viewer_liked);
  const [likesCount, setLikesCount] = useState(item.likes_count);
  const [commentsCount, setCommentsCount] = useState(item.comments_count);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [comments, setComments] = useState<SessionComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [interactionLoading, setInteractionLoading] = useState(false);
  const [interactionError, setInteractionError] = useState("");
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<number | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveRoutineName, setSaveRoutineName] = useState(limitTitle(item.titulo));
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [likePulse, setLikePulse] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(limitTitle(item.titulo));
  const [editDescription, setEditDescription] = useState(item.descripcion ?? "");
  const [editImage, setEditImage] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingTraining, setDeletingTraining] = useState(false);
  const [hiddenAfterDelete, setHiddenAfterDelete] = useState(false);

  useEffect(() => {
    setDisplayItem(item);
    setLiked(item.viewer_liked);
    setLikesCount(item.likes_count);
    setCommentsCount(item.comments_count);
    setCommentsOpen(false);
    setCommentsLoading(false);
    setCommentsLoaded(false);
    setComments([]);
    setCommentDraft("");
    setInteractionLoading(false);
    setInteractionError("");
    setDeletingCommentId(null);
    setPendingDeleteCommentId(null);
    setSaveModalOpen(false);
    setSaveRoutineName(limitTitle(item.titulo));
    setSavingRoutine(false);
    setLikePulse(false);
    setActionsOpen(false);
    setEditModalOpen(false);
    setEditTitle(limitTitle(item.titulo));
    setEditDescription(item.descripcion ?? "");
    setEditImage(null);
    setSavingEdit(false);
    setDeleteModalOpen(false);
    setDeletingTraining(false);
    setHiddenAfterDelete(false);
  }, [item]);

  const handleOpenSaveRoutineModal = () => {
    setSaveRoutineName(limitTitle(displayItem.titulo));
    setSaveModalOpen(true);
  };

  const handleConfirmSaveRoutine = async () => {
    if (!onSaveAsRoutine) {
      return;
    }

    const nextName = limitTitle(saveRoutineName.trim());
    if (!nextName) {
      setInteractionError("El nombre de la rutina no puede estar vacio");
      return;
    }

    try {
      setSavingRoutine(true);
      setInteractionError("");
      await onSaveAsRoutine(displayItem, nextName);
      setSaveModalOpen(false);
    } catch (error) {
      setInteractionError(error instanceof Error ? error.message : "No se pudo guardar la rutina");
    } finally {
      setSavingRoutine(false);
    }
  };

  const openEditModal = () => {
    setEditTitle(limitTitle(displayItem.titulo));
    setEditDescription(limitDescription(displayItem.descripcion ?? ""));
    setEditImage(null);
    setActionsOpen(false);
    setEditModalOpen(true);
  };

  const handleUpdateTraining = async () => {
    const nextTitle = limitTitle(editTitle.trim());
    if (!nextTitle) {
      setInteractionError("El titulo del entrenamiento no puede estar vacio");
      return;
    }

    try {
      setSavingEdit(true);
      setInteractionError("");
      const res = await fetch(`${API}/entrenamientos/${displayItem.id_sesion}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nextTitle,
          descripcion: limitDescription(editDescription.trim()) || null,
        }),
      });
      const data = (await res.json()) as {
        descripcion?: string | null;
        nombre_rutina_snapshot?: string | null;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "No se pudo modificar el entrenamiento");
      }

      let nextImageUrl = displayItem.imagen_url ?? null;
      if (editImage) {
        const token = getStoredAuthToken();
        if (!token) throw new Error("Volvé a iniciar sesión para subir la imagen");
        const formData = new FormData();
        formData.append("image", editImage);
        const imageResponse = await fetch(`${API}/entrenamientos/${displayItem.id_sesion}/image`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const imageData = (await imageResponse.json()) as { imagen_url?: string; error?: string };
        if (!imageResponse.ok) throw new Error(imageData.error || "No se pudo guardar la imagen");
        nextImageUrl = imageData.imagen_url ?? null;
      }

      const updated = {
        ...displayItem,
        titulo: data.nombre_rutina_snapshot ?? nextTitle,
        descripcion: data.descripcion ?? null,
        imagen_url: nextImageUrl,
      };
      setDisplayItem(updated);
      onTrainingUpdated?.(updated);
      setEditModalOpen(false);
    } catch (error) {
      setInteractionError(error instanceof Error ? error.message : "No se pudo modificar el entrenamiento");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteTraining = async () => {
    try {
      setDeletingTraining(true);
      setInteractionError("");
      const res = await fetch(`${API}/entrenamientos/${displayItem.id_sesion}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "No se pudo borrar el entrenamiento");
      }

      setDeleteModalOpen(false);
      setHiddenAfterDelete(true);
      window.dispatchEvent(
        new CustomEvent(TRAINING_DELETED_EVENT, {
          detail: { sessionId: displayItem.id_sesion },
        }),
      );
      onTrainingDeleted?.(displayItem.id_sesion);
    } catch (error) {
      setInteractionError(error instanceof Error ? error.message : "No se pudo borrar el entrenamiento");
    } finally {
      setDeletingTraining(false);
    }
  };

  const loadComments = async () => {
    try {
      setCommentsLoading(true);
      setInteractionError("");
      const res = await fetch(`${API}/entrenamientos/sesion/${item.id_sesion}/comentarios`);
      const data = (await res.json()) as SessionComment[] | { error?: string };

      if (!res.ok) {
        throw new Error("error" in data ? data.error || "No se pudieron cargar los comentarios" : "No se pudieron cargar los comentarios");
      }

      setComments(Array.isArray(data) ? data : []);
      setCommentsLoaded(true);
    } catch (error) {
      setInteractionError(
        error instanceof Error ? error.message : "No se pudieron cargar los comentarios",
      );
    } finally {
      setCommentsLoading(false);
    }
  };

  const toggleComments = () => {
    const nextOpen = !commentsOpen;
    setCommentsOpen(nextOpen);
    if (nextOpen && !commentsLoaded) {
      void loadComments();
    }
  };

  const handleToggleLike = async () => {
    try {
      setInteractionLoading(true);
      setInteractionError("");

      const res = await fetch(`${API}/entrenamientos/${item.id_sesion}/like`, {
        method: liked ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: viewerId }),
      });
      const data = (await res.json()) as
        | { likes_count: number; comments_count: number; viewer_liked: boolean; error?: string }
        | { error?: string };

      if (!res.ok) {
        throw new Error("error" in data ? data.error || "No se pudo actualizar el like" : "No se pudo actualizar el like");
      }

      if ("likes_count" in data) {
        setLiked(data.viewer_liked);
        setLikesCount(data.likes_count);
        setCommentsCount(data.comments_count);
        if (data.viewer_liked && !liked) {
          setLikePulse(true);
          window.setTimeout(() => setLikePulse(false), 520);
        }
      }
    } catch (error) {
      setInteractionError(error instanceof Error ? error.message : "No se pudo actualizar el like");
    } finally {
      setInteractionLoading(false);
    }
  };

  const handleCreateComment = async () => {
    if (!commentDraft.trim()) {
      return;
    }

    try {
      setInteractionLoading(true);
      setInteractionError("");
      const res = await fetch(`${API}/entrenamientos/${item.id_sesion}/comentarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: viewerId,
          contenido: commentDraft.trim(),
        }),
      });
      const data = (await res.json()) as
        | {
            comentario: SessionComment | null;
            summary: { likes_count: number; comments_count: number; viewer_liked: boolean };
            error?: string;
          }
        | { error?: string };

      if (!res.ok) {
        throw new Error("error" in data ? data.error || "No se pudo crear el comentario" : "No se pudo crear el comentario");
      }

      if ("comentario" in data) {
        const nuevoComentario = data.comentario;
        if (nuevoComentario) {
          setComments((prev) => [...prev, nuevoComentario]);
        } else {
          void loadComments();
        }
        setCommentDraft("");
        setCommentsCount(data.summary.comments_count);
        setLikesCount(data.summary.likes_count);
        setLiked(data.summary.viewer_liked);
        setCommentsLoaded(true);
        setCommentsOpen(true);
      }
    } catch (error) {
      setInteractionError(
        error instanceof Error ? error.message : "No se pudo crear el comentario",
      );
    } finally {
      setInteractionLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      setInteractionLoading(true);
      setDeletingCommentId(commentId);
      setInteractionError("");

      const res = await fetch(`${API}/entrenamientos/${item.id_sesion}/comentarios/${commentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: viewerId }),
      });
      const data = (await res.json()) as
        | {
            mensaje: string;
            summary: { likes_count: number; comments_count: number; viewer_liked: boolean };
            error?: string;
          }
        | { error?: string };

      if (!res.ok) {
        throw new Error(
          "error" in data ? data.error || "No se pudo borrar el comentario" : "No se pudo borrar el comentario",
        );
      }

      if ("summary" in data) {
        setComments((prev) => prev.filter((comment) => comment.id_comentario !== commentId));
        setCommentsCount(data.summary.comments_count);
        setLikesCount(data.summary.likes_count);
        setLiked(data.summary.viewer_liked);
      }
    } catch (error) {
      setInteractionError(
        error instanceof Error ? error.message : "No se pudo borrar el comentario",
      );
    } finally {
      setInteractionLoading(false);
      setDeletingCommentId(null);
      setPendingDeleteCommentId(null);
    }
  };

  if (hiddenAfterDelete) {
    return null;
  }

  return (
    <article className="feed-card">
      {canManageTraining ? (
        <div className="training-card-menu">
          <button
            type="button"
            className="training-menu-trigger"
            onClick={() => setActionsOpen((current) => !current)}
            aria-label="Opciones del entrenamiento"
            aria-expanded={actionsOpen}
            title="Opciones"
          >
            <DotsIcon />
          </button>
          {actionsOpen ? (
            <div className="training-menu-popover">
              <button type="button" onClick={openEditModal}>
                Modificar entrenamiento
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setActionsOpen(false);
                  setDeleteModalOpen(true);
                }}
              >
                Borrar entrenamiento
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        className={`profile-chip ${onOpenProfile ? "" : "static"}`}
        onClick={() => onOpenProfile?.(displayItem.username)}
        disabled={!onOpenProfile}
      >
        <span className="avatar-circle">
          {resolveMediaUrl(displayItem.foto_perfil_url) ? (
            <img src={resolveMediaUrl(displayItem.foto_perfil_url) ?? ""} alt="" />
          ) : displayItem.username.slice(0, 1).toUpperCase()}
        </span>
        <span>
          <strong className="verified-name">
            {displayItem.username}
            <VerifiedBadge tipoUsuario={displayItem.tipo_usuario} />
            <ProPlanBadge plan={displayItem.pro_plan} />
          </strong>
          <small>{formatDate(displayItem.fecha_actividad)}</small>
        </span>
      </button>

      <div className="feed-card-header">
        <div>
          <h2>{displayItem.titulo}</h2>
          <p className="feed-description">{displayItem.descripcion || "Entrenamiento finalizado"}</p>
        </div>
      </div>

      {resolveMediaUrl(displayItem.imagen_url) ? (
        <img
          className="training-cover-image"
          src={resolveMediaUrl(displayItem.imagen_url) ?? ""}
          alt={`Imagen de ${displayItem.titulo}`}
        />
      ) : null}

      <div className="metrics-row">
        <div className="metric-box">
          <span>Duracion</span>
          <strong>{formatDuration(displayItem.duracion_segundos)}</strong>
        </div>
        <div className="metric-box">
          <span>Volumen</span>
          <strong>{formatVolume(displayItem.volumen_total)}</strong>
        </div>
        <div className="metric-box">
          <span>Series</span>
          <strong>{displayItem.total_series}</strong>
        </div>
        <div className="metric-box">
          <span>Ejercicios</span>
          <strong>{displayItem.total_ejercicios}</strong>
        </div>
        {(displayItem.total_trofeos ?? 0) > 0 ? (
          <div className="metric-box trophy-metric">
            <span>Trofeos</span>
            <strong>
              <TrophyIcon />
              {displayItem.total_trofeos}
            </strong>
          </div>
        ) : null}
      </div>

      <div className="exercise-preview-list">
        {displayItem.ejercicios_preview.length > 0 ? (
          <>
            {displayItem.ejercicios_preview.map((ejercicio) => (
              <div key={`${displayItem.id_sesion}-${ejercicio.nombre}`} className="exercise-preview-item">
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
        <div className="feed-card-social-actions">
          <button
            type="button"
            className={`social-action ${liked ? "active" : ""} ${likePulse ? "like-burst" : ""}`}
            onClick={() => void handleToggleLike()}
            disabled={interactionLoading}
            aria-label={liked ? "Quitar like" : "Dar like"}
            aria-pressed={liked}
            title={liked ? "Quitar like" : "Dar like"}
          >
            <LikeIcon />
            <span className="social-action-count">{likesCount}</span>
          </button>
          <button
            type="button"
            className={`social-action ${commentsOpen ? "active" : ""}`}
            onClick={toggleComments}
            disabled={interactionLoading && commentsLoading}
            aria-label={commentsOpen ? "Ocultar comentarios" : "Ver comentarios"}
            aria-pressed={commentsOpen}
            title={commentsOpen ? "Ocultar comentarios" : "Ver comentarios"}
          >
            <CommentIcon />
            <span className="social-action-count">{commentsCount}</span>
          </button>
          {onSaveAsRoutine ? (
            <button
              type="button"
              className="social-action icon-only"
              onClick={handleOpenSaveRoutineModal}
              aria-label="Guardar como mi rutina"
              title="Guardar como mi rutina"
            >
              <SaveIcon />
            </button>
          ) : null}
        </div>
        <div className="feed-card-secondary-actions">
          <button type="button" className="btn secondary" onClick={() => onOpenTraining(displayItem)}>
            Ver entrenamiento completo
          </button>
        </div>
      </div>

      {interactionError ? <p className="helper-text social-feedback">{interactionError}</p> : null}

      {commentsOpen ? (
        <div className="comment-panel">
          <div className="comment-form">
            <input
              className="field"
              placeholder="Escribe un comentario"
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreateComment();
                }
              }}
            />
            <button
              type="button"
              className="btn"
              onClick={() => void handleCreateComment()}
              disabled={interactionLoading || !commentDraft.trim()}
            >
              Comentar
            </button>
          </div>

          {commentsLoading ? <p className="helper-text">Cargando comentarios...</p> : null}

          {!commentsLoading && comments.length === 0 ? (
            <p className="helper-text">Todavia no hay comentarios.</p>
          ) : null}

          {!commentsLoading ? (
            <div className="comment-list">
              {comments.map((comment) => (
                <article key={comment.id_comentario} className="comment-item">
                  <div className="comment-item-head">
                    <div className="comment-item-meta">
                      <strong>{comment.username}</strong>
                      <small>{formatDate(comment.fecha)}</small>
                    </div>
                    {comment.usuario_id === viewerId ? (
                      <button
                        type="button"
                        className="comment-delete-btn"
                        onClick={() => setPendingDeleteCommentId(comment.id_comentario)}
                        disabled={interactionLoading && deletingCommentId === comment.id_comentario}
                        aria-label="Borrar comentario"
                        title="Borrar comentario"
                      >
                        <TrashIcon />
                      </button>
                    ) : null}
                  </div>
                  <p>{comment.contenido}</p>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {saveModalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!savingRoutine) {
              setSaveModalOpen(false);
            }
          }}
        >
          <div
            className="modal-card save-name-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Guardar rutina"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h2>Guardar rutina</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSaveModalOpen(false)}
                disabled={savingRoutine}
              >
                ×
              </button>
            </div>
            <p className="helper-text">Elegi el nombre con el que queres guardarla.</p>
            <input
              className="field"
              placeholder="Nombre de rutina"
              maxLength={TITLE_MAX_LENGTH}
              value={saveRoutineName}
              onChange={(event) => setSaveRoutineName(limitTitle(event.target.value))}
            />
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setSaveModalOpen(false)}
                disabled={savingRoutine}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void handleConfirmSaveRoutine()}
                disabled={savingRoutine}
              >
                {savingRoutine ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editModalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!savingEdit) {
              setEditModalOpen(false);
            }
          }}
        >
          <div
            className="modal-card training-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Modificar entrenamiento"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h2>Modificar entrenamiento</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setEditModalOpen(false)}
                disabled={savingEdit}
              >
                ×
              </button>
            </div>
            <section className="panel two-cols training-edit-summary">
              <article className="box">
                <h2>Resumen</h2>
                <p className="helper-text">
                  Sesion #{displayItem.id_sesion} · Tiempo total {formatDuration(displayItem.duracion_segundos)}
                </p>
                <p className="helper-text">Series completas: {displayItem.total_series}</p>
                <p className="helper-text">Ejercicios usados: {displayItem.total_ejercicios}</p>
              </article>
              <article className="box">
                <h2>Que se modifica</h2>
                <p className="helper-text">
                  Cambia el titulo y la descripcion que aparecen en tu perfil e Inicio.
                </p>
              </article>
            </section>
            <div className="form-grid">
              <input
                className="field"
                placeholder="Nombre del entrenamiento"
                maxLength={TITLE_MAX_LENGTH}
                value={editTitle}
                onChange={(event) => setEditTitle(limitTitle(event.target.value))}
              />
              <input
                className="field"
                placeholder="Descripcion"
                maxLength={DESCRIPTION_MAX_LENGTH}
                value={editDescription}
                onChange={(event) => setEditDescription(limitDescription(event.target.value))}
              />
              <small className="field-counter">
                {editDescription.length}/{DESCRIPTION_MAX_LENGTH}
              </small>
              <label className="image-upload-field">
                <span>Foto del entrenamiento (opcional)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setEditImage(event.target.files?.[0] ?? null)}
                />
                {editImage ? <small>{editImage.name}</small> : null}
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setEditModalOpen(false)}
                disabled={savingEdit}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void handleUpdateTraining()}
                disabled={savingEdit || !editTitle.trim()}
              >
                {savingEdit ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteModalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!deletingTraining) {
              setDeleteModalOpen(false);
            }
          }}
        >
          <div
            className="modal-card save-name-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Borrar entrenamiento"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h2>Borrar entrenamiento</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deletingTraining}
              >
                ×
              </button>
            </div>
            <p className="helper-text">¿Quieres borrar "{displayItem.titulo}" de tu perfil?</p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deletingTraining}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => void handleDeleteTraining()}
                disabled={deletingTraining}
              >
                {deletingTraining ? "Borrando..." : "Borrar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDeleteCommentId != null ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!interactionLoading) {
              setPendingDeleteCommentId(null);
            }
          }}
        >
          <div
            className="modal-card save-name-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Eliminar comentario"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h2>Eliminar comentario</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setPendingDeleteCommentId(null)}
                disabled={interactionLoading}
              >
                ×
              </button>
            </div>
            <p className="helper-text">¿Quieres borrar este comentario?</p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setPendingDeleteCommentId(null)}
                disabled={interactionLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => void handleDeleteComment(pendingDeleteCommentId)}
                disabled={interactionLoading}
              >
                {interactionLoading ? "Borrando..." : "Borrar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default TrainingPostCard;
