import { getGeminiModel, isGeminiConfigured } from "./gemini.service";

export type GenerateRoutineDraftInput = {
  usuarioId: number;
  prompt: string;
  objetivo?: string;
  diasPorSemana?: number;
};

export type RoutineGenerationDraftResponse = {
  status: "draft";
  proveedor: "gemini";
  usuario_id: number;
  prompt: string;
  objetivo: string | null;
  dias_por_semana: number | null;
  gemini_configurado: boolean;
  modelo_sugerido: string;
  siguiente_paso: string;
};

export const generateRoutineDraftFromPrompt = async (
  input: GenerateRoutineDraftInput
): Promise<RoutineGenerationDraftResponse> => {
  const geminiConfigured = isGeminiConfigured();

  return {
    status: "draft",
    proveedor: "gemini",
    usuario_id: input.usuarioId,
    prompt: input.prompt,
    objetivo: input.objetivo ?? null,
    dias_por_semana: input.diasPorSemana ?? null,
    gemini_configurado: geminiConfigured,
    modelo_sugerido: getGeminiModel(),
    siguiente_paso:
      "Etapa 4: construir el prompt con perfil del usuario y datos internos de GymMaxxing.",
  };
};
