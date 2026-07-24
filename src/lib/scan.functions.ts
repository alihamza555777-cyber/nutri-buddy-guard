import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

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
    const lovableApiKey = process.env.LOVABLE_API_KEY;
    if (!lovableApiKey) {
      throw new Error("Missing LOVABLE_API_KEY");
    }

    const gateway = createLovableAiGatewayProvider(lovableApiKey);
    const model = gateway("google/gemini-3.6-flash");

    const isImage = data.inputType === "image";

    const prompt = `You are NutriGuard, a friendly AI nutrition and allergen inspector. A user wants to know if a dish is safe for them to eat.

User dietary restrictions: ${data.restrictions.join(", ") || "None specified"}
User custom notes: ${data.customNotes || "None"}
Daily targets (if any): ${data.targetCalories ?? "not set"} calories, ${data.targetProtein ?? "not set"}g protein

Analyze the ${isImage ? "menu/food photo" : "dish name"} provided and return a JSON object with these exact fields:
- dish_name: a clear, human-readable dish name
- safety_level: one of SAFE, CAUTION, or AVOID based on the user's restrictions
- calories: estimated calories as an integer, or null if unknown
- protein_g, carbs_g, fats_g, fiber_g, sugar_g, sodium_mg: estimated numeric values, or null if unknown
- flagged_ingredients: array of ingredients that triggered the restriction check (can be empty)
- explanation: 2-3 sentences explaining the safety/nutrition assessment in a friendly, helpful tone
- waiter_question: one concrete question the user can ask a server to stay safe or customize the dish

Be cautious but not alarmist. If an ingredient is commonly cross-contaminated with an allergen, flag it and explain.`;

    const content = isImage
      ? [
          { type: "text" as const, text: prompt },
          {
            type: "image" as const,
            image: data.dishInput, // base64 data URL
          },
        ]
      : [{ type: "text" as const, text: `${prompt}\n\nDish name: ${data.dishInput}` }];

    try {
      const { output } = await generateText({
        model,
        messages: [{ role: "user", content }],
        output: Output.object({
          schema: ScanResultSchema,
        }),
      });

      return output as ScanResult;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        const fallback = parseScanResultFallback(error.text);
        if (fallback) return fallback;
      }
      throw error;
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
    const { error } = await context.supabase.from("scan_history").insert({
      user_id: context.userId,
      dish_name: data.result.dish_name,
      input_type: data.inputType,
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
    const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return ScanResultSchema.parse(parsed);
  } catch {
    return null;
  }
}
