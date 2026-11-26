import { useState } from "react";
import type { MusicaCancion, MusicaPlaylist } from "../lib/musica";
import "./Musica.css";

type MusicaChipsProps = {
  playlist: MusicaPlaylist | null;
  cancion: MusicaCancion | null;
  // Si viene, muestra una cruz para sacar cada elemento (se usa en los formularios).
  onRemovePlaylist?: () => void;
  onRemoveCancion?: () => void;
};

export const MusicNoteIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      fill="currentColor"
      d="M19 3v11.6a3.4 3.4 0 1 1-2-3.1V7.2l-8 1.9v7.5a3.4 3.4 0 1 1-2-3.1V5.6L19 3Z"
    />
  </svg>
);

export const PlaylistIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      fill="currentColor"
      d="M3 6h12v2H3V6Zm0 4h12v2H3v-2Zm0 4h8v2H3v-2Zm14-8h4v2h-2v8.5a2.5 2.5 0 1 1-2-2.45V6Z"
    />
  </svg>
);

// Portada con respaldo: si la imagen no carga, mostramos un ícono.
export const MusicCover = ({
  src,
  fallback,
  className,
}: {
  src: string | null;
  fallback: "playlist" | "cancion";
  className: string;
}) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <span className={`${className} music-cover-empty`}>
        {fallback === "playlist" ? <PlaylistIcon /> : <MusicNoteIcon />}
      </span>
    );
  }

  return <img className={className} src={src} alt="" loading="lazy" onError={() => setFailedSrc(src)} />;
};

// Playlist de Spotify y canción de Apple, como links que abren la app correspondiente.
const MusicaChips = ({ playlist, cancion, onRemovePlaylist, onRemoveCancion }: MusicaChipsProps) => {
  if (!playlist && !cancion) {
    return null;
  }

  return (
    <div className="music-pills">
      {playlist ? (
        <div className="music-pill-wrap">
          <a
            className="music-pill music-pill-spotify"
            href={playlist.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir en Spotify"
          >
            <MusicCover src={playlist.portada_url} fallback="playlist" className="music-pill-cover" />
            <span className="music-pill-text">
              <small>Playlist · Spotify</small>
              <strong>{playlist.titulo || "Playlist de Spotify"}</strong>
            </span>
          </a>
          {onRemovePlaylist ? (
            <button
              type="button"
              className="music-pill-remove"
              onClick={onRemovePlaylist}
              aria-label="Quitar playlist"
              title="Quitar playlist"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}

      {cancion ? (
        <div className="music-pill-wrap">
          <a
            className="music-pill music-pill-apple"
            href={cancion.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir en Apple Music"
          >
            <MusicCover src={cancion.portada_url} fallback="cancion" className="music-pill-cover" />
            <span className="music-pill-text">
              <small>Canción · Apple Music</small>
              <strong>
                {cancion.titulo}
                {cancion.artista ? <span className="music-pill-artist"> — {cancion.artista}</span> : null}
              </strong>
            </span>
          </a>
          {onRemoveCancion ? (
            <button
              type="button"
              className="music-pill-remove"
              onClick={onRemoveCancion}
              aria-label="Quitar canción"
              title="Quitar canción"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default MusicaChips;
