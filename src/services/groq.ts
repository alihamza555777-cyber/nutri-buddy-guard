/**
 * Groq AI Client Service
 * Uses Groq's OpenAI-compatible Chat Completions endpoint.
 */

export const GROQ_TEXT_MODEL = "llama-3.3-70b-versatile";
export const GROQ_VISION_MODEL = "qwen/qwen3.6-27b";
export const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface GroqFoodAnalysisResult {
  dish_name: string;
  safety_status: "SAFE" | "CAUTION" | "AVOID";
  summary: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fats_g: number | null;
  detected_allergens: string[];
  waiter_question: string;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
}

export interface AnalyzeFoodOptions {
  dishInput: string;
  inputType: "text" | "image";
  restrictions?: string[];
  customNotes?: string;
  targetCalories?: number | null;
  targetProtein?: number | null;
}

export interface SafeOrderResult {
  modifications: string[];
  safe_substitutions: string[];
  custom_server_script: string;
}

export interface BatchMenuItem {
  dish_name: string;
  safety_level: "SAFE" | "CAUTION" | "AVOID";
  detected_allergens: string[];
  brief_summary: string;
}

export interface BatchMenuResult {
  items: BatchMenuItem[];
}

/**
 * Validates and retrieves the Groq API key.
 * 
 * Resolution order:
 * 1. import.meta.env.VITE_GROQ_API_KEY — primary: Lovable's Vite config
 *    performs build-time VITE_* env injection, so this is baked into the
 *    bundle at build time and works in both client and Nitro/Cloudflare
 *    server contexts.
 * 2. process.env fallbacks — for local dev / Node SSR environments where
 *    process.env is available.
 * 3. globalThis.__env — some Nitro presets attach env here.
 */
export function getGroqApiKey(): string {
  let key = "";

  // 1. Build-time injected VITE_* (works everywhere in this project)
  try {
    key = (import.meta as any).env?.VITE_GROQ_API_KEY ?? "";
  } catch {
    // import.meta not available in this context
  }

  // 2. process.env fallbacks (Node / local dev)
  if (!key) {
    try {
      key =
        (typeof process !== "undefined" && process.env?.VITE_GROQ_API_KEY) ||
        (typeof process !== "undefined" && process.env?.GROQ_API_KEY) ||
        "";
    } catch {
      // process not available
    }
  }

  // 3. globalThis.__env (some Nitro runtimes)
  if (!key) {
    try {
      const gEnv = (globalThis as any).__env;
      key = gEnv?.VITE_GROQ_API_KEY || gEnv?.GROQ_API_KEY || "";
    } catch {
      // not available
    }
  }

  if (!key || !key.trim()) {
    throw new Error(
      "Missing Groq API Key. Please configure VITE_GROQ_API_KEY in Vercel environment settings (ensure it is enabled for Production, Preview, and Development)."
    );
  }

  return key.trim();
}


/**
 * Checks if the Groq API key is properly configured.
 */
export function isGroqConfigured(): boolean {
  try {
    const key = getGroqApiKey();
    return Boolean(key && key.trim().length > 0);
  } catch {
    return false;
  }
}

/**
 * Cleans markdown formatting backticks (```json ... ```) before JSON.parse()
 */
export function cleanJsonResponseText(rawText: string): string {
  if (!rawText) return "";
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return cleaned.trim();
}

/**
 * Helper to extract clean raw base64 string from input (stripping data:image prefix if present)
 */
export function extractCleanBase64(input: string): string {
  if (!input) return "";
  let clean = input.trim();
  if (clean.includes("base64,")) {
    clean = clean.split("base64,")[1] || clean;
  }
  return clean.trim();
}

/**
 * Analyzes food item using Groq's OpenAI-compatible chat completions endpoint.
 * Uses qwen/qwen3.6-27b for vision (camera image scans) and llama-3.3-70b-versatile for text-only dish searches.
 */
export async function analyzeFoodWithGroq(
  options: AnalyzeFoodOptions
): Promise<GroqFoodAnalysisResult> {
  const apiKey = getGroqApiKey();

  const rawInput = (options.dishInput || "").trim();
  const isImage =
    options.inputType === "image" ||
    rawInput.startsWith("data:image/") ||
    rawInput.startsWith("http://") ||
    rawInput.startsWith("https://") ||
    (rawInput.length > 100 && !rawInput.includes(" "));

  const model = isImage ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL;

  const systemPrompt =
    "You are a nutritional AI. Respond strictly in valid JSON format containing safety_status ('SAFE'|'CAUTION'|'AVOID'), summary, calories, protein_g, carbs_g, fats_g, detected_allergens.";

  let messages: any[];

  if (isImage) {
    const cleanBase64 = extractCleanBase64(rawInput);
    const imageUrl =
      rawInput.startsWith("http://") || rawInput.startsWith("https://")
        ? rawInput
        : `data:image/jpeg;base64,${cleanBase64}`;

    const textPrompt =
      options.restrictions?.length || options.customNotes
        ? `User Dietary Profile:
- Dietary Restrictions & Allergies: ${(options.restrictions || []).join(", ") || "None specified"}
- Custom Notes / Medical Conditions: ${options.customNotes || "None"}
${options.targetCalories ? `- Target Daily Calories: ${options.targetCalories}` : ""}
${options.targetProtein ? `- Target Daily Protein: ${options.targetProtein}g` : ""}

Analyze this dish for dietary restrictions, allergies, safety status ('SAFE' | 'CAUTION' | 'AVOID'), macros (calories, protein, carbs, fats), and detected allergens. Return strictly valid JSON.`
        : "Analyze this dish for dietary restrictions, allergies, safety status ('SAFE' | 'CAUTION' | 'AVOID'), macros (calories, protein, carbs, fats), and detected allergens. Return strictly valid JSON.";

    messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: textPrompt,
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
            },
          },
        ],
      },
    ];
  } else {
    const userInstruction = `
User Dietary Profile:
- Dietary Restrictions & Allergies: ${(options.restrictions || []).join(", ") || "None specified"}
- Custom Notes / Medical Conditions: ${options.customNotes || "None"}
${options.targetCalories ? `- Target Daily Calories: ${options.targetCalories}` : ""}
${options.targetProtein ? `- Target Daily Protein: ${options.targetProtein}g` : ""}

Food Input:
- Input Type: Dish Name Typed
- Dish / Input Details: ${rawInput}

Return a valid JSON object matching this schema:
{
  "dish_name": "string",
  "safety_status": "SAFE" | "CAUTION" | "AVOID",
  "summary": "string explaining nutritional safety and key points concisely",
  "waiter_question": "string concrete question for server",
  "calories": number or null,
  "protein_g": number or null,
  "carbs_g": number or null,
  "fats_g": number or null,
  "detected_allergens": ["string"]
}
`;

    messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userInstruction.trim() },
    ];
  }

  const payload = {
    model,
    messages,
    temperature: 0.2,
    response_format: { type: "json_object" },
  };

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API Error Response:", response.status, errorText);
      throw new Error(`Groq API request failed (${response.status}): ${errorText}`);
    }

    const resData = await response.json();
    const rawContent = resData?.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error("No response content generated by Groq AI.");
    }

    const cleanedText = cleanJsonResponseText(rawContent);
    const parsed = JSON.parse(cleanedText);

    const safety_status: "SAFE" | "CAUTION" | "AVOID" = ["SAFE", "CAUTION", "AVOID"].includes(
      parsed.safety_status || parsed.safety_level
    )
      ? (parsed.safety_status || parsed.safety_level)
      : "SAFE";

    const detected_allergens = Array.isArray(parsed.detected_allergens)
      ? parsed.detected_allergens
      : Array.isArray(parsed.flagged_ingredients)
      ? parsed.flagged_ingredients
      : [];

    return {
      dish_name: parsed.dish_name || (isImage ? "Scanned Food Item" : options.dishInput || "Food Item"),
      safety_status,
      summary: parsed.summary || parsed.explanation || "Analysis complete.",
      waiter_question: parsed.waiter_question || "Ask your server to verify ingredients.",
      calories: typeof parsed.calories === "number" ? parsed.calories : null,
      protein_g: typeof parsed.protein_g === "number" ? parsed.protein_g : null,
      carbs_g: typeof parsed.carbs_g === "number" ? parsed.carbs_g : null,
      fats_g: typeof parsed.fats_g === "number" ? parsed.fats_g : null,
      detected_allergens,
      fiber_g: typeof parsed.fiber_g === "number" ? parsed.fiber_g : null,
      sugar_g: typeof parsed.sugar_g === "number" ? parsed.sugar_g : null,
      sodium_mg: typeof parsed.sodium_mg === "number" ? parsed.sodium_mg : null,
    };
  } catch (error: any) {
    console.error("Groq AI Analysis Error:", error);
    throw new Error(
      error?.message || "Food analysis failed due to network or parsing issue. Please try again."
    );
  }
}

/**
 * Generates Safe Order customization instructions using Groq text model.
 */
export async function generateSafeOrderOptionsWithGroq(options: {
  dishName: string;
  flaggedIngredients: string[];
  restrictions: string[];
  customNotes: string;
  safetyLevel: "CAUTION" | "AVOID";
}): Promise<SafeOrderResult> {
  const apiKey = getGroqApiKey();

  const systemPrompt = "You are a nutritional AI. Respond strictly in valid JSON format.";
  const promptText = `
You are NutriGuard's expert culinary safety assistant.
A user is ordering "${options.dishName}" which was rated ${options.safetyLevel}.
Flagged ingredients: ${options.flaggedIngredients.join(", ") || "General safety concerns"}
User dietary restrictions: ${options.restrictions.join(", ") || "None specified"}
User custom notes: ${options.customNotes || "None"}

Provide concrete, highly practical instructions for ordering safely. Return JSON object with:
{
  "modifications": ["array of 2-4 clear kitchen requests"],
  "safe_substitutions": ["array of 2-3 safe ingredient swaps"],
  "custom_server_script": "polite 2-3 sentence script to say to server"
}
`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_TEXT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: promptText.trim() },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API request failed with status ${response.status}`);
    }

    const resData = await response.json();
    const rawContent = resData?.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("Empty response from Groq AI service.");

    const cleaned = cleanJsonResponseText(rawContent);
    const parsed = JSON.parse(cleaned);

    return {
      modifications: Array.isArray(parsed.modifications) ? parsed.modifications : [],
      safe_substitutions: Array.isArray(parsed.safe_substitutions) ? parsed.safe_substitutions : [],
      custom_server_script: String(parsed.custom_server_script || "Please ask your server for ingredient verification."),
    };
  } catch (err: any) {
    console.error("Error in generateSafeOrderOptionsWithGroq:", err);
    throw new Error(err?.message || "Failed to generate safe order options.");
  }
}

/**
 * Analyzes full menu page photo in batch using Groq vision model.
 */
export async function analyzeBatchMenuWithGroq(options: {
  imageBase64: string;
  restrictions: string[];
  customNotes: string;
}): Promise<BatchMenuResult> {
  const apiKey = getGroqApiKey();

  const rawImage = options.imageBase64.trim();
  const cleanBase64 = extractCleanBase64(rawImage);
  const imageUrl =
    rawImage.startsWith("http://") || rawImage.startsWith("https://")
      ? rawImage
      : `data:image/jpeg;base64,${cleanBase64}`;

  const systemPrompt = "You are a nutritional AI. Respond strictly in valid JSON format.";
  const promptText = `
You are NutriGuard's Instant Allergen Radar.
Analyze the provided menu image and extract ALL distinct dishes visible on the menu page.

User dietary restrictions: ${options.restrictions.join(", ") || "None specified"}
User custom notes: ${options.customNotes || "None"}

Return a JSON object containing an "items" array where each object has:
- dish_name: string
- safety_level: "SAFE" | "CAUTION" | "AVOID"
- detected_allergens: array of strings
- brief_summary: 1 sentence summary
`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: promptText.trim() },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API request failed with status ${response.status}`);
    }

    const resData = await response.json();
    const rawContent = resData?.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("Empty response from Groq AI service.");

    const cleaned = cleanJsonResponseText(rawContent);
    const parsed = JSON.parse(cleaned);

    const items = Array.isArray(parsed.items)
      ? parsed.items.map((item: any) => ({
          dish_name: String(item.dish_name || "Menu Item"),
          safety_level: ["SAFE", "CAUTION", "AVOID"].includes(item.safety_level) ? item.safety_level : "SAFE",
          detected_allergens: Array.isArray(item.detected_allergens) ? item.detected_allergens : [],
          brief_summary: String(item.brief_summary || "Processed item from menu."),
        }))
      : [];

    return { items };
  } catch (err: any) {
    console.error("Error in analyzeBatchMenuWithGroq:", err);
    throw new Error(err?.message || "Failed to analyze batch menu photo.");
  }
}
