import { resolveMediaUrl } from "../lib/media";

type UserAvatarProps = {
  username: string;
  photoUrl?: string | null;
  className?: string;
};

function UserAvatar({ username, photoUrl, className = "avatar-circle" }: UserAvatarProps) {
  const resolvedPhoto = resolveMediaUrl(photoUrl);

  return (
    <span className={`${className} user-avatar`}>
      {resolvedPhoto ? (
        <img src={resolvedPhoto} alt={`Foto de perfil de ${username}`} />
      ) : (
        username.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

export default UserAvatar;
