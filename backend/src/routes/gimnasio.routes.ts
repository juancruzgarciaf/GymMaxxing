import { Router } from "express";
import { getGimnasiosCercanos } from "../controllers/gimnasio.controller";

const router = Router();

router.get("/cercanos", getGimnasiosCercanos);

export default router;
