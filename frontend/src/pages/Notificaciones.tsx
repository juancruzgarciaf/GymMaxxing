import { useEffect, useState } from "react";
import type { NotificationItem } from "../types";

const API = "http://localhost:3000";

type NotificationsResponse = {
  items: NotificationItem[];
  unread_count: number;
};

type NotificacionesProps = {
  authToken: string | null;
  onAuthExpired: () => void;
  onUnreadCountChange?: (count: number) => void;
};

const formatNotificationDate = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
};

function Notificaciones({
  authToken,
  onAuthExpired,
  onUnreadCountChange,
}: NotificacionesProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<number | "all" | null>(null);

  useEffect(() => {
    if (!authToken) {
      setItems([]);
      setUnreadCount(0);
      setLoading(false);
      setError("No hay sesion activa.");
      onUnreadCountChange?.(0);
      return;
    }

    let cancelled = false;

    const loadNotifications = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API}/notificaciones?limit=100`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        const data = (await res.json()) as NotificationsResponse | { error?: string };

        if (res.status === 401) {
          onAuthExpired();
          return;
        }

        if (!res.ok) {
          throw new Error(
            "error" in data
              ? data.error || "No se pudieron cargar las notificaciones"
              : "No se pudieron cargar las notificaciones"
          );
        }

        if (cancelled) {
          return;
        }

        const response = data as NotificationsResponse;
        setItems(response.items);
        setUnreadCount(response.unread_count);
        onUnreadCountChange?.(response.unread_count);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar las notificaciones"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadNotifications();

    return () => {
      cancelled = true;
    };
  }, [authToken, onAuthExpired, onUnreadCountChange]);

  const handleMarkAsRead = async (notificationId: number) => {
    if (!authToken) {
      return;
    }

    const current = items.find((item) => item.id_notificacion === notificationId);
    if (!current || current.leida) {
      return;
    }

    try {
      setActionLoading(notificationId);
      setError("");

      const res = await fetch(`${API}/notificaciones/${notificationId}/read`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = (await res.json()) as NotificationItem | { error?: string };

      if (res.status === 401) {
        onAuthExpired();
        return;
      }

      if (!res.ok) {
        throw new Error(
          "error" in data
            ? data.error || "No se pudo marcar la notificacion"
            : "No se pudo marcar la notificacion"
        );
      }

      const nextUnreadCount = Math.max(0, unreadCount - 1);
      setItems((prev) =>
        prev.map((item) =>
          item.id_notificacion === notificationId
            ? {
                ...item,
                leida: true,
                fecha_lectura:
                  "fecha_lectura" in data && typeof data.fecha_lectura === "string"
                    ? data.fecha_lectura
                    : item.fecha_lectura,
              }
            : item
        )
      );
      setUnreadCount(nextUnreadCount);
      onUnreadCountChange?.(nextUnreadCount);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo marcar la notificacion"
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!authToken || unreadCount === 0) {
      return;
    }

    try {
      setActionLoading("all");
      setError("");

      const res = await fetch(`${API}/notificaciones/read-all`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = (await res.json()) as { updated_count?: number; error?: string };

      if (res.status === 401) {
        onAuthExpired();
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "No se pudieron marcar todas como leidas");
      }

      setItems((prev) =>
        prev.map((item) =>
          item.leida
            ? item
            : {
                ...item,
                leida: true,
                fecha_lectura: item.fecha_lectura ?? new Date().toISOString(),
              }
        )
      );
      setUnreadCount(0);
      onUnreadCountChange?.(0);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron marcar todas como leidas"
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <main className="page-shell notification-page-shell">
      <section className="page-hero compact notification-hero">
        <div>
          <h1>Notificaciones</h1>
          <p className="subtitle">
            {unreadCount > 0
              ? `Tienes ${unreadCount} sin leer`
              : "No tienes notificaciones sin leer"}
          </p>
        </div>
        <button
          type="button"
          className="btn secondary"
          onClick={() => void handleMarkAllAsRead()}
          disabled={actionLoading === "all" || unreadCount === 0}
        >
          {actionLoading === "all" ? "Marcando..." : "Marcar todas como leidas"}
        </button>
      </section>

      {loading ? <p className="helper-text">Cargando notificaciones...</p> : null}
      {error ? <div className="status error">{error}</div> : null}

      {!loading ? (
        <section className="notification-list-card">
          {items.length === 0 ? (
            <div className="empty-state notification-empty-state">
              <p>Todavia no hay notificaciones.</p>
              <small>Cuando alguien interactue con tus entrenamientos o te siga, apareceran aqui.</small>
            </div>
          ) : (
            <div className="notification-list">
              {items.map((item) => (
                <article
                  key={item.id_notificacion}
                  className={`notification-item-card ${item.leida ? "is-read" : "is-unread"}`}
                >
                  <div className="notification-item-main">
                    <div className="notification-item-head">
                      <strong>{item.titulo}</strong>
                      <span className={`notification-pill ${item.leida ? "read" : "unread"}`}>
                        {item.leida ? "Leida" : "Nueva"}
                      </span>
                    </div>
                    <p>{item.mensaje}</p>
                    <small>{formatNotificationDate(item.fecha_creacion)}</small>
                  </div>

                  <div className="notification-item-actions">
                    {!item.leida ? (
                      <button
                        type="button"
                        className="btn secondary compact"
                        onClick={() => void handleMarkAsRead(item.id_notificacion)}
                        disabled={actionLoading === item.id_notificacion}
                      >
                        {actionLoading === item.id_notificacion ? "..." : "Marcar leida"}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}

export default Notificaciones;
