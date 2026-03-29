import { Router } from "express";
import {
  updateUser,
  getUsuarios,
  getUsuarioPorId
} from "../controllers/user.controller";

const router = Router();

router.get("/", getUsuarios);
router.get("/:id", getUsuarioPorId);
router.put("/:id", updateUser);

export default router;