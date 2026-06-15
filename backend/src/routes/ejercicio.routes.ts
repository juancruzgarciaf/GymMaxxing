import { Router } from "express";
import {
  borrarEjercicioPersonalizado,
  crearEjercicioPersonalizado,
  getEjercicios,
  getMisEjerciciosPersonalizados,
  uploadExerciseImage,
} from "../controllers/ejercicio.controller";
import { optionalAuth, requireAuth } from "../middleware/auth.middleware";
import { requirePro } from "../middleware/pro.middleware";
import { createImageUpload } from "../middleware/upload.middleware";

const router = Router();
const exerciseImageUpload = createImageUpload("exercises", { allowMp4: true });

router.get("/", optionalAuth, getEjercicios);
router.get("/mios", requireAuth, getMisEjerciciosPersonalizados);
router.post("/", requireAuth, requirePro, crearEjercicioPersonalizado);
router.post("/:id/image", requireAuth, exerciseImageUpload.single("image"), uploadExerciseImage);
router.delete("/:id", requireAuth, borrarEjercicioPersonalizado);

export default router;
