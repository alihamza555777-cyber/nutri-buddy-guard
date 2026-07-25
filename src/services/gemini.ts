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
  type GroqFoodAnalysisResult,
  type AnalyzeFoodOptions,
} from "./groq";

export const GEMINI_MODEL = GROQ_TEXT_MODEL;
export const GEMINI_FALLBACK_MODEL = GROQ_VISION_MODEL;

export interface StandardFoodAnalysisJSON {
  dish_name: string;
  safety_status: "SAFE" | "CAUTION" | "AVOID";
  detected_allergens: string[];
  summary: string;
  waiter_question: string;
  calories: number | null;
  macros: {
    protein_g: number | null;
    carbs_g: number | null;
    fats_g: number | null;
    fiber_g: number | null;
    sugar_g: number | null;
    sodium_mg: number | null;
  };
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
    let imageUrl = cleanInput;
    if (!imageUrl.startsWith("data:image/") && !imageUrl.startsWith("http")) {
      imageUrl = `data:image/jpeg;base64,${imageUrl}`;
    }
    return [
      { type: "text", text: promptText },
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
  getGroqApiKey,
  isGroqConfigured,
  GROQ_TEXT_MODEL,
  GROQ_VISION_MODEL,
};
export type { GroqFoodAnalysisResult, AnalyzeFoodOptions };
