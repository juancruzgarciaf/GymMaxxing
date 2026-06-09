import { GoogleGenAI } from "@google/genai";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export type GeminiConfig = {
  apiKey: string;
  model: string;
};

let geminiClient: GoogleGenAI | null = null;

const readOptionalEnv = (key: string) => {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

export const isGeminiConfigured = () => Boolean(readOptionalEnv("GEMINI_API_KEY"));

export const getGeminiConfig = (): GeminiConfig => {
  const apiKey = readOptionalEnv("GEMINI_API_KEY");

  if (!apiKey) {
    throw new Error("Falta configurar GEMINI_API_KEY en backend/.env");
  }

  return {
    apiKey,
    model: readOptionalEnv("GEMINI_MODEL") ?? DEFAULT_GEMINI_MODEL,
  };
};

export const getGeminiClient = () => {
  if (geminiClient) {
    return geminiClient;
  }

  const { apiKey } = getGeminiConfig();
  geminiClient = new GoogleGenAI({ apiKey });
  return geminiClient;
};

export const getGeminiModel = () => getGeminiConfig().model;

export const resetGeminiClient = () => {
  geminiClient = null;
};
