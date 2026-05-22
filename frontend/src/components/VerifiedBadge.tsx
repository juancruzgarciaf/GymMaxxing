type VerifiedBadgeProps = {
  tipoUsuario?: string | null;
  className?: string;
};

const isVerifiedGym = (tipoUsuario?: string | null) =>
  (tipoUsuario ?? "").trim().toLowerCase() === "gimnasio";

function VerifiedBadge({ tipoUsuario, className = "" }: VerifiedBadgeProps) {
  if (!isVerifiedGym(tipoUsuario)) {
    return null;
  }

  return (
    <span
      className={`verified-badge ${className}`.trim()}
      title="Gimnasio verificado"
      aria-label="Gimnasio verificado"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M9.4 16.8 4.9 12.3 6.8 10.4 9.4 13 17.2 5.2 19.1 7.1 9.4 16.8Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

export default VerifiedBadge;
