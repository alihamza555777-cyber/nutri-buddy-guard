import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  analyzeFoodWithGroq,
  generateSafeOrderOptionsWithGroq,
  analyzeBatchMenuWithGroq,
  getGroqApiKey,
} from "@/services/groq";

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
  calories: z.number().nullable(),
  protein_g: z.number().nullable(),
  carbs_g: z.number().nullable(),
  fats_g: z.number().nullable(),
  fiber_g: z.number().nullable(),
  sugar_g: z.number().nullable(),
  sodium_mg: z.number().nullable(),
  flagged_ingredients: z.array(z.string()).default([]),
  explanation: z.string(),
  waiter_question: z.string(),
  server_question: z.string(),
  make_it_safe_instructions: z.array(z.string()).default([]),
  nutrition: z.object({
    calories: z.number().nullable(),
    protein_g: z.number().nullable(),
    carbs_g: z.number().nullable(),
    fats_g: z.number().nullable(),
    fiber_g: z.number().nullable(),
    sugar_g: z.number().nullable(),
    sodium_mg: z.number().nullable(),
  }),
});

export type ScanResult = z.infer<typeof ScanResultSchema>;

export const analyzeFood = createServerFn({ method: "POST" })
  .validator((input: unknown) => AnalyzeInputSchema.parse(input))
  .handler(async ({ data }) => {
    // Validate API key existence
    try {
      getGroqApiKey();
    } catch {
      throw new Error("Missing Groq API Key. Please configure VITE_GROQ_API_KEY in Vercel.");
    }

    try {
      const result = await analyzeFoodWithGroq({
        dishInput: data.dishInput,
        inputType: data.inputType,
        restrictions: data.restrictions,
        customNotes: data.customNotes,
        targetCalories: data.targetCalories,
        targetProtein: data.targetProtein,
      });

      return ScanResultSchema.parse({
        dish_name: result.dish_name,
        safety_level: result.safety_status,
        calories: result.nutrition.calories,
        protein_g: result.nutrition.protein_g,
        carbs_g: result.nutrition.carbs_g,
        fats_g: result.nutrition.fats_g,
        fiber_g: result.nutrition.fiber_g,
        sugar_g: result.nutrition.sugar_g,
        sodium_mg: result.nutrition.sodium_mg,
        flagged_ingredients: result.detected_allergens,
        explanation: result.summary,
        waiter_question: result.server_question,
        server_question: result.server_question,
        make_it_safe_instructions: result.make_it_safe_instructions,
        nutrition: result.nutrition,
      });
    } catch (error: any) {
      console.error("Groq Food Analysis Error:", error);
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
  .handler(async ({ data, context }: any) => {
    const user = context.user;
    if (!user || !context.isAuthenticated) {
      throw new Error("Unauthorized: Login required to save scan.");
    }
    const rawStatus =
      (data.result as any).safety_status ||
      data.result.safety_level ||
      (data.result as any).safetyStatus ||
      (data.result as any).status ||
      "CAUTION";
    const resolvedSafetyStatus = String(rawStatus).toUpperCase();
    const validSafetyStatus = ["SAFE", "CAUTION", "AVOID"].includes(resolvedSafetyStatus)
      ? resolvedSafetyStatus
      : "CAUTION";

    const insertPayload = {
      user_id: user.id,
      dish_name: data.result.dish_name || (data.result as any).dishName || "Unknown Dish",
      safety_level: validSafetyStatus,
      safety_status: validSafetyStatus,
      calories: data.result.calories,
      protein_g: data.result.protein_g,
      carbs_g: data.result.carbs_g,
      fats_g: data.result.fats_g,
      fiber_g: data.result.fiber_g,
      sugar_g: data.result.sugar_g,
      sodium_mg: data.result.sodium_mg,
      flagged_ingredients: data.result.flagged_ingredients || (data.result as any).flaggedIngredients || [],
      explanation: data.result.explanation || (data.result as any).summary || "",
      waiter_question: data.result.waiter_question || (data.result as any).serverQuestion || "",
      image_url: data.imageUrl,
    };

    if (!insertPayload.safety_status) {
      console.error("Missing safety_status in payload:", insertPayload);
      insertPayload.safety_status = "CAUTION";
      insertPayload.safety_level = "CAUTION";
    }

    const { error } = await context.supabase.from("scan_history").insert(insertPayload);

    if (error) throw error;
    return { ok: true };
  });

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
    try {
      getGroqApiKey();
    } catch {
      throw new Error("Missing Groq API Key. Please configure VITE_GROQ_API_KEY in Vercel.");
    }

    try {
      const result = await generateSafeOrderOptionsWithGroq({
        dishName: data.dishName,
        flaggedIngredients: data.flaggedIngredients,
        restrictions: data.restrictions,
        customNotes: data.customNotes,
        safetyLevel: data.safetyLevel,
      });

      return SafeOrderResultSchema.parse(result);
    } catch (error: any) {
      console.error("Generate Safe Order Options Error:", error);
      throw new Error(error?.message || "Failed to generate safe order options.");
    }
  });

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
    try {
      getGroqApiKey();
    } catch {
      throw new Error("Missing Groq API Key. Please configure VITE_GROQ_API_KEY in Vercel.");
    }

    try {
      const result = await analyzeBatchMenuWithGroq({
        imageBase64: data.imageBase64,
        restrictions: data.restrictions,
        customNotes: data.customNotes,
      });

      return BatchMenuResultSchema.parse(result);
    } catch (error: any) {
      console.error("Batch Menu Analysis Error:", error);
      throw new Error(error?.message || "Failed to analyze batch menu photo.");
    }
  });
