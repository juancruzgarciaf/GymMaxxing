import { Router } from "express";
import {
  borrarEjercicioPersonalizado,
  crearEjercicioPersonalizado,
  getEjercicios,
  getMisEjerciciosPersonalizados,
} from "../controllers/ejercicio.controller";
import { optionalAuth, requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", optionalAuth, getEjercicios);
router.get("/mios", requireAuth, getMisEjerciciosPersonalizados);
router.post("/", requireAuth, crearEjercicioPersonalizado);
router.delete("/:id", requireAuth, borrarEjercicioPersonalizado);

export default router;
