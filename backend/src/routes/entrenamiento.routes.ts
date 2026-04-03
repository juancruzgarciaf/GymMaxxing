import { Router } from "express";
import {
  iniciarSesionEntrenamiento,
  getSesionPorId,
  registrarSerie,
  getSeriesDeSesion,
  finalizarSesion,
} from "../controllers/entrenamiento.controller";

const router = Router();

// sesión
router.post("/start", iniciarSesionEntrenamiento);
router.get("/sesion/:id", getSesionPorId);
router.post("/end", finalizarSesion);
router.post("/:id/finalizar", finalizarSesion);

// series
router.post("/serie", registrarSerie);
router.get("/sesion/:id/series", getSeriesDeSesion);

export default router;
