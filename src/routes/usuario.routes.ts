import { Router } from "express";
import {
  crearUsuario,
  login,
  actualizarUsuario,
  getUsuarios,
  getUsuarioPorId
} from "../controllers/usuario.controllers";

const router = Router();

// POST
router.post("/usuarios", crearUsuario);
router.post("/login", login);

// GET
router.get("/usuarios", getUsuarios);
router.get("/usuarios/:id", getUsuarioPorId);

// PUT
router.put("/usuarios/:id", actualizarUsuario);

export default router;