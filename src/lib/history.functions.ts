import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("scan_history")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  });

export const getTodayNutritionSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { data: scans, error: scansError } = await context.supabase
      .from("scan_history")
      .select("*")
      .eq("user_id", context.userId)
      .gte("created_at", todayISO);

    if (scansError) throw scansError;

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("target_calories, target_protein")
      .eq("id", context.userId)
      .maybeSingle();

    const summary: TodayNutritionSummary = {
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
      totalScans: scans?.length ?? 0,
      targetCalories: profile?.target_calories ?? null,
      targetProtein: profile?.target_protein ?? null,
    };

    for (const scan of scans ?? []) {
      summary.totalCalories += scan.calories ?? 0;
      summary.totalProtein += scan.protein_g ?? 0;
      summary.totalCarbs += scan.carbs_g ?? 0;
      summary.totalFats += scan.fats_g ?? 0;
      summary.totalFiber += scan.fiber_g ?? 0;
      summary.totalSugar += scan.sugar_g ?? 0;
      summary.totalSodium += scan.sodium_mg ?? 0;

      if (scan.safety_level === "SAFE") summary.safeCount++;
      else if (scan.safety_level === "CAUTION") summary.cautionCount++;
      else if (scan.safety_level === "AVOID") summary.avoidCount++;
    }

    return summary;
  });
