import { Router } from "express";
import {
  crearRutina,
  getRutinas,
  getRutinaPorId,
  updateRutina,
  deleteRutina,
  recordRutinaSave,
  recordRutinaCopy,
  getCarpetasRutina,
  crearCarpetaRutina,
  updateCarpetaRutina,
  deleteCarpetaRutina,
  agregarEjercicioARutina,
  getEjerciciosDeRutina,
  updateEjercicioDeRutina,
  deleteEjercicioDeRutina,
} from "../controllers/rutina.controller";

const router = Router();

// ABM de rutina
router.post("/", crearRutina);
router.get("/", getRutinas);
router.get("/carpetas", getCarpetasRutina);
router.post("/carpetas", crearCarpetaRutina);
router.put("/carpetas/:id", updateCarpetaRutina);
router.delete("/carpetas/:id", deleteCarpetaRutina);
router.get("/:id", getRutinaPorId);
router.put("/:id", updateRutina);
router.delete("/:id", deleteRutina);
router.post("/:id/metricas/guardar", recordRutinaSave);
router.post("/:id/metricas/copiar", recordRutinaCopy);

// Gestión de ejercicios dentro de la rutina
router.post("/ejercicios", agregarEjercicioARutina);
router.get("/:id/ejercicios", getEjerciciosDeRutina);
router.put("/:id_rutina/ejercicios/:id_ejercicio", updateEjercicioDeRutina);
router.delete("/:id_rutina/ejercicios/:id_ejercicio", deleteEjercicioDeRutina);

export default router;
