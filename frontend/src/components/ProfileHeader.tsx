import type { PerfilUsuario } from "../types";

type ProfileHeaderProps = {
  perfil: PerfilUsuario;
  editMode: boolean;
  onToggleEdit: () => void;
  onToggleFollow: () => void | Promise<void>;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);

function ProfileHeader({ perfil, editMode, onToggleEdit, onToggleFollow }: ProfileHeaderProps) {
  const realName = perfil.usuario.nombre?.trim();
  const bio = perfil.usuario.objetivo_entrenamiento?.trim();

  return (
    <section className="profile-modern-header">
      <div className="profile-modern-avatar">{perfil.usuario.username.slice(0, 1).toUpperCase()}</div>

      <div className="profile-modern-main">
        <div className="profile-modern-topline">
          <div>
            <h1>{perfil.usuario.username}</h1>
            {realName ? <p className="profile-real-name">{realName}</p> : null}
          </div>

          {!perfil.is_own_profile ? (
            <button
              type="button"
              className={`btn ${perfil.viewer_follows ? "danger" : ""}`}
              onClick={() => void onToggleFollow()}
            >
              {perfil.viewer_follows ? "Dejar de seguir" : "Seguir"}
            </button>
          ) : (
            <button type="button" className="btn secondary" onClick={onToggleEdit}>
              {editMode ? "Cancelar edicion" : "Editar perfil"}
            </button>
          )}
        </div>

        <div className="profile-modern-stats">
          <div>
            <strong>{formatNumber(perfil.trainings_count)}</strong>
            <span>Entrenamientos</span>
          </div>
          <div>
            <strong>{formatNumber(perfil.followers_count)}</strong>
            <span>Seguidores</span>
          </div>
          <div>
            <strong>{formatNumber(perfil.following_count)}</strong>
            <span>Siguiendo</span>
          </div>
        </div>

        {bio ? <p className="profile-bio">{bio}</p> : null}

        <div className="profile-meta">
          {perfil.usuario.nivel_entrenamiento ? (
            <span className="tag-soft">Nivel: {perfil.usuario.nivel_entrenamiento}</span>
          ) : null}
          {perfil.usuario.nacionalidad ? (
            <span className="tag-soft">Nacionalidad: {perfil.usuario.nacionalidad}</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default ProfileHeader;
