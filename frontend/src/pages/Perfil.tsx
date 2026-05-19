import { useEffect, useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import TrainingCalendar from "../components/TrainingCalendar";
import UserTrainingFeed from "../components/UserTrainingFeed";
import { COUNTRY_OPTIONS } from "../lib/countries";
import type { EntrenamientoResumen, PerfilUsuario, Usuario } from "../types";

type PerfilProps = {
  usuario: Usuario;
  profileUsername: string;
  onOpenProfile: (username: string) => void;
  onOpenTraining: (training: EntrenamientoResumen) => void;
  onSaveAsRoutine: (training: EntrenamientoResumen, customName?: string) => void | Promise<void>;
  authToken: string | null;
  onUserUpdated: (usuario: Usuario) => void;
};

const API = "http://localhost:3000";
const TRAINING_LEVEL_OPTIONS = ["Principiante", "Avanzado", "Veterano", "GYMMAXXER"];

function Perfil({
  usuario,
  profileUsername,
  onOpenProfile,
  onOpenTraining,
  onSaveAsRoutine,
  authToken,
  onUserUpdated,
}: PerfilProps) {
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    edad: "",
    peso: "",
    altura: "",
    nacionalidad: "",
    nivel_entrenamiento: "",
    objetivo_entrenamiento: "",
  });
  const currentNationalityIsKnown =
    !form.nacionalidad || COUNTRY_OPTIONS.includes(form.nacionalidad);
  const currentTrainingLevelIsKnown =
    !form.nivel_entrenamiento || TRAINING_LEVEL_OPTIONS.includes(form.nivel_entrenamiento);

  const cargarPerfil = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API}/users/profile/${encodeURIComponent(profileUsername)}?viewer_id=${usuario.id}`);
      const data = (await res.json()) as PerfilUsuario | { error?: string };

      if (!res.ok) {
        throw new Error("error" in data ? data.error || "No se pudo cargar el perfil" : "No se pudo cargar el perfil");
      }

      setPerfil(data as PerfilUsuario);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el perfil");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarPerfil();
  }, [profileUsername]);

  useEffect(() => {
    if (!perfil || !perfil.is_own_profile) {
      return;
    }

    setForm({
      username: perfil.usuario.username || "",
      email: perfil.usuario.email || "",
      edad: perfil.usuario.edad == null ? "" : String(perfil.usuario.edad),
      peso: perfil.usuario.peso == null ? "" : String(perfil.usuario.peso),
      altura: perfil.usuario.altura == null ? "" : String(perfil.usuario.altura),
      nacionalidad: perfil.usuario.nacionalidad || "",
      nivel_entrenamiento: perfil.usuario.nivel_entrenamiento || "",
      objetivo_entrenamiento: perfil.usuario.objetivo_entrenamiento || "",
    });
  }, [perfil]);

  const handleGuardarPerfil = async () => {
    if (!perfil || !perfil.is_own_profile) {
      return;
    }

    if (!authToken) {
      setError("No hay token activo. Volve a iniciar sesion.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const res = await fetch(`${API}/users/${perfil.usuario.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          edad: form.edad.trim() ? Number(form.edad) : null,
          peso: form.peso.trim() ? Number(form.peso) : null,
          altura: form.altura.trim() ? Number(form.altura) : null,
          nacionalidad: form.nacionalidad.trim() || null,
          nivel_entrenamiento: form.nivel_entrenamiento.trim() || null,
          objetivo_entrenamiento: form.objetivo_entrenamiento.trim() || null,
          tipo_usuario: perfil.usuario.tipo_usuario,
        }),
      });

      const data = (await res.json()) as Usuario | { error?: string };

      if (!res.ok) {
        throw new Error("error" in data ? data.error || "No se pudo actualizar" : "No se pudo actualizar");
      }

      const usuarioActualizado = data as Usuario;
      setPerfil((prev) =>
        prev
          ? {
              ...prev,
              usuario: {
                ...prev.usuario,
                ...usuarioActualizado,
              },
            }
          : prev,
      );
      onUserUpdated({
        ...usuario,
        ...usuarioActualizado,
      });
      setEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el perfil");
    } finally {
      setSaving(false);
    }
  };

  const toggleFollow = async () => {
    if (!perfil || perfil.is_own_profile) {
      return;
    }

    try {
      setError("");

      const res = await fetch(`${API}/users/${perfil.usuario.id}/follow`, {
        method: perfil.viewer_follows ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seguidor_id: usuario.id }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el seguimiento");
      }

      setPerfil((prev) =>
        prev
          ? {
              ...prev,
              viewer_follows: !prev.viewer_follows,
              followers_count: prev.followers_count + (prev.viewer_follows ? -1 : 1),
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el seguimiento");
    }
  };

  return (
    <main className="page-shell profile-page-shell">
      {loading ? <div className="status">Cargando perfil...</div> : null}
      {error ? <div className="status error">{error}</div> : null}

      {!loading && perfil ? (
        <>
          <ProfileHeader
            perfil={perfil}
            editMode={editMode}
            onToggleEdit={() => setEditMode((prev) => !prev)}
            onToggleFollow={toggleFollow}
          />

          {perfil.is_own_profile && editMode ? (
            <section className="feed-card">
              <h2>Editar usuario</h2>
              <div className="form-grid two-inline">
                <input
                  className="field"
                  placeholder="Username"
                  value={form.username}
                  onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                />
                <input
                  className="field"
                  placeholder="Email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                />
                <input
                  className="field"
                  type="number"
                  min="0"
                  placeholder="Edad"
                  value={form.edad}
                  onChange={(event) => setForm((prev) => ({ ...prev, edad: event.target.value }))}
                />
                <input
                  className="field"
                  type="number"
                  min="0"
                  placeholder="Peso"
                  value={form.peso}
                  onChange={(event) => setForm((prev) => ({ ...prev, peso: event.target.value }))}
                />
                <input
                  className="field"
                  type="number"
                  min="0"
                  placeholder="Altura"
                  value={form.altura}
                  onChange={(event) => setForm((prev) => ({ ...prev, altura: event.target.value }))}
                />
                <select
                  className="field"
                  value={form.nacionalidad}
                  onChange={(event) => setForm((prev) => ({ ...prev, nacionalidad: event.target.value }))}
                >
                  <option value="">Nacionalidad</option>
                  {!currentNationalityIsKnown ? (
                    <option value={form.nacionalidad}>{form.nacionalidad}</option>
                  ) : null}
                  {COUNTRY_OPTIONS.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
                <select
                  className="field"
                  value={form.nivel_entrenamiento}
                  onChange={(event) => setForm((prev) => ({ ...prev, nivel_entrenamiento: event.target.value }))}
                >
                  <option value="">Nivel de entrenamiento</option>
                  {!currentTrainingLevelIsKnown ? (
                    <option value={form.nivel_entrenamiento}>{form.nivel_entrenamiento}</option>
                  ) : null}
                  {TRAINING_LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
                <input
                  className="field"
                  placeholder="Objetivo de entrenamiento"
                  value={form.objetivo_entrenamiento}
                  onChange={(event) => setForm((prev) => ({ ...prev, objetivo_entrenamiento: event.target.value }))}
                />
              </div>
              <div className="actions-row">
                <button type="button" className="btn" disabled={saving} onClick={() => void handleGuardarPerfil()}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </section>
          ) : null}

          <section className="profile-content-layout">
            <section className="profile-feed-column" aria-label="Entrenamientos del usuario">
              <UserTrainingFeed
                trainings={perfil.entrenamientos}
                viewerId={usuario.id}
                onOpenProfile={onOpenProfile}
                onOpenTraining={onOpenTraining}
                onSaveAsRoutine={onSaveAsRoutine}
              />
            </section>

            <aside className="profile-calendar-column" aria-label="Calendario de entrenamientos">
              <TrainingCalendar trainings={perfil.entrenamientos} onOpenTraining={onOpenTraining} />
            </aside>
          </section>

          {!perfil.is_own_profile ? (
            <section className="profile-actions-row">
              <button type="button" className="btn secondary" onClick={() => onOpenProfile(usuario.username)}>
                Volver a mi perfil
              </button>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

export default Perfil;
