import { useEffect, useRef, useState } from "react";
import {
  buscarCanciones,
  getTendencias,
  pareceLinkSpotify,
  previewSpotify,
  type MusicaCancion,
  type MusicaPlaylist,
} from "../lib/musica";
import MusicaChips, { MusicCover, MusicNoteIcon } from "./MusicaChips";
import "./Musica.css";

type MusicaEditorProps = {
  playlist: MusicaPlaylist | null;
  onPlaylistChange: (playlist: MusicaPlaylist | null) => void;
  // Si no se pasa onCancionChange, solo se edita la playlist (caso rutina).
  cancion?: MusicaCancion | null;
  onCancionChange?: (cancion: MusicaCancion | null) => void;
  disabled?: boolean;
  playlistHint?: string;
};

type LinkStatus = "idle" | "loading" | "ok" | "error";

const MusicaEditor = ({
  playlist,
  onPlaylistChange,
  cancion = null,
  onCancionChange,
  disabled = false,
  playlistHint = "Pegá el link de la playlist de Spotify que usaste (Compartir → Copiar enlace).",
}: MusicaEditorProps) => {
  const [linkText, setLinkText] = useState(playlist?.url ?? "");
  const [linkStatus, setLinkStatus] = useState<LinkStatus>(playlist ? "ok" : "idle");
  const [linkError, setLinkError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  // Último link que conocemos (el que mandamos al padre o el que vino de afuera).
  const [knownUrl, setKnownUrl] = useState<string | null>(playlist?.url ?? null);

  const emitPlaylist = (next: MusicaPlaylist | null) => {
    setKnownUrl(next?.url ?? null);
    onPlaylistChange(next);
  };

  // Si la playlist cambia desde afuera (por ejemplo, viene precargada de la rutina), la mostramos.
  const incomingUrl = playlist?.url ?? null;
  if (incomingUrl !== knownUrl) {
    setKnownUrl(incomingUrl);
    setLinkText(incomingUrl ?? "");
    setLinkStatus(incomingUrl ? "ok" : "idle");
    setLinkError("");
  }

  const handleLinkChange = (value: string) => {
    setLinkText(value);
    const clean = value.trim();

    if (!clean) {
      setLinkStatus("idle");
      setLinkError("");
      emitPlaylist(null);
    } else if (!pareceLinkSpotify(clean)) {
      setLinkStatus("error");
      setLinkError("Tiene que ser un link de Spotify (open.spotify.com/...)");
      emitPlaylist(null);
    } else {
      setLinkStatus("loading");
      setLinkError("");
    }
  };

  // Con un link de Spotify válido, buscamos título y portada (cuando deja de escribir).
  useEffect(() => {
    if (linkStatus !== "loading") {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      previewSpotify(linkText.trim(), controller.signal)
        .then((preview) => {
          setLinkStatus("ok");
          setLinkText(preview.url);
          emitPlaylist(preview);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setLinkStatus("error");
          setLinkError(error instanceof Error ? error.message : "No se pudo leer el link");
          emitPlaylist(null);
        });
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // emitPlaylist cambia en cada render; solo nos importa el texto y el estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkText, linkStatus]);

  const quitarPlaylist = () => {
    setLinkText("");
    setLinkStatus("idle");
    setLinkError("");
    emitPlaylist(null);
  };

  return (
    <div className="music-editor">
      <span className="music-editor-title">
        <MusicNoteIcon /> Música (opcional)
      </span>

      <label className="music-editor-field">
        <span>Playlist de Spotify</span>
        <input
          className="field"
          type="url"
          inputMode="url"
          placeholder="https://open.spotify.com/playlist/..."
          value={linkText}
          onChange={(event) => handleLinkChange(event.target.value)}
          disabled={disabled}
        />
        {linkStatus === "loading" ? <small className="music-editor-hint">Buscando la playlist...</small> : null}
        {linkStatus === "error" ? <small className="music-editor-error">{linkError}</small> : null}
        {linkStatus === "idle" ? <small className="music-editor-hint">{playlistHint}</small> : null}
      </label>

      {onCancionChange ? (
        <div className="music-editor-field">
          <span>Canción</span>
          <button
            type="button"
            className="btn secondary music-editor-add"
            onClick={() => setPickerOpen(true)}
            disabled={disabled}
          >
            <MusicNoteIcon />
            {cancion ? "Cambiar canción" : "Agregar canción"}
          </button>
        </div>
      ) : null}

      <MusicaChips
        playlist={linkStatus === "ok" ? playlist : null}
        cancion={onCancionChange ? cancion : null}
        {...(disabled ? {} : { onRemovePlaylist: quitarPlaylist })}
        {...(onCancionChange && !disabled ? { onRemoveCancion: () => onCancionChange(null) } : {})}
      />

      {pickerOpen && onCancionChange ? (
        <SongPickerModal
          onClose={() => setPickerOpen(false)}
          onSelect={(song) => {
            onCancionChange(song);
            setPickerOpen(false);
          }}
        />
      ) : null}
    </div>
  );
};

/* ---------- selector de canción ---------- */

// Las tendencias se piden una vez por visita (el backend igual las cachea por horas).
let tendenciasCache: MusicaCancion[] | null = null;

type SongPickerModalProps = {
  onClose: () => void;
  onSelect: (song: MusicaCancion) => void;
};

const SongPickerModal = ({ onClose, onSelect }: SongPickerModalProps) => {
  const [tab, setTab] = useState<"tendencias" | "buscar">("tendencias");
  const [tendencias, setTendencias] = useState<MusicaCancion[] | null>(tendenciasCache);
  const [tendenciasError, setTendenciasError] = useState("");
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<MusicaCancion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [busquedaError, setBusquedaError] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (tendenciasCache) return;
    const controller = new AbortController();
    getTendencias(controller.signal)
      .then((songs) => {
        tendenciasCache = songs;
        setTendencias(songs);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setTendenciasError(error instanceof Error ? error.message : "No se pudieron cargar las tendencias");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (tab === "buscar") searchInputRef.current?.focus();
  }, [tab]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setBusquedaError("");
    if (value.trim().length < 2) {
      setResultados([]);
      setBuscando(false);
    } else {
      setBuscando(true);
    }
  };

  // Busca cuando el usuario deja de escribir, para no gastar el límite de Apple.
  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      buscarCanciones(value, controller.signal)
        .then((songs) => setResultados(songs))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setBusquedaError(error instanceof Error ? error.message : "No se pudo buscar");
        })
        .finally(() => {
          if (!controller.signal.aborted) setBuscando(false);
        });
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const lista = tab === "tendencias" ? tendencias ?? [] : resultados;

  return (
    <div className="modal-backdrop music-picker-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card music-picker"
        role="dialog"
        aria-modal="true"
        aria-label="Elegir canción"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2>Elegir canción</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="music-picker-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "tendencias"}
            className={tab === "tendencias" ? "active" : ""}
            onClick={() => setTab("tendencias")}
          >
            Tendencias
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "buscar"}
            className={tab === "buscar" ? "active" : ""}
            onClick={() => setTab("buscar")}
          >
            Buscar
          </button>
        </div>

        {tab === "buscar" ? (
          <input
            ref={searchInputRef}
            className="field"
            type="search"
            placeholder="Buscá por canción o artista"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
          />
        ) : (
          <p className="music-picker-caption">Lo más escuchado en Argentina esta semana</p>
        )}

        <div className="music-picker-list">
          {tab === "tendencias" && !tendencias && !tendenciasError ? (
            <p className="music-picker-status">Cargando tendencias...</p>
          ) : null}
          {tab === "tendencias" && tendenciasError ? (
            <p className="music-picker-status music-editor-error">{tendenciasError}</p>
          ) : null}
          {tab === "buscar" && buscando ? <p className="music-picker-status">Buscando...</p> : null}
          {tab === "buscar" && busquedaError ? (
            <p className="music-picker-status music-editor-error">{busquedaError}</p>
          ) : null}
          {tab === "buscar" && !buscando && !busquedaError && query.trim().length >= 2 && resultados.length === 0 ? (
            <p className="music-picker-status">No encontramos canciones con esa búsqueda.</p>
          ) : null}
          {tab === "buscar" && query.trim().length < 2 ? (
            <p className="music-picker-status">Escribí al menos 2 letras.</p>
          ) : null}

          {lista.map((song, index) => (
            <button
              key={song.apple_id}
              type="button"
              className="music-option"
              onClick={() => onSelect(song)}
            >
              {tab === "tendencias" ? <span className="music-option-rank">{index + 1}</span> : null}
              <MusicCover src={song.portada_url} fallback="cancion" className="music-option-cover" />
              <span className="music-option-text">
                <strong>{song.titulo}</strong>
                <small>{song.artista}</small>
              </span>
            </button>
          ))}
        </div>

        <p className="music-picker-credit">Canciones de Apple Music</p>
      </div>
    </div>
  );
};

export default MusicaEditor;
