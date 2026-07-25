/**
 * Gemini AI Client Service
 * Configured for Google AI Studio API integration in NutriGuard.
 * Uses import.meta.env.VITE_GEMINI_API_KEY directly for client & server initialization.
 */

export const GEMINI_MODEL = "gemini-2.0-flash";
export const GEMINI_FALLBACK_MODEL = "gemini-1.5-flash";

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
 * Sanitizes Gemini AI content payload generation.
 * Guarantees text-only queries send a clean text prompt without empty/undefined image objects.
 */
export function sanitizeGeminiPayload(
  dishInput: string,
  isImage: boolean,
  promptText: string
): Array<{ type: "text" | "image"; text?: string; image?: string }> {
  const cleanInput = (dishInput || "").trim();
  const isValidImage = isImage && cleanInput.length > 0 && (cleanInput.startsWith("data:image/") || cleanInput.startsWith("http"));

  if (isValidImage) {
    return [
      { type: "text" as const, text: promptText },
      { type: "image" as const, image: cleanInput },
    ];
  }

  // Text-only sanitized payload
  return [
    {
      type: "text" as const,
      text: `Analyze this dish for nutritional safety, ingredients, and macros: ${cleanInput}\n\n${promptText}`,
    },
  ];
}

/**
 * Resolves the Google AI Studio API Key from import.meta.env.VITE_GEMINI_API_KEY
 */
export function getGeminiApiKey(): string | null {
  // Check client-side Vite environment variable directly
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  // Check server-side process.env fallback
  if (typeof process !== "undefined" && process.env) {
    return process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY || null;
  }
  return null;
}

/**
 * Validates if the Gemini API key is properly set
 */
export function isGeminiConfigured(): boolean {
  const key = getGeminiApiKey();
  return Boolean(key && key.trim().length > 0 && !key.includes("YOUR_ACTUAL_KEY_HERE"));
}

/**
 * Returns header authorization / key params for Gemini AI API requests
 */
export function getGeminiAuthHeaders(): Record<string, string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return {};
  return {
    "x-goog-api-key": apiKey,
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export function getGeminiModelName(): string {
  return GEMINI_MODEL;
}
