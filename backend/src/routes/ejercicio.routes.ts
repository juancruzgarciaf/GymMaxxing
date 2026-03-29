import { Router } from "express";
import { getEjercicios } from "../controllers/ejercicio.controller";

const router = Router();

router.get("/", getEjercicios);

export default router;