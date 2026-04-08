import { Router } from "express";
import {
  iniciarSesionEntrenamiento,
  getSesionPorId,
  getSessionInteractionSummary,
  updateSesionEntrenamiento,
  registrarSerie,
  getSeriesDeSesion,
  addLikeToSesion,
  removeLikeFromSesion,
  getComentariosDeSesion,
  createComentarioDeSesion,
  deleteComentarioDeSesion,
  replaceSeriesDeSesion,
  finalizarSesion,
  deleteSesionEntrenamiento,
} from "../controllers/entrenamiento.controller";

const router = Router();

// sesión
router.post("/start", iniciarSesionEntrenamiento);
router.get("/sesion/:id", getSesionPorId);
router.get("/sesion/:id/interacciones", getSessionInteractionSummary);
router.get("/sesion/:id/comentarios", getComentariosDeSesion);
router.put("/:id", updateSesionEntrenamiento);
router.put("/:id/series", replaceSeriesDeSesion);
router.post("/end", finalizarSesion);
router.post("/:id/finalizar", finalizarSesion);
router.post("/:id/like", addLikeToSesion);
router.delete("/:id/like", removeLikeFromSesion);
router.post("/:id/comentarios", createComentarioDeSesion);
router.delete("/:id/comentarios/:commentId", deleteComentarioDeSesion);
router.delete("/:id", deleteSesionEntrenamiento);

// series
router.post("/serie", registrarSerie);
router.get("/sesion/:id/series", getSeriesDeSesion);

export default router;
