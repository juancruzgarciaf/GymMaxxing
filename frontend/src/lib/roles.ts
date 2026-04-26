import type { Usuario } from "../types";

export const normalizeRole = (role: string | null | undefined) =>
  (role ?? "").trim().toLowerCase();

export const isGymUser = (user: Pick<Usuario, "tipo_usuario"> | null | undefined) =>
  normalizeRole(user?.tipo_usuario) === "gimnasio";

export const canUseTrainingFeatures = (
  user: Pick<Usuario, "tipo_usuario"> | null | undefined
) => !isGymUser(user);

