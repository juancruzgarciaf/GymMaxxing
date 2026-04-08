import { useEffect, useState } from "react";
import TrainingPostCard from "../components/TrainingPostCard";
import type { EntrenamientoResumen, PerfilUsuario, Usuario } from "../types";

type PerfilProps = {
  usuario: Usuario;
  profileUserId: number;
  onOpenProfile: (userId: number) => void;
  onOpenTraining: (training: EntrenamientoResumen) => void;
  onSaveAsRoutine: (training: EntrenamientoResumen) => void;
};

const API = "http://localhost:3000";

function Perfil({
  usuario,
  profileUserId,
  onOpenProfile,
  onOpenTraining,
  onSaveAsRoutine,
}: PerfilProps) {
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargarPerfil = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API}/users/${profileUserId}/profile?viewer_id=${usuario.id}`);
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
  }, [profileUserId]);

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
    <main className="page-shell">
      {loading ? <div className="status">Cargando perfil...</div> : null}
      {error ? <div className="status error">{error}</div> : null}

      {!loading && perfil ? (
        <>
          <section className="profile-banner">
            <div className="profile-avatar">{perfil.usuario.username.slice(0, 1).toUpperCase()}</div>

            <div className="profile-main">
              <h1>{perfil.usuario.username}</h1>
              <p className="subtitle">{perfil.usuario.email}</p>

              <div className="profile-stats">
                <div>
                  <strong>{perfil.trainings_count}</strong>
                  <span>Entrenamientos</span>
                </div>
                <div>
                  <strong>{perfil.followers_count}</strong>
                  <span>Seguidores</span>
                </div>
                <div>
                  <strong>{perfil.following_count}</strong>
                  <span>Siguiendo</span>
                </div>
              </div>

              <div className="profile-meta">
                {perfil.usuario.nivel_entrenamiento ? (
                  <span className="tag-soft">{perfil.usuario.nivel_entrenamiento}</span>
                ) : null}
                {perfil.usuario.objetivo_entrenamiento ? (
                  <span className="tag-soft">{perfil.usuario.objetivo_entrenamiento}</span>
                ) : null}
                {perfil.usuario.nacionalidad ? (
                  <span className="tag-soft">{perfil.usuario.nacionalidad}</span>
                ) : null}
              </div>
            </div>

            {!perfil.is_own_profile ? (
              <button type="button" className={`btn ${perfil.viewer_follows ? "danger" : ""}`} onClick={() => void toggleFollow()}>
                {perfil.viewer_follows ? "Dejar de seguir" : "Seguir"}
              </button>
            ) : null}
          </section>

          {perfil.entrenamientos.length === 0 ? (
            <section className="empty-state">
              <h2>No hay entrenamientos finalizados todavía</h2>
              <p>Cuando este usuario termine rutinas, van a aparecer acá.</p>
            </section>
          ) : (
            <section className="feed-list">
              {perfil.entrenamientos.map((item) => (
                <TrainingPostCard
                  key={item.id_sesion}
                  item={item}
                  viewerId={usuario.id}
                  onOpenProfile={onOpenProfile}
                  onOpenTraining={onOpenTraining}
                  onSaveAsRoutine={onSaveAsRoutine}
                />
              ))}
            </section>
          )}

          {!perfil.is_own_profile ? (
            <section className="profile-actions-row">
              <button type="button" className="btn secondary" onClick={() => onOpenProfile(usuario.id)}>
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
