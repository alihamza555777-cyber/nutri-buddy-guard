/**
 * Groq AI Client Service
 * Uses Groq's OpenAI-compatible Chat Completions endpoint.
 */

export const GROQ_TEXT_MODEL = "llama-3.3-70b-versatile";
export const GROQ_VISION_MODEL = "qwen/qwen3.6-27b";
export const GROQ_VISION_FALLBACK_MODEL = "llama-3.2-90b-vision-preview";
export const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Downscales a Base64 image data URL to a maximum width/height of 800px
 * to drastically reduce token consumption for vision LLM requests.
 */
export async function downscaleBase64Image(
  rawInput: string,
  maxWidth = 800,
  maxHeight = 800
): Promise<string> {
  if (!rawInput || typeof window === "undefined" || !window.document) {
    return rawInput;
  }

  let dataUrl = rawInput.trim();
  if (!dataUrl.startsWith("data:image/")) {
    const cleanBase64 = extractCleanBase64(dataUrl);
    if (!cleanBase64) return rawInput;
    dataUrl = `data:image/jpeg;base64,${cleanBase64}`;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let { width, height } = img;

      if (width <= maxWidth && height <= maxHeight) {
        resolve(dataUrl);
        return;
      }

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };

    img.onerror = () => {
      resolve(dataUrl);
    };

    img.src = dataUrl;
  });
}

/**
 * Helper function to execute Groq API completion with automatic fallback retry
 * for 429 Rate Limits and 400 json_validate_failed errors.
 */
async function executeGroqCompletion(
  apiKey: string,
  payload: any
): Promise<any> {
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
    console.warn(`Groq API returned HTTP ${response.status}:`, errorText);

    // 1. Handle HTTP 429 Rate Limit
    if (response.status === 429 || errorText.includes("rate_limit_exceeded") || errorText.includes("TPM") || errorText.includes("RPM")) {
      const currentModel = payload.model;
      const isVision = currentModel === GROQ_VISION_MODEL || currentModel === GROQ_VISION_FALLBACK_MODEL;
      const fallbackModel = currentModel === GROQ_VISION_MODEL ? GROQ_VISION_FALLBACK_MODEL : GROQ_VISION_MODEL;

      if (isVision && fallbackModel !== currentModel) {
        console.warn(`429 Rate Limit on ${currentModel}. Retrying vision request with fallback model ${fallbackModel}...`);
        const fallbackPayload = { ...payload, model: fallbackModel };
        const retryRes = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fallbackPayload),
        });

        if (retryRes.ok) {
          return await retryRes.json();
        }
      }

      throw new Error("AI engine is cooling down. Please wait 10 seconds and try again.");
    }

    // 2. Handle HTTP 400 json_validate_failed
    if (response.status === 400 && payload.response_format && errorText.includes("json_validate_failed")) {
      console.warn("Groq JSON validator rejected request. Retrying completion without strict response_format constraint...");
      const fallbackPayload = { ...payload };
      delete fallbackPayload.response_format;

      const retryResponse = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fallbackPayload),
      });

      if (!retryResponse.ok) {
        const retryErrorText = await retryResponse.text();
        if (retryResponse.status === 429 || retryErrorText.includes("rate_limit_exceeded")) {
          throw new Error("AI engine is cooling down. Please wait 10 seconds and try again.");
        }
        throw new Error(`Groq API request failed (${retryResponse.status}): ${cleanGroqErrorMessage(retryErrorText)}`);
      }
      return await retryResponse.json();
    }

    throw new Error(`Groq API request failed (${response.status}): ${cleanGroqErrorMessage(errorText)}`);
  }

  return await response.json();
}

function cleanGroqErrorMessage(rawText: string): string {
  try {
    const parsed = JSON.parse(rawText);
    if (parsed?.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // ignore
  }
  return rawText ? rawText.slice(0, 300) : "Unknown AI error.";
}

export interface GroqFoodAnalysisResult {
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
 * Robust helper function to sanitize and parse AI JSON responses,
 * stripping <think>...</think> reasoning blocks and markdown code fences with fallback extraction.
 */
export function parseAIJsonResponse(rawText: string): any {
  if (!rawText) throw new Error("Empty response received from AI model.");

  let cleaned = rawText
    // Remove <think>...</think> reasoning blocks injected by models
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    // Remove unclosed <think> reasoning blocks if model output was truncated
    .replace(/<think>[\s\S]*$/gi, "")
    // Remove markdown code blocks like ```json ... ```
    .replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, "$1")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Fallback 1: try to extract substring between first '{' and last '}'
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonSubstr = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(jsonSubstr);
      } catch (e) {
        // fallback failed
      }
    }

    // Fallback 2: try to extract substring between first '[' and last ']'
    const firstSquare = cleaned.indexOf("[");
    const lastSquare = cleaned.lastIndexOf("]");
    if (firstSquare !== -1 && lastSquare !== -1 && lastSquare > firstSquare) {
      const jsonSubstr = cleaned.substring(firstSquare, lastSquare + 1);
      try {
        return JSON.parse(jsonSubstr);
      } catch (e) {
        // fallback failed
      }
    }

    console.error("Unrecoverable malformed AI response:", rawText);
    throw new Error("The AI returned a malformed response. Please try scanning again.");
  }
}

/**
 * Cleans markdown formatting backticks (```json ... ```), <think>...</think> reasoning tags,
 * and conversational text before JSON.parse()
 */
export function cleanJsonResponseText(rawText: string): string {
  if (!rawText) return "";
  let cleaned = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/gi, "")
    .replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, "$1")
    .replace(/```/g, "")
    .trim();

  const firstCurly = cleaned.indexOf("{");
  const lastCurly = cleaned.lastIndexOf("}");
  if (firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly) {
    cleaned = cleaned.substring(firstCurly, lastCurly + 1);
  } else {
    const firstSquare = cleaned.indexOf("[");
    const lastSquare = cleaned.lastIndexOf("]");
    if (firstSquare !== -1 && lastSquare !== -1 && lastSquare > firstSquare) {
      cleaned = cleaned.substring(firstSquare, lastSquare + 1);
    }
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
 * Ensures valid image URL formatting preserving PNG/JPEG/WebP MIME headers
 */
export function formatGroqImageUrl(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:image/")) {
    return trimmed;
  }
  const clean = extractCleanBase64(trimmed);
  return `data:image/jpeg;base64,${clean}`;
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

  // Enforce qwen/qwen3.6-27b for image inputs
  const model = isImage ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL;

  const dishName = isImage ? "Scanned Food Dish" : rawInput || "Food Item";
  const userRestrictions = options.restrictions || [];
  const userNotes = options.customNotes || "None";

  let messages: any[];

  if (isImage) {
    const downscaledImage = await downscaleBase64Image(rawInput, 800, 800);
    const imageUrl = formatGroqImageUrl(downscaledImage);

    const systemPrompt = `You are NutriGuard's specialized clinical nutritionist and dietary vision AI.
Inspect the food image provided in this request carefully.

User Dietary Restrictions & Allergies: [${userRestrictions.join(", ")}]
Custom Medical Notes & Conditions: [${userNotes}]

### Instructions:
1. Identify the primary dish and key visible ingredients in the picture.
2. Cross-reference the dish's typical preparation and ingredients against the user's explicit restrictions and notes.
3. Determine safety status strictly relative to user inputs:
   - "SAFE": Dish presents no clear match or high cross-contamination risk with user allergies.
   - "CAUTION": Dish contains or likely contacts a user restriction, or has common cross-contamination risks.
   - "AVOID": Dish directly contains a flagged restriction/allergen.
4. ONLY populate 'flagged_ingredients' if a detected ingredient explicitly violates one of the user's provided restrictions/notes. If the user provided NO restrictions, 'flagged_ingredients' MUST BE AN EMPTY ARRAY [].
5. Provide standard non-zero nutritional estimations for the portion shown in the picture.

You MUST respond strictly in valid, raw JSON (no markdown backticks, no markdown formatting, no conversational text before or after).

### Required JSON Schema:
{
  "dish_name": "${dishName}",
  "safety_status": "SAFE",
  "summary": "Detailed visual and safety assessment explaining ingredients seen and cross-contamination risks.",
  "server_question": "One concise, critical question the user should ask their server before eating/ordering this.",
  "make_it_safe_instructions": [
    "Clear, actionable instruction for preparation modification or server inquiry."
  ],
  "nutrition": {
    "calories": 450,
    "protein_g": 25,
    "carbs_g": 35,
    "fats_g": 18,
    "fiber_g": 5,
    "sugar_g": 4,
    "sodium_mg": 520
  },
  "flagged_ingredients": [],
  "detected_allergens": []
}`;

    const visionUserPrompt = `You are NutriGuard's specialized clinical nutritionist AI. Inspect the provided food image.
User Restrictions: [${userRestrictions.join(", ")}]
User Custom Notes: [${userNotes}]

Evaluate dish safety and nutrition. Respond STRICTLY in plain, raw JSON format matching:
{
  "dish_name": "${dishName}",
  "safety_status": "SAFE",
  "summary": "Visual inspection summary",
  "server_question": "Question for server",
  "make_it_safe_instructions": ["Modification instruction"],
  "nutrition": {
    "calories": 450,
    "protein_g": 25,
    "carbs_g": 35,
    "fats_g": 18,
    "fiber_g": 5,
    "sugar_g": 4,
    "sodium_mg": 520
  },
  "flagged_ingredients": [],
  "detected_allergens": []
}

Rules:
- 'flagged_ingredients' MUST be empty [] if userRestrictions and userNotes are empty.
- All nutrition values must be estimated non-zero numbers.`;

    messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: visionUserPrompt,
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
    const systemPrompt = `You are NutriGuard's specialized clinical nutritionist and dietary safety AI.
Analyze the requested food dish: '${dishName}'.
User Dietary Restrictions & Allergies: [${userRestrictions.join(", ")}]
Custom Notes/Medical Conditions: [${userNotes}]

IMPORTANT ALLERGEN FLAGGING RULES:
- ONLY flag an ingredient in 'detected_allergens' if it directly violates one of the user's explicitly provided restrictions or custom allergy notes.
- If the user has provided NO dietary restrictions (userRestrictions is empty) and NO custom notes, 'detected_allergens' MUST BE AN EMPTY ARRAY [] regardless of what standard allergens are present in the dish.

You MUST evaluate the dish and respond STRICTLY in valid JSON format matching this schema:
{
  "dish_name": "${dishName}",
  "safety_status": "SAFE",
  "summary": "Inspection summary explaining safety or cross-contamination risks.",
  "server_question": "One concise, critical question the user should ask their server before ordering.",
  "make_it_safe_instructions": ["Step 1..."],
  "nutrition": {
    "calories": 450,
    "protein_g": 25,
    "carbs_g": 35,
    "fats_g": 18,
    "fiber_g": 5,
    "sugar_g": 4,
    "sodium_mg": 520
  },
  "detected_allergens": []
}`;

    messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Analyze the food dish '${dishName}' according to the system prompt guidelines and respond in valid JSON.`,
      },
    ];
  }

  const payload = {
    model,
    messages,
    temperature: 0.2,
    response_format: { type: "json_object" },
  };

  try {
    const resData = await executeGroqCompletion(apiKey, payload);
    const rawContent = resData?.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error("No response content generated by Groq AI.");
    }

    const parsed = parseAIJsonResponse(rawContent);

    const safety_status: "SAFE" | "CAUTION" | "AVOID" = ["SAFE", "CAUTION", "AVOID"].includes(
      parsed.safety_status || parsed.safety_level
    )
      ? (parsed.safety_status || parsed.safety_level)
      : "SAFE";

    const detected_allergens = Array.isArray(parsed.detected_allergens) && parsed.detected_allergens.length > 0
      ? parsed.detected_allergens
      : Array.isArray(parsed.flagged_ingredients)
      ? parsed.flagged_ingredients
      : [];

    const make_it_safe_instructions = Array.isArray(parsed.make_it_safe_instructions)
      ? parsed.make_it_safe_instructions.map(String)
      : [];

    const n = parsed.nutrition || {};

    return {
      dish_name: parsed.dish_name || dishName,
      safety_status,
      summary: parsed.summary || parsed.explanation || "Analysis complete.",
      server_question: parsed.server_question || parsed.waiter_question || "Ask your server to verify ingredients.",
      make_it_safe_instructions,
      nutrition: {
        calories: typeof n.calories === "number" ? n.calories : (typeof parsed.calories === "number" ? parsed.calories : 350),
        protein_g: typeof n.protein_g === "number" ? n.protein_g : (typeof parsed.protein_g === "number" ? parsed.protein_g : 15),
        carbs_g: typeof n.carbs_g === "number" ? n.carbs_g : (typeof parsed.carbs_g === "number" ? parsed.carbs_g : 30),
        fats_g: typeof n.fats_g === "number" ? n.fats_g : (typeof parsed.fats_g === "number" ? parsed.fats_g : 12),
        fiber_g: typeof n.fiber_g === "number" ? n.fiber_g : (typeof parsed.fiber_g === "number" ? parsed.fiber_g : 4),
        sugar_g: typeof n.sugar_g === "number" ? n.sugar_g : (typeof parsed.sugar_g === "number" ? parsed.sugar_g : 5),
        sodium_mg: typeof n.sodium_mg === "number" ? n.sodium_mg : (typeof parsed.sodium_mg === "number" ? parsed.sodium_mg : 450),
      },
      detected_allergens,
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
    const resData = await executeGroqCompletion(apiKey, {
      model: GROQ_TEXT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: promptText.trim() },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const rawContent = resData?.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("Empty response from Groq AI service.");

    const parsed = parseAIJsonResponse(rawContent);

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
  const downscaledImage = await downscaleBase64Image(rawImage, 800, 800);
  const imageUrl = formatGroqImageUrl(downscaledImage);

  const systemPrompt = `You are NutriGuard's specialized clinical nutritionist and Instant Menu Allergen Radar AI.
Your sole job is to inspect restaurant menu photo images and extract every visible dish into structured JSON.

CRITICAL OUTPUT REQUIREMENTS:
- Output ONLY valid JSON matching the exact target schema.
- Do NOT output any reasoning steps, explanation text, preamble, or <think> tags.
- Output MUST begin directly with '{' and end with '}'.

Target JSON Schema:
{
  "items": [
    {
      "dish_name": "Name of Dish",
      "safety_level": "SAFE" | "CAUTION" | "AVOID",
      "detected_allergens": ["Allergen 1", "Allergen 2"],
      "brief_summary": "One concise sentence explaining safety or allergen risks."
    }
  ]
}`;

  const promptText = `
Analyze the attached restaurant menu image and extract ALL distinct menu items/dishes visible.

User Dietary Restrictions & Allergies: [${options.restrictions.join(", ") || "None specified"}]
User Custom Medical Notes: [${options.customNotes || "None"}]

For each dish detected on the menu:
1. Extract the exact dish title.
2. Cross-reference its typical ingredients and preparation against the user's restrictions and custom notes.
3. Assign "safety_level":
   - "SAFE": No allergen or restriction match.
   - "CAUTION": High cross-contamination risk or questionable preparation.
   - "AVOID": Contains a direct restriction/allergen match.
4. List any detected_allergens that conflict with the user's settings.
5. Provide a 1-sentence brief_summary.

Respond strictly in valid JSON matching the schema.
`;

  try {
    const resData = await executeGroqCompletion(apiKey, {
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
    });

    const rawContent = resData?.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("Empty response from Groq AI service.");

    const parsed = parseAIJsonResponse(rawContent);

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
