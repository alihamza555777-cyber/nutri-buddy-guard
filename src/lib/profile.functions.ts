import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { optionalSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProfileUpdateSchema = z.object({
  fullName: z.string().trim().max(50).nullable().optional(),
  age: z.number().int().min(1).max(120).nullable().optional(),
  weightKg: z.number().positive().max(500).nullable().optional(),
  heightCm: z.number().positive().max(300).nullable().optional(),
  dietaryFlags: z.array(z.string()).default([]),
  targetCalories: z.number().int().nonnegative().nullable().optional(),
  targetProtein: z.number().int().nonnegative().nullable().optional(),
  customNotes: z.string().nullable().optional(),
  notifyEmail: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
  notifyScanAlerts: z.boolean().optional(),
  notifyWeeklySummary: z.boolean().optional(),
  savedBrands: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
});

export const getProfile = createServerFn({ method: "GET" })
  .middleware([optionalSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId || context.user?.id;
    if (!userId || !context.isAuthenticated) {
      return null;
    }

    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.warn("Could not fetch profile:", error.message);
      return null;
    }

    return data ?? null;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator((input: unknown) => ProfileUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const userId = context.userId || context.user?.id;
    if (!userId || !context.isAuthenticated) {
      throw new Error("Please sign in to update your profile.");
    }

    const update = {
      ...(data.fullName !== undefined && { full_name: data.fullName }),
      ...(data.age !== undefined && { age: data.age }),
      ...(data.weightKg !== undefined && { weight_kg: data.weightKg }),
      ...(data.heightCm !== undefined && { height_cm: data.heightCm }),
      dietary_flags: data.dietaryFlags,
      target_calories: data.targetCalories ?? null,
      target_protein: data.targetProtein ?? null,
      custom_notes: data.customNotes ?? null,
      ...(data.notifyEmail !== undefined && { notify_email: data.notifyEmail }),
      ...(data.notifyPush !== undefined && { notify_push: data.notifyPush }),
      ...(data.notifyScanAlerts !== undefined && { notify_scan_alerts: data.notifyScanAlerts }),
      ...(data.notifyWeeklySummary !== undefined && { notify_weekly_summary: data.notifyWeeklySummary }),
      ...(data.savedBrands !== undefined && { saved_brands: data.savedBrands }),
    };

    const { data: updated, error } = await context.supabase
      .from("profiles")
      .update(update)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;
    return updated;
  });
