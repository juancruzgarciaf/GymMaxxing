import { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../utils/token";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: number;
        email: string;
        username: string;
        tipo_usuario: string;
        exp: number;
      };
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Token requerido",
    });
  }

  const token = header.replace("Bearer ", "").trim();
  const payload = verifyAuthToken(token);

  if (!payload) {
    return res.status(401).json({
      error: "Token invalido o expirado",
    });
  }

  req.authUser = payload;
  return next();
};
