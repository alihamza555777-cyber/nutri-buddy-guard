import { createServerFn } from "@tanstack/react-start";
import { optionalSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface TodayNutritionSummary {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
  totalFiber: number;
  totalSugar: number;
  totalSodium: number;
  safeCount: number;
  cautionCount: number;
  avoidCount: number;
  totalScans: number;
  targetCalories: number | null;
  targetProtein: number | null;
}

export const getScanHistory = createServerFn({ method: "GET" })
  .middleware([optionalSupabaseAuth])
  .handler(async ({ context }: any) => {
    const userId = context.userId || context.user?.id;
    if (!userId || !context.isAuthenticated) {
      return [];
    }

    const { data, error } = await context.supabase
      .from("scan_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Could not fetch scan history:", error.message);
      return [];
    }
    return data ?? [];
  });

export const getTodayNutritionSummary = createServerFn({ method: "GET" })
  .middleware([optionalSupabaseAuth])
  .handler(async ({ context }: any) => {
    const userId = context.userId || context.user?.id;
    if (!userId || !context.isAuthenticated) {
      return {
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFats: 0,
        totalFiber: 0,
        totalSugar: 0,
        totalSodium: 0,
        safeCount: 0,
        cautionCount: 0,
        avoidCount: 0,
        totalScans: 0,
        targetCalories: null,
        targetProtein: null,
      };
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data: scans, error: scansError } = await context.supabase
      .from("scan_history")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", startOfDay.toISOString());

    if (scansError) {
      console.warn("Could not fetch today's nutrition summary:", scansError.message);
    }

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("target_calories, target_protein")
      .eq("id", userId)
      .maybeSingle();

    const scanList = scans ?? [];

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFats = 0;
    let totalFiber = 0;
    let totalSugar = 0;
    let totalSodium = 0;
    let safeCount = 0;
    let cautionCount = 0;
    let avoidCount = 0;

    for (const item of scanList) {
      if (typeof item.calories === "number") totalCalories += item.calories;
      if (typeof item.protein_g === "number") totalProtein += item.protein_g;
      if (typeof item.carbs_g === "number") totalCarbs += item.carbs_g;
      if (typeof item.fats_g === "number") totalFats += item.fats_g;
      if (typeof item.fiber_g === "number") totalFiber += item.fiber_g;
      if (typeof item.sugar_g === "number") totalSugar += item.sugar_g;
      if (typeof item.sodium_mg === "number") totalSodium += item.sodium_mg;

      const level = (item.safety_level || "").toUpperCase();
      if (level === "SAFE") safeCount++;
      else if (level === "AVOID") avoidCount++;
      else cautionCount++;
    }

    return {
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFats,
      totalFiber,
      totalSugar,
      totalSodium,
      safeCount,
      cautionCount,
      avoidCount,
      totalScans: scanList.length,
      targetCalories: profile?.target_calories ?? null,
      targetProtein: profile?.target_protein ?? null,
    };
  });

export const deleteScanRecord = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator((input: unknown) => ({ scanId: String((input as any)?.scanId || "") }))
  .handler(async ({ data, context }: any) => {
    const userId = context.userId || context.user?.id;
    if (!userId || !context.isAuthenticated) {
      throw new Error("Unauthorized: Login required to delete scan.");
    }
    const { error } = await context.supabase
      .from("scan_history")
      .delete()
      .eq("id", data.scanId)
      .eq("user_id", userId);

    if (error) throw error;
    return { ok: true };
  });

export const clearAllScanRecords = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .handler(async ({ context }: any) => {
    const userId = context.userId || context.user?.id;
    if (!userId || !context.isAuthenticated) {
      throw new Error("Unauthorized: Login required to clear scan history.");
    }
    const { error } = await context.supabase
      .from("scan_history")
      .delete()
      .eq("user_id", userId);

    if (error) throw error;
    return { ok: true };
  });
