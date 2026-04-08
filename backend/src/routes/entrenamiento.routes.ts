import { Router } from "express";
import {
  iniciarSesionEntrenamiento,
  getSesionPorId,
  updateSesionEntrenamiento,
  registrarSerie,
  getSeriesDeSesion,
  replaceSeriesDeSesion,
  finalizarSesion,
  deleteSesionEntrenamiento,
} from "../controllers/entrenamiento.controller";

const router = Router();

// sesión
router.post("/start", iniciarSesionEntrenamiento);
router.get("/sesion/:id", getSesionPorId);
router.put("/:id", updateSesionEntrenamiento);
router.put("/:id/series", replaceSeriesDeSesion);
router.post("/end", finalizarSesion);
router.post("/:id/finalizar", finalizarSesion);
router.delete("/:id", deleteSesionEntrenamiento);

// series
router.post("/serie", registrarSerie);
router.get("/sesion/:id/series", getSeriesDeSesion);

export default router;
