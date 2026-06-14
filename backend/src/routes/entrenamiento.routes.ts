import { Router } from "express";
import {
  iniciarSesionEntrenamiento,
  getSesionPorId,
  getSessionInteractionSummary,
  updateSesionEntrenamiento,
  registrarSerie,
  getSeriesDeSesion,
  getSeriesAnterioresDeEjercicio,
  addLikeToSesion,
  removeLikeFromSesion,
  getComentariosDeSesion,
  createComentarioDeSesion,
  deleteComentarioDeSesion,
  replaceSeriesDeSesion,
  finalizarSesion,
  abandonarSesion,
  deleteSesionEntrenamiento,
  uploadTrainingImage,
} from "../controllers/entrenamiento.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { createImageUpload } from "../middleware/upload.middleware";

const router = Router();
const trainingImageUpload = createImageUpload("trainings");

// sesión
router.post("/start", iniciarSesionEntrenamiento);
router.get("/sesion/:id", getSesionPorId);
router.get("/sesion/:id/interacciones", getSessionInteractionSummary);
router.get("/sesion/:id/comentarios", getComentariosDeSesion);
router.put("/:id", updateSesionEntrenamiento);
router.post("/:id/image", requireAuth, trainingImageUpload.single("image"), uploadTrainingImage);
router.put("/:id/series", replaceSeriesDeSesion);
router.post("/end", finalizarSesion);
router.post("/:id/finalizar", finalizarSesion);
router.post("/:id/abandonar", abandonarSesion);
router.post("/:id/like", addLikeToSesion);
router.delete("/:id/like", removeLikeFromSesion);
router.post("/:id/comentarios", createComentarioDeSesion);
router.delete("/:id/comentarios/:commentId", deleteComentarioDeSesion);
router.delete("/:id", deleteSesionEntrenamiento);

// series
router.get("/series/anteriores", getSeriesAnterioresDeEjercicio);
router.post("/serie", registrarSerie);
router.get("/sesion/:id/series", getSeriesDeSesion);

export default router;
