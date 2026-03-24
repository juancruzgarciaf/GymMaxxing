import { Router } from "express";
import { crearUsuario, login } from "../controllers/usuario.controllers";
import { actualizarUsuario } from "../controllers/usuario.controllers";

const router = Router();

router.post("/usuarios", crearUsuario);
router.post("/login", login);

router.put("/usuarios/:id", actualizarUsuario);
export default router;