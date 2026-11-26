import { Router } from "express";
import { updatePlaylistRutina } from "../controllers/musica.controller";
import {
  crearRutina,
  getRutinas,
  getDiscoverRutinas,
  getRutinaPorId,
  updateRutina,
  deleteRutina,
  recordRutinaSave,
  recordRutinaCopy,
  addLikeToRutina,
  removeLikeFromRutina,
  getCarpetasRutina,
  crearCarpetaRutina,
  updateCarpetaRutina,
  deleteCarpetaRutina,
  agregarEjercicioARutina,
  getEjerciciosDeRutina,
  updateEjercicioDeRutina,
  deleteEjercicioDeRutina,
  getRutinaParaEditar,
} from "../controllers/rutina.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRutinaOwner } from "../middleware/rutina-owner.middleware";

const router = Router();

// ABM de rutina
// Lo que modifica una rutina exige token (requireAuth) y ser el creador (requireRutinaOwner).
router.post("/", requireAuth, crearRutina);
router.get("/", getRutinas);
router.get("/discover", getDiscoverRutinas);
router.get("/carpetas", getCarpetasRutina);
router.post("/carpetas", crearCarpetaRutina);
router.put("/carpetas/:id", updateCarpetaRutina);
router.delete("/carpetas/:id", deleteCarpetaRutina);
router.get("/:id/editar", requireAuth, requireRutinaOwner, getRutinaParaEditar);
router.get("/:id", getRutinaPorId);
router.put("/:id", requireAuth, requireRutinaOwner, updateRutina);
router.put("/:id/playlist", requireAuth, requireRutinaOwner, updatePlaylistRutina);
router.delete("/:id", requireAuth, requireRutinaOwner, deleteRutina);
router.post("/:id/metricas/guardar", recordRutinaSave);
router.post("/:id/metricas/copiar", recordRutinaCopy);
router.post("/:id/like", addLikeToRutina);
router.delete("/:id/like", removeLikeFromRutina);

// Gestión de ejercicios dentro de la rutina
router.post("/ejercicios", requireAuth, requireRutinaOwner, agregarEjercicioARutina);
router.get("/:id/ejercicios", getEjerciciosDeRutina);
router.put("/:id_rutina/ejercicios/:id_ejercicio", requireAuth, requireRutinaOwner, updateEjercicioDeRutina);
router.delete("/:id_rutina/ejercicios/:id_ejercicio", requireAuth, requireRutinaOwner, deleteEjercicioDeRutina);

export default router;
