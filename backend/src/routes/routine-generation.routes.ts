import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { generateRoutineDraft } from "../controllers/routine-generation.controller";

const router = Router();

router.post("/", requireAuth, generateRoutineDraft);

export default router;
