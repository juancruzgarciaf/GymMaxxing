import { Router } from "express";
import { getEjercicios } from "../controllers/ejercicio.controller";

const router = Router();

router.get("/", getEjercicios);
//pushpulllegs

export default router;