import { useRef } from "react";
import type { PerfilUsuario } from "../types";
import { resolveMediaUrl } from "../lib/media";
import ProPlanBadge from "./ProPlanBadge";
import VerifiedBadge from "./VerifiedBadge";

type ProfileHeaderProps = {
  perfil: PerfilUsuario;
  editMode: boolean;
  onToggleEdit: () => void;
  onToggleFollow: () => void | Promise<void>;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
  onSelectPhoto?: (file: File) => void;
  photoUploading?: boolean;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);

const LINK_PREVIEW_LENGTH = 20;

const ensureProtocol = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

const shortenLink = (url: string) => {
  const clean = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
  return clean.length > LINK_PREVIEW_LENGTH ? `${clean.slice(0, LINK_PREVIEW_LENGTH)}...` : clean;
};

const normalizeInstagramUser = (value?: string | null) => {
  if (!value) return "";
  let user = value.trim();
  const fromUrl = user.match(/instagram\.com\/([^/?#\s]+)/i);
  if (fromUrl) user = fromUrl[1];
  return user.replace(/^@/, "").replace(/\/+$/, "").trim();
};

const LinkIcon = () => (
  <svg className="profile-meta-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const PhoneIcon = () => (
  <svg className="profile-meta-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

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
  onSelectPhoto,
  photoUploading = false,
}: ProfileHeaderProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
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
  const gymInstagram = normalizeInstagramUser(gymProfile?.instagram);
  const gymWebsite = gymProfile?.sitio_web?.trim();
  const profilePhoto = resolveMediaUrl(perfil.usuario.foto_perfil_url);

  return (
    <section className="profile-modern-header">
      <div className="profile-photo-shell">
        <button
          type="button"
          className={`profile-modern-avatar profile-photo-button ${perfil.is_own_profile ? "editable" : ""}`}
          onClick={() => perfil.is_own_profile && photoInputRef.current?.click()}
          disabled={!perfil.is_own_profile || photoUploading}
          aria-label={perfil.is_own_profile ? "Cambiar foto de perfil" : undefined}
        >
          {profilePhoto ? <img src={profilePhoto} alt={`Foto de ${displayName}`} /> : displayName.slice(0, 1).toUpperCase()}
        </button>
        {perfil.is_own_profile ? (
          <span className="profile-photo-hint">{photoUploading ? "Subiendo..." : "Cambiar foto"}</span>
        ) : null}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onSelectPhoto?.(file);
            event.currentTarget.value = "";
          }}
        />
      </div>

      <div className="profile-modern-main">
        <div className="profile-modern-topline">
          <div>
            <h1 className="verified-name">
              {displayName}
              <VerifiedBadge tipoUsuario={perfil.usuario.tipo_usuario} className="large" />
              <ProPlanBadge plan={perfil.usuario.pro_plan} className="large" />
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
          {isGym && gymProfile?.telefono ? (
            <span className="tag-soft profile-meta-item">
              <PhoneIcon />
              {gymProfile.telefono}
            </span>
          ) : null}
          {isGym && gymInstagram ? (
            <a
              className="tag-soft profile-meta-item profile-meta-link"
              href={`https://www.instagram.com/${encodeURIComponent(gymInstagram)}/`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Instagram de @${gymInstagram}`}
            >
              @{gymInstagram}
            </a>
          ) : null}
          {isGym && gymWebsite ? (
            <a
              className="tag-soft profile-meta-item profile-meta-link"
              href={ensureProtocol(gymWebsite)}
              target="_blank"
              rel="noopener noreferrer"
              title={gymWebsite}
            >
              <LinkIcon />
              {shortenLink(gymWebsite)}
            </a>
          ) : null}
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
