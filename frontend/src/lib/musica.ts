// Música en entrenamientos y rutinas: playlist de Spotify (link pegado) y canción de Apple.
// Todo pasa por el backend, que habla con Spotify (oEmbed) y Apple (RSS + iTunes Search).

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const AUTH_STORAGE_KEY = "gymmaxxing_auth_v1";

export type MusicaPlaylist = {
  url: string;
  titulo: string | null;
  portada_url: string | null;
};

export type MusicaCancion = {
  apple_id: string;
  titulo: string;
  artista: string;
  portada_url: string | null;
  url: string;
};

// Campos de música tal como vienen en un entrenamiento o rutina.
export type MusicaCampos = {
  playlist_url?: string | null;
  playlist_titulo?: string | null;
  playlist_portada_url?: string | null;
  cancion_apple_id?: string | null;
  cancion_titulo?: string | null;
  cancion_artista?: string | null;
  cancion_portada_url?: string | null;
  cancion_url?: string | null;
};

export const playlistDesdeCampos = (campos: MusicaCampos | null | undefined): MusicaPlaylist | null =>
  campos?.playlist_url
    ? {
        url: campos.playlist_url,
        titulo: campos.playlist_titulo ?? null,
        portada_url: campos.playlist_portada_url ?? null,
      }
    : null;

export const cancionDesdeCampos = (campos: MusicaCampos | null | undefined): MusicaCancion | null =>
  campos?.cancion_url && campos.cancion_titulo
    ? {
        apple_id: campos.cancion_apple_id ?? "",
        titulo: campos.cancion_titulo,
        artista: campos.cancion_artista ?? "",
        portada_url: campos.cancion_portada_url ?? null,
        url: campos.cancion_url,
      }
    : null;

export const camposDesdeMusica = (
  playlist: MusicaPlaylist | null,
  cancion: MusicaCancion | null,
): Required<MusicaCampos> => ({
  playlist_url: playlist?.url ?? null,
  playlist_titulo: playlist?.titulo ?? null,
  playlist_portada_url: playlist?.portada_url ?? null,
  cancion_apple_id: cancion?.apple_id ?? null,
  cancion_titulo: cancion?.titulo ?? null,
  cancion_artista: cancion?.artista ?? null,
  cancion_portada_url: cancion?.portada_url ?? null,
  cancion_url: cancion?.url ?? null,
});

// Chequeo rápido en el navegador; el backend valida de verdad.
export const pareceLinkSpotify = (value: string) =>
  /^(https?:\/\/(open\.spotify\.com|spotify\.link)\/|spotify:)/i.test(value.trim());

const getToken = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
};

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const token = getToken();
  if (!token) throw new Error("Volvé a iniciar sesión para agregar música");

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "No se pudo completar la acción");
  }
  return data;
};

export const getTendencias = async (signal?: AbortSignal) =>
  (await request<{ canciones: MusicaCancion[] }>("/musica/tendencias?limit=50", signal ? { signal } : {}))
    .canciones;

export const buscarCanciones = async (query: string, signal?: AbortSignal) =>
  (
    await request<{ canciones: MusicaCancion[] }>(
      `/musica/buscar?q=${encodeURIComponent(query)}`,
      signal ? { signal } : {},
    )
  ).canciones;

export const previewSpotify = (url: string, signal?: AbortSignal) =>
  request<MusicaPlaylist>(`/musica/spotify/preview?url=${encodeURIComponent(url)}`, signal ? { signal } : {});

// Guarda la música de un entrenamiento. Solo manda lo que se pasa: null borra.
export const guardarMusicaSesion = (
  sesionId: number,
  cambios: { playlist_url?: string | null; cancion?: MusicaCancion | null },
) =>
  request<MusicaCampos>(`/entrenamientos/${sesionId}/musica`, {
    method: "PUT",
    body: JSON.stringify(cambios),
  });

export const guardarPlaylistRutina = (rutinaId: number, playlistUrl: string | null) =>
  request<MusicaCampos>(`/rutinas/${rutinaId}/playlist`, {
    method: "PUT",
    body: JSON.stringify({ playlist_url: playlistUrl }),
  });
