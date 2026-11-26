import { readFileSync } from "fs";
import path from "path";
import { pool } from "../db";

/*
  Música en GymMaxxing, sin que el usuario tenga que vincular ninguna cuenta.

  - Playlist de Spotify: el usuario pega el link. Con el oEmbed oficial de Spotify
    (https://open.spotify.com/oembed, no pide clave) sacamos el título y la portada.
  - Canción: tendencias del país (RSS "most played" de Apple Music) y búsqueda con la
    iTunes Search API. Ninguna de las dos pide clave. La búsqueda tiene un límite de
    ~20 llamadas por minuto por IP, por eso cacheamos todo.

  Todas las llamadas externas se hacen desde acá (y no desde el navegador) para
  evitar problemas de CORS y para controlar el límite de Apple.
*/

const COUNTRY = (process.env.MUSIC_COUNTRY?.trim() || "ar").toLowerCase();
const FETCH_TIMEOUT_MS = 8000;
const TRENDING_TTL_MS = 3 * 60 * 60 * 1000;
const SEARCH_TTL_MS = 10 * 60 * 1000;
const OEMBED_TTL_MS = 24 * 60 * 60 * 1000;
const TEXT_MAX = 200;

export type CancionApple = {
  apple_id: string;
  titulo: string;
  artista: string;
  portada_url: string | null;
  url: string;
};

export type PlaylistSpotify = {
  url: string;
  tipo: "playlist" | "album" | "track" | "artist" | "show" | "episode" | "link";
  titulo: string | null;
  portada_url: string | null;
};

export class MusicaError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/* ---------- columnas ---------- */

let musicColumnsReady: Promise<void> | null = null;

// Mismo SQL que sql/2026-11-26_add_musica.sql. Se corre al arrancar el backend
// para que la app no se rompa si alguien no aplicó la migración.
export const ensureMusicColumns = () => {
  if (!musicColumnsReady) {
    const sqlPath = path.resolve(__dirname, "../../sql/2026-11-26_add_musica.sql");
    musicColumnsReady = pool
      .query(readFileSync(sqlPath, "utf8"))
      .then(() => undefined)
      .catch((error) => {
        musicColumnsReady = null;
        throw error;
      });
  }
  return musicColumnsReady;
};

/* ---------- helpers ---------- */

type CacheEntry<T> = { value: T; expiresAt: number };

const fetchJson = async <T>(url: string): Promise<{ status: number; data: T | null }> => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json", "User-Agent": "GymMaxxing/1.0" },
  });
  if (!response.ok) {
    return { status: response.status, data: null };
  }
  // iTunes a veces responde JSON con content-type text/javascript.
  const text = await response.text();
  return { status: response.status, data: JSON.parse(text) as T };
};

const cleanText = (value: unknown) =>
  typeof value === "string" ? value.trim().slice(0, TEXT_MAX) : "";

// Las portadas de Apple vienen en 100x100; pedimos una más grande cambiando la URL.
const biggerArtwork = (url: unknown) =>
  typeof url === "string" && url ? url.replace(/\/\d+x\d+bb\./, "/300x300bb.") : null;

const isHttpsHost = (value: string, hostCheck: (host: string) => boolean) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && hostCheck(url.hostname.toLowerCase());
  } catch {
    return false;
  }
};

// Recordamos las canciones que devolvimos, así al guardar usamos nuestros datos
// y no lo que mande el navegador.
const knownSongs = new Map<string, CancionApple>();
const rememberSongs = (songs: CancionApple[]) => {
  for (const song of songs) knownSongs.set(song.apple_id, song);
  if (knownSongs.size > 5000) knownSongs.clear();
  return songs;
};

/* ---------- Apple: tendencias y búsqueda ---------- */

type AppleRssResponse = {
  feed?: {
    results?: Array<{
      id?: string;
      name?: string;
      artistName?: string;
      artworkUrl100?: string;
      url?: string;
    }>;
  };
};

type ITunesSearchResponse = {
  results?: Array<{
    trackId?: number;
    trackName?: string;
    artistName?: string;
    artworkUrl100?: string;
    trackViewUrl?: string;
  }>;
};

let trendingCache: CacheEntry<CancionApple[]> | null = null;

export const getTendencias = async (limit = 50): Promise<CancionApple[]> => {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 100);
  if (trendingCache && trendingCache.expiresAt > Date.now()) {
    return trendingCache.value.slice(0, safeLimit);
  }

  try {
    const { data } = await fetchJson<AppleRssResponse>(
      `https://rss.marketingtools.apple.com/api/v2/${COUNTRY}/music/most-played/100/songs.json`
    );
    const songs = (data?.feed?.results ?? [])
      .filter((item) => item.id && item.name && item.url)
      .map((item) => ({
        apple_id: String(item.id),
        titulo: cleanText(item.name),
        artista: cleanText(item.artistName),
        portada_url: biggerArtwork(item.artworkUrl100),
        url: String(item.url),
      }));

    if (songs.length === 0) throw new Error("Apple devolvió las tendencias vacías");
    trendingCache = { value: rememberSongs(songs), expiresAt: Date.now() + TRENDING_TTL_MS };
    return songs.slice(0, safeLimit);
  } catch (error) {
    console.error("ERROR TENDENCIAS APPLE:", error);
    // Si Apple falla, mejor mostrar las tendencias viejas que nada.
    if (trendingCache) return trendingCache.value.slice(0, safeLimit);
    throw new MusicaError("No se pudieron cargar las tendencias, probá de nuevo en un rato", 502);
  }
};

const searchCache = new Map<string, CacheEntry<CancionApple[]>>();

export const buscarCanciones = async (rawQuery: string): Promise<CancionApple[]> => {
  const query = rawQuery.trim().replace(/\s+/g, " ").slice(0, 80);
  if (query.length < 2) return [];

  const key = query.toLowerCase();
  const cached = searchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const params = new URLSearchParams({
      term: query,
      entity: "song",
      media: "music",
      country: COUNTRY,
      limit: "20",
    });
    const { status, data } = await fetchJson<ITunesSearchResponse>(
      `https://itunes.apple.com/search?${params.toString()}`
    );
    if (status === 403 || status === 429) {
      throw new MusicaError("Demasiadas búsquedas seguidas, esperá unos segundos", 429);
    }

    const songs = (data?.results ?? [])
      .filter((item) => item.trackId && item.trackName && item.trackViewUrl)
      .map((item) => ({
        apple_id: String(item.trackId),
        titulo: cleanText(item.trackName),
        artista: cleanText(item.artistName),
        portada_url: biggerArtwork(item.artworkUrl100),
        url: String(item.trackViewUrl),
      }));

    if (searchCache.size > 500) searchCache.clear();
    searchCache.set(key, { value: rememberSongs(songs), expiresAt: Date.now() + SEARCH_TTL_MS });
    return songs;
  } catch (error) {
    if (error instanceof MusicaError) throw error;
    console.error("ERROR BUSQUEDA APPLE:", error);
    throw new MusicaError("No se pudo buscar canciones, probá de nuevo", 502);
  }
};

// Valida la canción que manda el navegador. Si la devolvimos nosotros, usamos nuestros datos.
export const resolverCancion = (input: unknown): CancionApple => {
  const raw = (input ?? {}) as Record<string, unknown>;
  const appleId = cleanText(raw.apple_id);
  if (!/^\d{1,20}$/.test(appleId)) {
    throw new MusicaError("Canción inválida", 400);
  }

  const known = knownSongs.get(appleId);
  if (known) return known;

  const titulo = cleanText(raw.titulo);
  const artista = cleanText(raw.artista);
  const url = cleanText(raw.url);
  const portada = cleanText(raw.portada_url);

  if (!titulo || !isHttpsHost(url, (host) => host === "music.apple.com")) {
    throw new MusicaError("Canción inválida", 400);
  }

  return {
    apple_id: appleId,
    titulo,
    artista,
    url,
    portada_url:
      portada && isHttpsHost(portada, (host) => host.endsWith(".mzstatic.com")) ? portada : null,
  };
};

/* ---------- Spotify: link pegado + oEmbed ---------- */

const SPOTIFY_TYPES = new Set(["playlist", "album", "track", "artist", "show", "episode"]);

// Acepta links de open.spotify.com (con o sin /intl-xx/), links cortos de spotify.link
// y URIs spotify:playlist:ID. Devuelve el link limpio, sin ?si= ni utm.
export const normalizarLinkSpotify = (raw: string): { url: string; tipo: PlaylistSpotify["tipo"] } => {
  const value = raw.trim();

  const uriMatch = value.match(/^spotify:(playlist|album|track|artist|show|episode):([A-Za-z0-9]{10,40})$/);
  if (uriMatch) {
    return { url: `https://open.spotify.com/${uriMatch[1]}/${uriMatch[2]}`, tipo: uriMatch[1] as PlaylistSpotify["tipo"] };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new MusicaError("Pegá un link de Spotify (open.spotify.com/...)", 400);
  }

  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new MusicaError("Pegá un link de Spotify (open.spotify.com/...)", 400);
  }

  if (host === "spotify.link") {
    const code = url.pathname.replace(/^\/+|\/+$/g, "");
    if (!/^[A-Za-z0-9]{4,40}$/.test(code)) {
      throw new MusicaError("Ese link de Spotify no es válido", 400);
    }
    return { url: `https://spotify.link/${code}`, tipo: "link" };
  }

  if (host !== "open.spotify.com") {
    throw new MusicaError("Solo se aceptan links de Spotify (open.spotify.com/...)", 400);
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0]?.startsWith("intl-")) parts.shift();
  if (parts[0] === "embed") parts.shift();
  const [tipo, id] = parts;

  if (!tipo || !SPOTIFY_TYPES.has(tipo) || !id || !/^[A-Za-z0-9]{10,40}$/.test(id)) {
    throw new MusicaError("Ese link de Spotify no es válido", 400);
  }

  return { url: `https://open.spotify.com/${tipo}/${id}`, tipo: tipo as PlaylistSpotify["tipo"] };
};

type OEmbedResponse = {
  title?: string;
  thumbnail_url?: string;
};

const oembedCache = new Map<string, CacheEntry<PlaylistSpotify>>();

export const getPreviewSpotify = async (rawUrl: string): Promise<PlaylistSpotify> => {
  const { url, tipo } = normalizarLinkSpotify(rawUrl);
  const cached = oembedCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let status = 0;
  let data: OEmbedResponse | null = null;
  try {
    ({ status, data } = await fetchJson<OEmbedResponse>(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`
    ));
  } catch (error) {
    // Sin conexión con Spotify: guardamos el link igual, sin título ni portada.
    console.error("ERROR OEMBED SPOTIFY:", error);
    return { url, tipo, titulo: null, portada_url: null };
  }

  if (status === 400 || status === 404) {
    throw new MusicaError("No encontramos eso en Spotify. Revisá que el link sea público", 404);
  }
  if (!data) {
    return { url, tipo, titulo: null, portada_url: null };
  }

  const preview: PlaylistSpotify = {
    url,
    tipo,
    titulo: cleanText(data.title) || null,
    portada_url:
      typeof data.thumbnail_url === "string" &&
      isHttpsHost(data.thumbnail_url, (host) => host.endsWith("scdn.co") || host.endsWith("spotifycdn.com"))
        ? data.thumbnail_url
        : null,
  };

  if (oembedCache.size > 1000) oembedCache.clear();
  oembedCache.set(url, { value: preview, expiresAt: Date.now() + OEMBED_TTL_MS });
  return preview;
};

/* ---------- guardar en sesión y rutina ---------- */

type MusicaSesionInput = {
  playlist_url?: string | null | undefined;
  cancion?: unknown;
};

// Solo cambia lo que viene en el body: playlist_url o cancion. null borra.
export const updateMusicaSesion = async (
  sesionId: number,
  usuarioId: number,
  input: MusicaSesionInput
) => {
  await ensureMusicColumns();
  const sets: string[] = [];
  const params: unknown[] = [sesionId, usuarioId];
  const push = (column: string, value: unknown) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  if (input.playlist_url !== undefined) {
    const rawUrl = typeof input.playlist_url === "string" ? input.playlist_url.trim() : "";
    const playlist = rawUrl ? await getPreviewSpotify(rawUrl) : null;
    push("playlist_url", playlist?.url ?? null);
    push("playlist_titulo", playlist?.titulo ?? null);
    push("playlist_portada_url", playlist?.portada_url ?? null);
  }

  if (input.cancion !== undefined) {
    const cancion = input.cancion ? resolverCancion(input.cancion) : null;
    push("cancion_apple_id", cancion?.apple_id ?? null);
    push("cancion_titulo", cancion?.titulo ?? null);
    push("cancion_artista", cancion?.artista ?? null);
    push("cancion_portada_url", cancion?.portada_url ?? null);
    push("cancion_url", cancion?.url ?? null);
  }

  if (sets.length === 0) {
    throw new MusicaError("No hay cambios de música para guardar", 400);
  }

  const result = await pool.query(
    `UPDATE sesionentrenamiento
     SET ${sets.join(", ")}
     WHERE id_sesion = $1 AND usuario_id = $2
     RETURNING id_sesion, playlist_url, playlist_titulo, playlist_portada_url,
               cancion_apple_id, cancion_titulo, cancion_artista, cancion_portada_url, cancion_url`,
    params
  );

  if (result.rowCount !== 1) {
    throw new MusicaError("Entrenamiento no encontrado", 404);
  }
  return result.rows[0];
};

export const updatePlaylistRutina = async (rutinaId: number, rawUrl: unknown) => {
  await ensureMusicColumns();
  const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
  const playlist = url ? await getPreviewSpotify(url) : null;

  const result = await pool.query(
    `UPDATE rutina
     SET playlist_url = $2, playlist_titulo = $3, playlist_portada_url = $4
     WHERE id_rutina = $1
     RETURNING id_rutina, playlist_url, playlist_titulo, playlist_portada_url`,
    [rutinaId, playlist?.url ?? null, playlist?.titulo ?? null, playlist?.portada_url ?? null]
  );

  if (result.rowCount !== 1) {
    throw new MusicaError("Rutina no encontrada", 404);
  }
  return result.rows[0];
};
