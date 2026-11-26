import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { isVideoMediaUrl, resolveMediaUrl } from "../lib/media";
import type { NotificationItem, Usuario } from "../types";
import UserAvatar from "./UserAvatar";
import "./NotificationsDrawer.css";

const API = "http://localhost:3000";

type NotificationsResponse = {
  items: NotificationItem[];
  unread_count: number;
};

type FilterId = "all" | "followers" | "likes" | "comments";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "followers", label: "Seguidores" },
  { id: "likes", label: "Me gusta" },
  { id: "comments", label: "Comentarios" },
];

const FILTER_TYPES: Record<Exclude<FilterId, "all">, NotificationItem["tipo"]> = {
  followers: "new_follower",
  likes: "training_like",
  comments: "training_comment",
};

const ACTION_TEXT: Record<NotificationItem["tipo"], string> = {
  new_follower: "comenzó a seguirte.",
  training_like: "le dio me gusta a tu entrenamiento.",
  training_comment: "comentó tu entrenamiento.",
};

type GroupId = "today" | "week" | "month" | "older";

const GROUP_LABELS: Record<GroupId, string> = {
  today: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  older: "Anteriores",
};

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDate = (value: string) => {
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatRelative = (value: string, now: number) => {
  const date = parseDate(value);
  if (!date) {
    return "";
  }

  const diffSeconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (diffSeconds < 60) {
    return "ahora";
  }
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} h`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} d`;
  }

  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" })
    .format(date)
    .replace(".", "");
};

const getGroupId = (value: string, now: number): GroupId => {
  const date = parseDate(value);
  if (!date) {
    return "older";
  }

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const time = date.getTime();

  if (time >= startOfToday.getTime()) {
    return "today";
  }
  if (time >= startOfToday.getTime() - 6 * DAY_MS) {
    return "week";
  }
  if (time >= startOfToday.getTime() - 29 * DAY_MS) {
    return "month";
  }
  return "older";
};

type NotificationsDrawerProps = {
  open: boolean;
  usuario: Usuario;
  authToken: string | null;
  onClose: () => void;
  onAuthExpired: () => void;
  onUnreadCountChange: (count: number) => void;
  onOpenProfile: (username: string) => void;
  onOpenSettings: () => void;
};

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2 0 3.4 1.1 5 2.9 1.6-1.8 3-2.9 5-2.9 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 11.6a8.4 8.4 0 0 1-12.2 7.5L3.5 20.5l1.4-4.6a8.4 8.4 0 1 1 15.6-4.3Z" />
    </svg>
  );
}

function BellOutlineIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M9 17a3 3 0 0 0 6 0" />
    </svg>
  );
}

function NotificationsDrawer({
  open,
  usuario,
  authToken,
  onClose,
  onAuthExpired,
  onUnreadCountChange,
  onOpenProfile,
  onOpenSettings,
}: NotificationsDrawerProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [markingAll, setMarkingAll] = useState(false);
  const [followBusyIds, setFollowBusyIds] = useState<number[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const panelRef = useRef<HTMLElement | null>(null);

  const updateUnread = useCallback(
    (count: number) => {
      setUnreadCount(count);
      onUnreadCountChange(count);
    },
    [onUnreadCountChange]
  );

  const loadNotifications = useCallback(async () => {
    if (!authToken) {
      setError("No hay sesión activa.");
      return;
    }

    setRefreshing(true);
    setError("");

    try {
      const res = await fetch(`${API}/notificaciones?limit=100`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = (await res.json()) as NotificationsResponse | { error?: string };

      if (res.status === 401) {
        onAuthExpired();
        return;
      }

      if (!res.ok || !("items" in data)) {
        throw new Error(
          "error" in data && data.error ? data.error : "No se pudieron cargar las notificaciones"
        );
      }

      setItems(data.items);
      updateUnread(data.unread_count);
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las notificaciones");
    } finally {
      setRefreshing(false);
      setHasLoaded(true);
    }
  }, [authToken, onAuthExpired, updateUnread]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadNotifications();
    panelRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [loadNotifications, onClose, open]);

  const markAsRead = async (notification: NotificationItem) => {
    if (!authToken || notification.leida) {
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id_notificacion === notification.id_notificacion
          ? { ...item, leida: true, fecha_lectura: item.fecha_lectura ?? new Date().toISOString() }
          : item
      )
    );
    updateUnread(Math.max(0, unreadCount - 1));

    try {
      const res = await fetch(`${API}/notificaciones/${notification.id_notificacion}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.status === 401) {
        onAuthExpired();
      }
    } catch (err) {
      console.error("No se pudo marcar la notificación como leída", err);
    }
  };

  const markAllAsRead = async () => {
    if (!authToken || unreadCount === 0 || markingAll) {
      return;
    }

    try {
      setMarkingAll(true);
      const res = await fetch(`${API}/notificaciones/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.status === 401) {
        onAuthExpired();
        return;
      }

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "No se pudieron marcar todas como leídas");
      }

      const readAt = new Date().toISOString();
      setItems((prev) =>
        prev.map((item) => (item.leida ? item : { ...item, leida: true, fecha_lectura: item.fecha_lectura ?? readAt }))
      );
      updateUnread(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron marcar todas como leídas");
    } finally {
      setMarkingAll(false);
    }
  };

  const toggleFollow = async (event: MouseEvent<HTMLButtonElement>, notification: NotificationItem) => {
    event.stopPropagation();
    const actorId = notification.actor_id;
    if (actorId == null || followBusyIds.includes(actorId)) {
      return;
    }

    const currentlyFollowing = Boolean(notification.actor_seguido_por_usuario);
    const applyFollowState = (value: boolean) =>
      setItems((prev) =>
        prev.map((item) => (item.actor_id === actorId ? { ...item, actor_seguido_por_usuario: value } : item))
      );

    setFollowBusyIds((prev) => [...prev, actorId]);
    applyFollowState(!currentlyFollowing);

    try {
      const res = await fetch(`${API}/users/${actorId}/follow`, {
        method: currentlyFollowing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seguidor_id: usuario.id }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "No se pudo actualizar el seguimiento");
      }
    } catch (err) {
      applyFollowState(currentlyFollowing);
      setError(err instanceof Error ? err.message : "No se pudo actualizar el seguimiento");
    } finally {
      setFollowBusyIds((prev) => prev.filter((id) => id !== actorId));
    }
  };

  const openNotification = (notification: NotificationItem) => {
    void markAsRead(notification);
    if (notification.actor_username) {
      onOpenProfile(notification.actor_username);
      onClose();
    }
  };

  const groups = useMemo(() => {
    const visible =
      filter === "all" ? items : items.filter((item) => item.tipo === FILTER_TYPES[filter]);
    const byGroup = new Map<GroupId, NotificationItem[]>();

    visible.forEach((item) => {
      const groupId = getGroupId(item.fecha_creacion, now);
      byGroup.set(groupId, [...(byGroup.get(groupId) ?? []), item]);
    });

    return (Object.keys(GROUP_LABELS) as GroupId[])
      .filter((groupId) => byGroup.has(groupId))
      .map((groupId) => ({ id: groupId, label: GROUP_LABELS[groupId], items: byGroup.get(groupId) ?? [] }));
  }, [filter, items, now]);

  const renderTrailing = (notification: NotificationItem) => {
    if (notification.tipo === "new_follower" && notification.actor_id != null) {
      const following = Boolean(notification.actor_seguido_por_usuario);
      return (
        <button
          type="button"
          className={`notif-follow-btn ${following ? "following" : ""}`}
          onClick={(event) => void toggleFollow(event, notification)}
          disabled={followBusyIds.includes(notification.actor_id)}
        >
          {following ? "Siguiendo" : "Seguir"}
        </button>
      );
    }

    const imageUrl = notification.referencia_imagen_url;
    if (imageUrl && !isVideoMediaUrl(imageUrl)) {
      const resolved = resolveMediaUrl(imageUrl);
      if (resolved) {
        return <img className="notif-thumb" src={resolved} alt="" loading="lazy" />;
      }
    }

    return (
      <span className={`notif-thumb notif-thumb-icon ${notification.tipo === "training_like" ? "like" : "comment"}`}>
        {notification.tipo === "training_like" ? <HeartIcon /> : <CommentIcon />}
      </span>
    );
  };

  const showSkeleton = !hasLoaded && refreshing;
  const hasVisibleItems = groups.length > 0;

  return (
    <>
      <div className={`notif-drawer-scrim ${open ? "is-open" : ""}`} onClick={onClose} aria-hidden="true" />
      <section
        ref={panelRef}
        className={`notif-drawer ${open ? "is-open" : ""}`}
        role="dialog"
        aria-label="Notificaciones"
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
      >
        <header className="notif-drawer-head">
          <h2>Notificaciones</h2>
          <button type="button" className="notif-close-btn" onClick={onClose} aria-label="Cerrar notificaciones">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="notif-filters" role="tablist" aria-label="Filtrar notificaciones">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={filter === option.id}
              className={`notif-filter-chip ${filter === option.id ? "is-active" : ""}`}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="notif-summary">
          <span>
            {unreadCount > 0
              ? `${unreadCount} sin leer`
              : hasLoaded
                ? "Estás al día"
                : " "}
          </span>
          {unreadCount > 0 ? (
            <button type="button" className="notif-link-btn" onClick={() => void markAllAsRead()} disabled={markingAll}>
              {markingAll ? "Marcando..." : "Marcar todas como leídas"}
            </button>
          ) : null}
          {refreshing && hasLoaded ? <span className="notif-refresh-dot" aria-label="Actualizando" /> : null}
        </div>

        <div className="notif-scroll">
          {error ? <p className="notif-error">{error}</p> : null}

          {showSkeleton ? (
            <div className="notif-skeleton-list" aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => (
                <div className="notif-skeleton-row" key={index}>
                  <span className="notif-skel-avatar" />
                  <span className="notif-skel-lines">
                    <span />
                    <span />
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {hasLoaded && !hasVisibleItems && !error ? (
            <div className="notif-empty">
              <span className="notif-empty-icon">
                <BellOutlineIcon />
              </span>
              <strong>{filter === "all" ? "Todavía no hay notificaciones" : "Nada por acá"}</strong>
              <p>
                {filter === "all"
                  ? "Cuando alguien te siga, le dé me gusta o comente tus entrenamientos, lo vas a ver acá."
                  : "No tenés notificaciones de este tipo por ahora."}
              </p>
            </div>
          ) : null}

          {groups.map((group) => (
            <section className="notif-group" key={group.id}>
              <h3>{group.label}</h3>
              {group.items.map((notification) => {
                const actor = notification.actor_username;
                return (
                  <div
                    key={notification.id_notificacion}
                    className={`notif-row ${notification.leida ? "is-read" : "is-unread"}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openNotification(notification)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) {
                        return;
                      }
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openNotification(notification);
                      }
                    }}
                  >
                    <UserAvatar
                      username={actor ?? "GymMaxxing"}
                      photoUrl={notification.actor_foto_perfil_url}
                      className="notif-avatar"
                    />
                    <p className="notif-text">
                      {actor ? (
                        <>
                          <strong>{actor}</strong> {ACTION_TEXT[notification.tipo] ?? notification.mensaje}
                        </>
                      ) : (
                        notification.mensaje
                      )}{" "}
                      <time dateTime={notification.fecha_creacion}>
                        {formatRelative(notification.fecha_creacion, now)}
                      </time>
                    </p>
                    {renderTrailing(notification)}
                  </div>
                );
              })}
            </section>
          ))}
        </div>

        <footer className="notif-drawer-foot">
          <button
            type="button"
            className="notif-link-btn subtle"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
          >
            Configurar notificaciones
          </button>
        </footer>
      </section>
    </>
  );
}

export default NotificationsDrawer;
