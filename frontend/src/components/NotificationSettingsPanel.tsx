import { useEffect, useState, type ChangeEvent } from "react";
import type { NotificationPreferences } from "../types";

const API = "http://localhost:3000";

type NotificationSettingsPanelProps = {
  authToken: string | null;
  onAuthExpired: () => void;
};

type EditablePreferences = Pick<
  NotificationPreferences,
  | "recibir_en_app"
  | "recibir_por_email"
  | "notificar_like_entrenamiento"
  | "notificar_comentario_entrenamiento"
  | "notificar_nuevo_seguidor"
>;

const toEditablePreferences = (
  preferences: NotificationPreferences
): EditablePreferences => ({
  recibir_en_app: preferences.recibir_en_app,
  recibir_por_email: preferences.recibir_por_email,
  notificar_like_entrenamiento: preferences.notificar_like_entrenamiento,
  notificar_comentario_entrenamiento: preferences.notificar_comentario_entrenamiento,
  notificar_nuevo_seguidor: preferences.notificar_nuevo_seguidor,
});

function NotificationSettingsPanel({
  authToken,
  onAuthExpired,
}: NotificationSettingsPanelProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [draft, setDraft] = useState<EditablePreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!success) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSuccess("");
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!authToken) {
      setPreferences(null);
      setDraft(null);
      setError("No hay sesion activa.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadPreferences = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API}/notificaciones/preferences`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        const data = (await res.json()) as NotificationPreferences | { error?: string };

        if (res.status === 401) {
          onAuthExpired();
          return;
        }

        if (!res.ok) {
          throw new Error(
            "error" in data
              ? data.error || "No se pudieron cargar las preferencias"
              : "No se pudieron cargar las preferencias"
          );
        }

        if (cancelled) {
          return;
        }

        const nextPreferences = data as NotificationPreferences;
        setPreferences(nextPreferences);
        setDraft(toEditablePreferences(nextPreferences));
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar las preferencias"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPreferences();

    return () => {
      cancelled = true;
    };
  }, [authToken, onAuthExpired]);

  const handleToggle =
    (field: keyof EditablePreferences) => (event: ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked;
      setDraft((prev) => (prev ? { ...prev, [field]: checked } : prev));
      setSuccess("");
    };

  const handleSave = async () => {
    if (!authToken || !draft) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const res = await fetch(`${API}/notificaciones/preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(draft),
      });

      const data = (await res.json()) as NotificationPreferences | { error?: string };

      if (res.status === 401) {
        onAuthExpired();
        return;
      }

      if (!res.ok) {
        throw new Error(
          "error" in data
            ? data.error || "No se pudieron guardar las preferencias"
            : "No se pudieron guardar las preferencias"
        );
      }

      const updatedPreferences = data as NotificationPreferences;
      setPreferences(updatedPreferences);
      setDraft(toEditablePreferences(updatedPreferences));
      setSuccess("Preferencias guardadas");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron guardar las preferencias"
      );
    } finally {
      setSaving(false);
    }
  };

  const emailAvailable = Boolean(preferences?.email_disponible);
  const appNotificationsEnabled = draft?.recibir_en_app ?? false;

  return (
    <section className="settings-card notification-settings-card">
      <div className="settings-card-head">
        <span>Notificaciones</span>
        <p>Activa o desactiva tus avisos internos y deja listo el canal por correo.</p>
      </div>

      {loading ? <p className="helper-text">Cargando preferencias...</p> : null}
      {error ? <p className="status error">{error}</p> : null}
      {success ? <p className="status ok">{success}</p> : null}

      {!loading && preferences && draft ? (
        <>
          <div className="settings-info-grid">
            <article className="settings-info-item">
              <small>Email asociado</small>
              <strong>{preferences.email || "No disponible"}</strong>
            </article>
            <article className="settings-info-item">
              <small>Email disponible</small>
              <strong>{preferences.email_disponible ? "Si" : "No"}</strong>
            </article>
            <article className="settings-info-item">
              <small>Cuenta Google</small>
              <strong>{preferences.google_vinculado ? "Vinculada" : "No vinculada"}</strong>
            </article>
          </div>

          <div className="settings-toggle-list">
            <label className="settings-toggle-row">
              <div>
                <strong>Recibir notificaciones dentro de la app</strong>
                <p>Silencia o habilita todos los avisos internos del sistema.</p>
              </div>
              <input
                type="checkbox"
                checked={draft.recibir_en_app}
                onChange={handleToggle("recibir_en_app")}
              />
            </label>

            <label className={`settings-toggle-row ${!emailAvailable ? "disabled" : ""}`}>
              <div>
                <strong>Recibir notificaciones por correo</strong>
                <p>
                  {emailAvailable
                    ? "Queda preparado para la etapa de envios por email."
                    : "Necesitas un email asociado para habilitar esta opcion."}
                </p>
              </div>
              <input
                type="checkbox"
                checked={draft.recibir_por_email}
                disabled={!emailAvailable}
                onChange={handleToggle("recibir_por_email")}
              />
            </label>

            <label className={`settings-toggle-row ${!appNotificationsEnabled ? "disabled" : ""}`}>
              <div>
                <strong>Notificar likes en entrenamientos</strong>
                <p>Cuando alguien le da like a uno de tus entrenamientos.</p>
              </div>
              <input
                type="checkbox"
                checked={draft.notificar_like_entrenamiento}
                disabled={!appNotificationsEnabled}
                onChange={handleToggle("notificar_like_entrenamiento")}
              />
            </label>

            <label className={`settings-toggle-row ${!appNotificationsEnabled ? "disabled" : ""}`}>
              <div>
                <strong>Notificar comentarios en entrenamientos</strong>
                <p>Cuando alguien comenta uno de tus entrenamientos.</p>
              </div>
              <input
                type="checkbox"
                checked={draft.notificar_comentario_entrenamiento}
                disabled={!appNotificationsEnabled}
                onChange={handleToggle("notificar_comentario_entrenamiento")}
              />
            </label>

            <label className={`settings-toggle-row ${!appNotificationsEnabled ? "disabled" : ""}`}>
              <div>
                <strong>Notificar nuevos seguidores</strong>
                <p>Cuando otro usuario empieza a seguirte.</p>
              </div>
              <input
                type="checkbox"
                checked={draft.notificar_nuevo_seguidor}
                disabled={!appNotificationsEnabled}
                onChange={handleToggle("notificar_nuevo_seguidor")}
              />
            </label>
          </div>

          <div className="settings-actions">
            <button
              type="button"
              className="settings-action-btn theme-action-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar preferencias"}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default NotificationSettingsPanel;
