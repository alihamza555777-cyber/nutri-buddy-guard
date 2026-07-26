/**
 * AI Client Service (Refactored to Groq API)
 * Re-exports Groq AI service for OpenAI-compatible endpoint food analysis.
 */

import {
  getGroqApiKey,
  isGroqConfigured,
  GROQ_TEXT_MODEL,
  GROQ_VISION_MODEL,
  analyzeFoodWithGroq,
  cleanJsonResponseText,
  extractCleanBase64,
  type GroqFoodAnalysisResult,
  type AnalyzeFoodOptions,
} from "./groq";

export const GEMINI_MODEL = GROQ_TEXT_MODEL;
export const GEMINI_FALLBACK_MODEL = GROQ_VISION_MODEL;

export interface StandardFoodAnalysisJSON {
  dish_name: string;
  safety_status: "SAFE" | "CAUTION" | "AVOID";
  summary: string;
  server_question: string;
  make_it_safe_instructions: string[];
  nutrition: {
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fats_g: number | null;
    fiber_g: number | null;
    sugar_g: number | null;
    sodium_mg: number | null;
  };
  detected_allergens: string[];
}

/**
 * Sanitizes payload for Groq OpenAI-compatible format.
 */
export function sanitizeGeminiPayload(
  dishInput: string,
  isImage: boolean,
  promptText: string
): Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }> {
  const cleanInput = (dishInput || "").trim();
  const isValidImage = isImage && cleanInput.length > 0;

  if (isValidImage) {
    const cleanBase64 = extractCleanBase64(cleanInput);
    const imageUrl =
      cleanInput.startsWith("http://") || cleanInput.startsWith("https://")
        ? cleanInput
        : `data:image/jpeg;base64,${cleanBase64}`;
    return [
      {
        type: "text",
        text:
          promptText ||
          "Analyze this dish for dietary restrictions, allergies, safety status ('SAFE' | 'CAUTION' | 'AVOID'), macros (calories, protein, carbs, fats), and detected allergens. Return strictly valid JSON.",
      },
      { type: "image_url", image_url: { url: imageUrl } },
    ];
  }

  return [
    {
      type: "text",
      text: `Analyze dish: ${cleanInput}\n\n${promptText}`,
    },
  ];
}

/**
 * Resolves API key using Groq environment variable (VITE_GROQ_API_KEY)
 */
export function getGeminiApiKey(): string {
  return getGroqApiKey();
}

/**
 * Validates if Groq API key is configured
 */
export function isGeminiConfigured(): boolean {
  return isGroqConfigured();
}

/**
 * Returns header authorization params for Groq AI requests
 */
export function getGeminiAuthHeaders(): Record<string, string> {
  try {
    const apiKey = getGroqApiKey();
    return {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
  } catch {
    return {};
  }
}

export function getGeminiModelName(): string {
  return GROQ_TEXT_MODEL;
}

export {
  analyzeFoodWithGroq,
  cleanJsonResponseText,
  extractCleanBase64,
  getGroqApiKey,
  isGroqConfigured,
  GROQ_TEXT_MODEL,
  GROQ_VISION_MODEL,
};
export type { GroqFoodAnalysisResult, AnalyzeFoodOptions };
