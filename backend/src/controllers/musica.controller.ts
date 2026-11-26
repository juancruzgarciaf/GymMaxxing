import { Request, Response } from "express";
import * as musicaService from "../services/musica.service";

const handleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof musicaService.MusicaError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
};

// GET /musica/tendencias?limit=50
export const getTendencias = async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit ?? 50);
    const canciones = await musicaService.getTendencias(limit);
    return res.json({ canciones });
  } catch (error) {
    return handleError(res, error, "No se pudieron cargar las tendencias");
  }
};

// GET /musica/buscar?q=duki
export const buscarCanciones = async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const canciones = await musicaService.buscarCanciones(q);
    return res.json({ canciones });
  } catch (error) {
    return handleError(res, error, "No se pudo buscar canciones");
  }
};

// GET /musica/spotify/preview?url=https://open.spotify.com/playlist/...
export const getPreviewSpotify = async (req: Request, res: Response) => {
  try {
    const url = typeof req.query.url === "string" ? req.query.url : "";
    if (!url.trim()) {
      return res.status(400).json({ error: "Falta el link de Spotify" });
    }
    const playlist = await musicaService.getPreviewSpotify(url);
    return res.json(playlist);
  } catch (error) {
    return handleError(res, error, "No se pudo leer el link de Spotify");
  }
};

// PUT /entrenamientos/:id/musica  body: { playlist_url?: string | null, cancion?: {...} | null }
export const updateMusicaSesion = async (req: Request, res: Response) => {
  try {
    const sesionId = Number(req.params.id);
    if (!Number.isInteger(sesionId) || sesionId <= 0 || !req.authUser) {
      return res.status(400).json({ error: "Sesión inválida" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const musica = await musicaService.updateMusicaSesion(sesionId, req.authUser.id, {
      playlist_url: "playlist_url" in body ? (body.playlist_url as string | null) : undefined,
      cancion: "cancion" in body ? body.cancion : undefined,
    });
    return res.json(musica);
  } catch (error) {
    return handleError(res, error, "No se pudo guardar la música del entrenamiento");
  }
};

// PUT /rutinas/:id/playlist  body: { playlist_url: string | null }
export const updatePlaylistRutina = async (req: Request, res: Response) => {
  try {
    const rutinaId = Number(req.params.id);
    if (!Number.isInteger(rutinaId) || rutinaId <= 0) {
      return res.status(400).json({ error: "id de rutina inválido" });
    }
    const playlist = await musicaService.updatePlaylistRutina(rutinaId, req.body?.playlist_url);
    return res.json(playlist);
  } catch (error) {
    return handleError(res, error, "No se pudo guardar la playlist de la rutina");
  }
};
