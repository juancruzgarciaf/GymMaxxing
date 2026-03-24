import { Router } from "express";
import { crearUsuario, login } from "../controllers/usuario.controllers";

const router = Router();

router.post("/usuarios", crearUsuario);
router.post("/login", login);

export default router;