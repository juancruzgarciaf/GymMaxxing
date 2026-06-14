import { useEffect, useMemo, useState } from "react";
import type { SocialUser } from "../types";
import VerifiedBadge from "./VerifiedBadge";
import UserAvatar from "./UserAvatar";

type SocialModalMode = "followers" | "following";

type ProfileSocialModalProps = {
  mode: SocialModalMode;
  users: SocialUser[];
  loading: boolean;
  error: string;
  actionLoadingId: number | null;
  profileIsOwn: boolean;
  viewerId: number;
  onClose: () => void;
  onOpenProfile: (username: string) => void;
  onFollow: (user: SocialUser) => void | Promise<void>;
  onUnfollow: (user: SocialUser) => void | Promise<void>;
};

function ProfileSocialModal({
  mode,
  users,
  loading,
  error,
  actionLoadingId,
  profileIsOwn,
  viewerId,
  onClose,
  onOpenProfile,
  onFollow,
  onUnfollow,
}: ProfileSocialModalProps) {
  const [query, setQuery] = useState("");
  const title = mode === "followers" ? "Seguidores" : "Siguiendo";
  const normalizedQuery = query.trim().toLowerCase();

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        if (!normalizedQuery) {
          return true;
        }

        return (
          user.username.toLowerCase().includes(normalizedQuery) ||
          (user.nombre?.toLowerCase().includes(normalizedQuery) ?? false)
        );
      }),
    [normalizedQuery, users],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const renderAction = (user: SocialUser) => {
    if (user.id === viewerId) {
      return null;
    }

    if (mode === "following" && profileIsOwn) {
      return (
        <button
          type="button"
          className="btn danger compact"
          disabled={actionLoadingId === user.id}
          onClick={(event) => {
            event.stopPropagation();
            void onUnfollow(user);
          }}
        >
          {actionLoadingId === user.id ? "..." : "Eliminar"}
        </button>
      );
    }

    return (
      <button
        type="button"
        className={`btn compact ${user.viewer_follows ? "secondary" : ""}`}
        disabled={actionLoadingId === user.id}
        onClick={(event) => {
          event.stopPropagation();
          void (user.viewer_follows ? onUnfollow(user) : onFollow(user));
        }}
      >
        {actionLoadingId === user.id ? "..." : user.viewer_follows ? "Siguiendo" : "Seguir"}
      </button>
    );
  };

  return (
    <div className="modal-backdrop profile-social-backdrop" onMouseDown={onClose}>
      <section
        className="modal-card profile-social-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-social-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="profile-social-modal-title">{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <input
          className="field profile-social-search"
          placeholder="Buscar usuarios"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />

        <div className="profile-social-divider" />

        <div className="profile-social-list">
          {loading ? <p className="profile-social-status">Cargando usuarios...</p> : null}
          {!loading && error ? <p className="profile-social-status error">{error}</p> : null}
          {!loading && !error && filteredUsers.length === 0 ? (
            <p className="profile-social-status">No se encontraron usuarios</p>
          ) : null}

          {!loading && !error
            ? filteredUsers.map((user) => (
                <article
                  key={user.id}
                  className="profile-social-user"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onClose();
                    onOpenProfile(user.username);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onClose();
                      onOpenProfile(user.username);
                    }
                  }}
                >
                  <div className="profile-social-user-main">
                    <UserAvatar
                      username={user.username}
                      photoUrl={user.foto_perfil_url}
                      className="profile-social-avatar"
                    />
                    <span>
                      <strong className="verified-name">
                        {user.username}
                        <VerifiedBadge tipoUsuario={user.tipo_usuario} />
                      </strong>
                      {user.nombre?.trim() ? <small>{user.nombre}</small> : null}
                    </span>
                  </div>
                  {renderAction(user)}
                </article>
              ))
            : null}
        </div>
      </section>
    </div>
  );
}

export default ProfileSocialModal;
