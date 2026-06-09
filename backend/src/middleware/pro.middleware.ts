import { NextFunction, Request, Response } from "express";
import { isUserPro } from "../services/subscription.service";

export const requirePro = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.authUser) {
    return res.status(401).json({ error: "Token requerido" });
  }

  try {
    if (!(await isUserPro(req.authUser.id))) {
      return res.status(403).json({
        error: "Esta funcion requiere GymMaxxing PRO",
      });
    }

    return next();
  } catch (error) {
    console.error("ERROR VALIDATING PRO:", error);
    return res.status(500).json({
      error: "No se pudo validar la suscripcion PRO",
    });
  }
};
