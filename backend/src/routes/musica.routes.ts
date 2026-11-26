import { Router } from "express";
import { buscarCanciones, getPreviewSpotify, getTendencias } from "../controllers/musica.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// Piden login para que nadie use el backend como proxy gratis de Apple/Spotify.
router.get("/tendencias", requireAuth, getTendencias);
router.get("/buscar", requireAuth, buscarCanciones);
router.get("/spotify/preview", requireAuth, getPreviewSpotify);

export default router;
