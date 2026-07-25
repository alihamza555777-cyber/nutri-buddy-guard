import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { requireSupabaseAuth, optionalSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { sanitizeGeminiPayload, getGeminiApiKey } from "@/services/gemini";

const AnalyzeInputSchema = z.object({
  inputType: z.enum(["text", "image"]),
  dishInput: z.string(),
  restrictions: z.array(z.string()).default([]),
  customNotes: z.string().default(""),
  targetCalories: z.number().int().nullable().optional(),
  targetProtein: z.number().int().nullable().optional(),
});

const ScanResultSchema = z.object({
  dish_name: z.string(),
  safety_level: z.enum(["SAFE", "CAUTION", "AVOID"]),
  calories: z.number().int().nullable(),
  protein_g: z.number().nullable(),
  carbs_g: z.number().nullable(),
  fats_g: z.number().nullable(),
  fiber_g: z.number().nullable(),
  sugar_g: z.number().nullable(),
  sodium_mg: z.number().nullable(),
  flagged_ingredients: z.array(z.string()).default([]),
  explanation: z.string(),
  waiter_question: z.string(),
});

export type ScanResult = z.infer<typeof ScanResultSchema>;

export const analyzeFood = createServerFn({ method: "POST" })
  .validator((input: unknown) => AnalyzeInputSchema.parse(input))
  .handler(async ({ data }) => {
    let apiKey: string;
    try {
      apiKey = getGeminiApiKey();
    } catch {
      throw new Error("Gemini API key is missing. Please set VITE_GEMINI_API_KEY in Vercel environment settings.");
    }

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.0-flash");

    const isImage = data.inputType === "image";

    console.log("Gemini Input Payload:", {
      dishName: data.dishInput,
      dietaryRestrictions: data.restrictions,
      customNotes: data.customNotes,
      imageBase64: isImage,
    });

    const prompt = `You are NutriGuard AI, an expert food safety and nutrition parser.
Analyze the user's input food items against their specified allergies, restrictions, and health conditions.

User Dietary Profile:
- Dietary Restrictions & Allergies: ${data.restrictions.join(", ") || "None specified"}
- Custom Notes / Medical Conditions: ${data.customNotes || "None"}
- Daily targets (if any): ${data.targetCalories ?? "not set"} calories, ${data.targetProtein ?? "not set"}g protein

Food Item Input:
- Dish Name: ${isImage ? "Dish in image" : data.dishInput}
- Image Provided: ${isImage ? "Yes" : "No"}

CRITICAL INSTRUCTIONS:
1. Respond ONLY with valid, raw JSON (no markdown code block formatting or JSON wrappers).
2. JSON structure MUST match:
{
  "dish_name": "string",
  "safety_status": "SAFE" | "CAUTION" | "AVOID",
  "detected_allergens": ["string"],
  "summary": "string explaining safety status concisely based on user profile",
  "waiter_question": "string concrete question for server",
  "calories": number or null,
  "protein_g": number or null,
  "carbs_g": number or null,
  "fats_g": number or null
}`;

    const content = sanitizeGeminiPayload(data.dishInput, isImage, prompt) as any;

    try {
      const { text, output } = await generateText({
        model,
        messages: [{ role: "user", content }],
        output: Output.object({
          schema: ScanResultSchema,
        }),
      });

      console.log("Raw Gemini Response:", text || JSON.stringify(output));
      return output as ScanResult;
    } catch (error: any) {
      console.error("Gemini API Request Error:", error);
      const rawText = error?.text || error?.rawResponse || null;
      if (rawText) {
        console.log("Raw Gemini Response (Error Text):", rawText);
        const fallback = parseScanResultFallback(rawText);
        if (fallback) return fallback;
      }

      if (NoObjectGeneratedError.isInstance(error)) {
        const fallback = parseScanResultFallback(error.text);
        if (fallback) return fallback;
        throw new Error("Could not process food analysis. Please check input text or try again.");
      }

      const errString = String(error?.message || error);
      if (errString.includes("429") || errString.includes("503") || errString.includes("rate limit") || errString.includes("timeout")) {
        throw new Error("Food analysis server is busy. Please try scanning again in a few seconds.");
      }

      if (errString.includes("missing") || errString.includes("undefined")) {
        throw new Error("Gemini API key is missing. Please set VITE_GEMINI_API_KEY in Vercel environment settings.");
      }

      if (errString.includes("400") || errString.includes("Bad Request") || errString.includes("invalid")) {
        throw new Error("Could not process food analysis. Please check input text or try again.");
      }

      throw new Error(error?.message || "Could not process food analysis. Please check input text or try again.");
    }
  });

const SaveScanSchema = z.object({
  inputType: z.enum(["text", "image"]),
  imageUrl: z.string().nullable().optional(),
  result: ScanResultSchema,
});

export const saveScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SaveScanSchema.parse(input))
  .handler(async ({ data, context }) => {
    const user = context.user;
    const { error } = await context.supabase.from("scans").insert({
      user_id: user.id,
      dish_name: data.result.dish_name,
      safety_level: data.result.safety_level,
      calories: data.result.calories,
      protein_g: data.result.protein_g,
      carbs_g: data.result.carbs_g,
      fats_g: data.result.fats_g,
      fiber_g: data.result.fiber_g,
      sugar_g: data.result.sugar_g,
      sodium_mg: data.result.sodium_mg,
      flagged_ingredients: data.result.flagged_ingredients,
      explanation: data.result.explanation,
      waiter_question: data.result.waiter_question,
      image_url: data.imageUrl,
    });

    if (error) throw error;
    return { ok: true };
  });

function parseScanResultFallback(text: string | undefined): ScanResult | null {
  if (!text) return null;
  try {
    const cleaned = text.replace(/^```json\s*|\s*```$/g, "").replace(/^```\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const safety_level = parsed.safety_status || parsed.safety_level || "SAFE";
    const explanation = parsed.summary || parsed.explanation || "";
    const flagged_ingredients = parsed.detected_allergens || parsed.flagged_ingredients || [];
    const calories = parsed.nutritional_info?.calories ?? parsed.calories ?? null;
    const protein_g = parsed.nutritional_info?.protein_g ?? parsed.protein_g ?? null;
    const carbs_g = parsed.nutritional_info?.carbs_g ?? parsed.carbs_g ?? null;
    const fats_g = parsed.nutritional_info?.fats_g ?? parsed.fats_g ?? null;

    return ScanResultSchema.parse({
      dish_name: parsed.dish_name || "Food Item",
      safety_level: ["SAFE", "CAUTION", "AVOID"].includes(safety_level) ? safety_level : "SAFE",
      calories: typeof calories === "number" ? calories : null,
      protein_g: typeof protein_g === "number" ? protein_g : null,
      carbs_g: typeof carbs_g === "number" ? carbs_g : null,
      fats_g: typeof fats_g === "number" ? fats_g : null,
      fiber_g: typeof parsed.fiber_g === "number" ? parsed.fiber_g : null,
      sugar_g: typeof parsed.sugar_g === "number" ? parsed.sugar_g : null,
      sodium_mg: typeof parsed.sodium_mg === "number" ? parsed.sodium_mg : null,
      flagged_ingredients: Array.isArray(flagged_ingredients) ? flagged_ingredients : [],
      explanation: String(explanation),
      waiter_question: String(parsed.waiter_question || "Ask server to confirm ingredient safety."),
    });
  } catch (err) {
    console.error("Fallback JSON Parse Error:", err);
    return null;
  }
}

const SafeOrderInputSchema = z.object({
  dishName: z.string(),
  flaggedIngredients: z.array(z.string()).default([]),
  restrictions: z.array(z.string()).default([]),
  customNotes: z.string().default(""),
  safetyLevel: z.enum(["CAUTION", "AVOID"]),
});

const SafeOrderResultSchema = z.object({
  modifications: z.array(z.string()),
  safe_substitutions: z.array(z.string()),
  custom_server_script: z.string(),
});

export type SafeOrderResult = z.infer<typeof SafeOrderResultSchema>;

export const generateSafeOrderOptions = createServerFn({ method: "POST" })
  .validator((input: unknown) => SafeOrderInputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API Key missing. Please check VITE_GEMINI_API_KEY in your settings.");
    }

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.0-flash");

    const prompt = `You are NutriGuard's expert culinary safety assistant.
A user is ordering "${data.dishName}" which was rated ${data.safetyLevel}.
Flagged ingredients/concerns: ${data.flaggedIngredients.join(", ") || "General safety concerns"}
User dietary restrictions: ${data.restrictions.join(", ") || "None specified"}
User custom notes: ${data.customNotes || "None"}

Provide concrete, highly practical instructions for how the user can order this dish safely or customize it at a restaurant. Return a JSON object with these exact fields:
- modifications: array of 2-4 clear, step-by-step kitchen customization requests (e.g., "Ask for sauce on the side", "Specify gluten-free tamari instead of soy sauce")
- safe_substitutions: array of 2-3 safe ingredient or side substitutions (e.g., "Substitute steamed rice for egg fried rice", "Swap peanut dressing for olive oil & lemon")
- custom_server_script: a 2-3 sentence polite, direct script the user can say or read aloud to their server to ensure their dietary needs are communicated safely and clearly.`;

    try {
      const { output } = await generateText({
        model,
        messages: [{ role: "user", content: prompt }],
        output: Output.object({
          schema: SafeOrderResultSchema,
        }),
      });

      return output as SafeOrderResult;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        const fallback = parseSafeOrderFallback(error.text);
        if (fallback) return fallback;
      }
      throw error;
    }
  });

function parseSafeOrderFallback(text: string | undefined): SafeOrderResult | null {
  if (!text) return null;
  try {
    const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return SafeOrderResultSchema.parse(parsed);
  } catch {
    return null;
  }
}

export const BatchMenuItemSchema = z.object({
  dish_name: z.string(),
  safety_level: z.enum(["SAFE", "CAUTION", "AVOID"]),
  detected_allergens: z.array(z.string()).default([]),
  brief_summary: z.string(),
});

export type BatchMenuItem = z.infer<typeof BatchMenuItemSchema>;

export const BatchMenuResultSchema = z.object({
  items: z.array(BatchMenuItemSchema),
});

export type BatchMenuResult = z.infer<typeof BatchMenuResultSchema>;

const BatchMenuInputSchema = z.object({
  imageBase64: z.string(),
  restrictions: z.array(z.string()).default([]),
  customNotes: z.string().default(""),
});

export const analyzeBatchMenu = createServerFn({ method: "POST" })
  .validator((input: unknown) => BatchMenuInputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API Key missing. Please check VITE_GEMINI_API_KEY in your settings.");
    }

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.0-flash");

    const prompt = `You are NutriGuard's Instant Allergen Radar for scanning complete menu pages.
Analyze the provided menu image and extract ALL distinct dishes visible on the menu page.

User dietary restrictions: ${data.restrictions.join(", ") || "None specified"}
User custom notes: ${data.customNotes || "None"}

Return a JSON object containing an "items" array where each object has:
- dish_name: string (exact or normalized name of the dish as listed on the menu)
- safety_level: "SAFE" | "CAUTION" | "AVOID" (based on user restrictions and ingredients)
- detected_allergens: array of strings listing flagged ingredients or allergens matching user restrictions (empty array if SAFE)
- brief_summary: 1 clear sentence explaining why it is Safe, Caution, or Avoid for the user.`;

    const content = [
      { type: "text" as const, text: prompt },
      { type: "image" as const, image: data.imageBase64 },
    ];

    try {
      const { output } = await generateText({
        model,
        messages: [{ role: "user", content }],
        output: Output.object({
          schema: BatchMenuResultSchema,
        }),
      });

      return output as BatchMenuResult;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        const fallback = parseBatchMenuFallback(error.text);
        if (fallback) return fallback;
      }
      throw error;
    }
  });

function parseBatchMenuFallback(text: string | undefined): BatchMenuResult | null {
  if (!text) return null;
  try {
    const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return BatchMenuResultSchema.parse(parsed);
  } catch {
    return null;
  }
}


