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
        calories: result.calories,
        protein_g: result.protein_g,
        carbs_g: result.carbs_g,
        fats_g: result.fats_g,
        fiber_g: result.fiber_g ?? null,
        sugar_g: result.sugar_g ?? null,
        sodium_mg: result.sodium_mg ?? null,
        flagged_ingredients: result.detected_allergens,
        explanation: result.summary,
        waiter_question: result.waiter_question,
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
  .handler(async ({ data, context }) => {
    const user = context.user;
    const { error } = await context.supabase.from("scan_history").insert({
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
