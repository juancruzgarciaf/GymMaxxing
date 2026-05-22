import type { PerfilUsuario } from "../types";
import VerifiedBadge from "./VerifiedBadge";

type ProfileHeaderProps = {
  perfil: PerfilUsuario;
  editMode: boolean;
  onToggleEdit: () => void;
  onToggleFollow: () => void | Promise<void>;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);

const GENDER_LABELS: Record<string, string> = {
  hombre: "Hombre",
  mujer: "Mujer",
};

function ProfileHeader({
  perfil,
  editMode,
  onToggleEdit,
  onToggleFollow,
  onOpenFollowers,
  onOpenFollowing,
}: ProfileHeaderProps) {
  const isGym = perfil.usuario.tipo_usuario.trim().toLowerCase() === "gimnasio";
  const gymProfile = perfil.gimnasio_perfil;
  const realName = perfil.usuario.nombre?.trim();
  const bio = isGym
    ? gymProfile?.descripcion_corta?.trim()
    : perfil.usuario.objetivo_entrenamiento?.trim();
  const genderLabel = perfil.usuario.genero ? GENDER_LABELS[perfil.usuario.genero] ?? perfil.usuario.genero : "";
  const displayName = isGym
    ? gymProfile?.nombre_gimnasio?.trim() || perfil.usuario.username
    : perfil.usuario.username;
  const location = [gymProfile?.ciudad, gymProfile?.provincia].filter(Boolean).join(", ");
  const gymInstagram = gymProfile?.instagram?.trim().replace(/^@/, "");

  return (
    <section className="profile-modern-header">
      <div className="profile-modern-avatar">{displayName.slice(0, 1).toUpperCase()}</div>

      <div className="profile-modern-main">
        <div className="profile-modern-topline">
          <div>
            <h1 className="verified-name">
              {displayName}
              <VerifiedBadge tipoUsuario={perfil.usuario.tipo_usuario} className="large" />
            </h1>
            {isGym ? (
              <p className="profile-real-name verified-name">
                @{perfil.usuario.username}
                <VerifiedBadge tipoUsuario={perfil.usuario.tipo_usuario} />
              </p>
            ) : realName ? (
              <p className="profile-real-name">{realName}</p>
            ) : null}
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
            <strong>{formatNumber(isGym ? perfil.routines_count ?? 0 : perfil.trainings_count)}</strong>
            <span>{isGym ? "Rutinas" : "Entrenamientos"}</span>
          </div>
          <button type="button" className="profile-stat-button" onClick={onOpenFollowers}>
            <strong>{formatNumber(perfil.followers_count)}</strong>
            <span>Seguidores</span>
          </button>
          <button type="button" className="profile-stat-button" onClick={onOpenFollowing}>
            <strong>{formatNumber(perfil.following_count)}</strong>
            <span>Siguiendo</span>
          </button>
        </div>

        {bio ? <p className="profile-bio">{bio}</p> : null}

        <div className="profile-meta">
          {isGym && gymProfile?.tipo_gimnasio ? (
            <span className="tag-soft">{gymProfile.tipo_gimnasio}</span>
          ) : null}
          {isGym && location ? <span className="tag-soft">{location}</span> : null}
          {isGym && gymProfile?.telefono ? <span className="tag-soft">{gymProfile.telefono}</span> : null}
          {isGym && gymInstagram ? <span className="tag-soft">@{gymInstagram}</span> : null}
          {isGym && gymProfile?.sitio_web ? <span className="tag-soft">{gymProfile.sitio_web}</span> : null}
          {isGym && gymProfile?.google_maps_url ? (
            <a className="tag-soft profile-map-link" href={gymProfile.google_maps_url} target="_blank" rel="noreferrer">
              Abrir mapa
            </a>
          ) : null}
          {!isGym && genderLabel ? (
            <span className="tag-soft">Genero: {genderLabel}</span>
          ) : null}
          {!isGym && perfil.usuario.nivel_entrenamiento ? (
            <span className="tag-soft">Nivel: {perfil.usuario.nivel_entrenamiento}</span>
          ) : null}
          {!isGym && perfil.usuario.nacionalidad ? (
            <span className="tag-soft">Nacionalidad: {perfil.usuario.nacionalidad}</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default ProfileHeader;
