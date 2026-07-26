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
  .handler(async ({ context }) => {
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
  .handler(async ({ context }) => {
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { data: scans, error: scansError } = await context.supabase
      .from("scan_history")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", todayISO);

    if (scansError) {
      console.warn("Could not fetch today nutrition summary scans:", scansError.message);
    }

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("target_calories, target_protein")
      .eq("id", userId)
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

export const deleteScanRecord = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator((input: unknown) => ({ scanId: String((input as any)?.scanId || "") }))
  .handler(async ({ data, context }) => {
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
  .handler(async ({ context }) => {
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
