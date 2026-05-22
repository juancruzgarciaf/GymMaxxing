import type { PerfilUsuario, SuggestedAthlete, Usuario } from "../types";
import VerifiedBadge from "./VerifiedBadge";

type ProfileSummaryCardProps = {
  usuario: Usuario;
  profile: PerfilUsuario | null;
  onOpenProfile: (username: string) => void;
};

type SuggestedAthletesCardProps = {
  athletes: SuggestedAthlete[];
  loading: boolean;
  error: string;
  followLoadingId: number | null;
  onFollow: (athlete: SuggestedAthlete) => void | Promise<void>;
  onOpenProfile: (username: string) => void;
};

type FeedSidebarProps = {
  usuario: Usuario;
  profile: PerfilUsuario | null;
  suggestedAthletes: SuggestedAthlete[];
  suggestionsLoading: boolean;
  suggestionsError: string;
  followLoadingId: number | null;
  onFollowSuggested: (athlete: SuggestedAthlete) => void | Promise<void>;
  onOpenProfile: (username: string) => void;
};

const formatNumber = (value: number | null | undefined) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value ?? 0);

const getInitial = (username: string) => username.slice(0, 1).toUpperCase();

function ProfileSummaryCard({ usuario, profile, onOpenProfile }: ProfileSummaryCardProps) {
  const profileUser = profile?.usuario ?? usuario;
  const realName = profileUser.nombre?.trim();

  return (
    <article className="feed-sidebar-card profile-summary-card">
      <div className="profile-summary-head">
        <div className="profile-summary-avatar">{getInitial(profileUser.username)}</div>
        <div>
          <h2 className="verified-name">
            {profileUser.username}
            <VerifiedBadge tipoUsuario={profileUser.tipo_usuario} />
          </h2>
          {realName ? <p>{realName}</p> : null}
        </div>
      </div>

      <div className="profile-summary-stats" aria-label="Estadísticas del perfil">
        <div>
          <strong>{formatNumber(profile?.trainings_count)}</strong>
          <span>entrenos</span>
        </div>
        <div>
          <strong>{formatNumber(profile?.followers_count)}</strong>
          <span>seguidores</span>
        </div>
        <div>
          <strong>{formatNumber(profile?.following_count)}</strong>
          <span>siguiendo</span>
        </div>
      </div>

      <button type="button" className="btn feed-sidebar-full-btn" onClick={() => onOpenProfile(profileUser.username)}>
        Ver tu perfil
      </button>
    </article>
  );
}

function SuggestedAthletesCard({
  athletes,
  loading,
  error,
  followLoadingId,
  onFollow,
  onOpenProfile,
}: SuggestedAthletesCardProps) {
  return (
    <article className="feed-sidebar-card suggested-athletes-card">
      <div className="feed-sidebar-card-title">
        <h2>Atletas sugeridos</h2>
      </div>

      {loading ? <p className="feed-sidebar-muted">Buscando atletas...</p> : null}
      {!loading && error ? <p className="feed-sidebar-muted error">{error}</p> : null}
      {!loading && !error && athletes.length === 0 ? (
        <p className="feed-sidebar-muted">Todavía no hay sugerencias nuevas.</p>
      ) : null}

      <div className="suggested-athlete-list">
        {athletes.map((athlete) => (
          <div key={athlete.id} className="suggested-athlete-item">
            <button
              type="button"
              className="suggested-athlete-profile"
              onClick={() => onOpenProfile(athlete.username)}
            >
              <span className="suggested-athlete-avatar">{getInitial(athlete.username)}</span>
              <span>
                <strong className="verified-name">
                  {athlete.username}
                  <VerifiedBadge tipoUsuario={athlete.tipo_usuario} />
                </strong>
                <small>
                  {athlete.nombre?.trim() ||
                    `${formatNumber(athlete.followers_count)} seguidores`}
                </small>
              </span>
            </button>
            <button
              type="button"
              className="btn compact"
              onClick={() => void onFollow(athlete)}
              disabled={followLoadingId === athlete.id}
            >
              {followLoadingId === athlete.id ? "..." : "Seguir"}
            </button>
          </div>
        ))}
      </div>
    </article>
  );
}

function FeedSidebar({
  usuario,
  profile,
  suggestedAthletes,
  suggestionsLoading,
  suggestionsError,
  followLoadingId,
  onFollowSuggested,
  onOpenProfile,
}: FeedSidebarProps) {
  return (
    <aside className="feed-sidebar" aria-label="Resumen social de inicio">
      <ProfileSummaryCard usuario={usuario} profile={profile} onOpenProfile={onOpenProfile} />
      <SuggestedAthletesCard
        athletes={suggestedAthletes}
        loading={suggestionsLoading}
        error={suggestionsError}
        followLoadingId={followLoadingId}
        onFollow={onFollowSuggested}
        onOpenProfile={onOpenProfile}
      />
    </aside>
  );
}

export default FeedSidebar;
