import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getTodayNutritionSummary } from "@/lib/history.functions";
import {
  Flame,
  Dumbbell,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  Loader2,
  PieChart,
  Sparkles,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

interface DailyBudgetDashboardProps {
  userId?: string | null;
}

export function DailyBudgetDashboard({ userId }: DailyBudgetDashboardProps) {
  const getSummaryFn = useServerFn(getTodayNutritionSummary);

  const { data: summary, isLoading } = useQuery({
    queryKey: ["today-summary"],
    queryFn: () => getSummaryFn(),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });

  if (!userId) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 sm:p-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Daily Budget Dashboard
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Sign in to automatically track daily calories, macros, and allergen safety budgets.
              </p>
            </div>
          </div>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            Sign in to start tracking
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-44 items-center justify-center rounded-3xl border border-slate-200 bg-card p-6">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
        <span className="ml-3 text-sm font-medium text-slate-600">Loading daily budget summary…</span>
      </div>
    );
  }

  if (!summary || summary.totalScans === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Today's Nutrition & Allergen Budget
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                No food scans recorded today yet.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" />
            Ready for your first scan
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center dark:border-slate-800 dark:bg-slate-900/50">
          <PieChart className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            Scan your meal or dish below to start building today's budget summary!
          </p>
        </div>
      </div>
    );
  }

  // Calorie calculations & progress bar colors
  const calTarget = summary.targetCalories;
  const calConsumed = Math.round(summary.totalCalories);
  const calPct = calTarget ? Math.min(100, Math.round((calConsumed / calTarget) * 100)) : null;

  let calBarColor = "bg-emerald-600";
  let calTextColor = "text-emerald-600";
  if (calTarget) {
    if (calConsumed > calTarget) {
      calBarColor = "bg-rose-500";
      calTextColor = "text-rose-600";
    } else if (calConsumed > calTarget * 0.85) {
      calBarColor = "bg-amber-500";
      calTextColor = "text-amber-600";
    }
  }

  // Protein calculations
  const protTarget = summary.targetProtein;
  const protConsumed = Math.round(summary.totalProtein * 10) / 10;
  const protPct = protTarget ? Math.min(100, Math.round((protConsumed / protTarget) * 100)) : null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-card p-6 shadow-sm sm:p-8">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Today's Nutrition & Allergen Budget
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Aggregated statistics from {summary.totalScans} scan{summary.totalScans === 1 ? "" : "s"} today
            </p>
          </div>
        </div>

        {/* Safety Summary Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>{summary.safeCount} SAFE</span>
          </div>

          {(summary.cautionCount > 0 || summary.avoidCount > 0) && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              <span>
                {summary.cautionCount + summary.avoidCount} FLAGGED
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Target Progress Meters */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {/* Calories Progress Meter */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-sm">
              <Flame className="h-4 w-4 text-amber-500" />
              <span>Calories</span>
            </div>
            <span className={`text-xs font-bold ${calTextColor}`}>
              {calConsumed} {calTarget ? `/ ${calTarget} kcal` : "kcal"}
            </span>
          </div>

          {calPct !== null ? (
            <div className="mt-3">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className={`h-full transition-all duration-500 ${calBarColor}`}
                  style={{ width: `${calPct}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                <span>{calPct}% of daily budget</span>
                {calConsumed > (calTarget ?? 0) && (
                  <span className="font-semibold text-rose-600">Exceeds target by {calConsumed - (calTarget ?? 0)} kcal</span>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Set target calories in your profile to enable budget tracking.
            </p>
          )}
        </div>

        {/* Protein Progress Meter */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-sm">
              <Dumbbell className="h-4 w-4 text-emerald-600" />
              <span>Protein</span>
            </div>
            <span className="text-xs font-bold text-emerald-600">
              {protConsumed}g {protTarget ? `/ ${protTarget}g` : ""}
            </span>
          </div>

          {protPct !== null ? (
            <div className="mt-3">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full bg-emerald-600 transition-all duration-500"
                  style={{ width: `${protPct}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                <span>{protPct}% of protein goal</span>
                {protConsumed >= (protTarget ?? 0) && (
                  <span className="font-semibold text-emerald-600">Goal reached! 🎉</span>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Set target protein in your profile to enable protein tracking.
            </p>
          )}
        </div>
      </div>

      {/* Macro Summary Row */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <MacroStat label="Carbs" value={summary.totalCarbs} unit="g" />
        <MacroStat label="Fats" value={summary.totalFats} unit="g" />
        <MacroStat label="Fiber" value={summary.totalFiber} unit="g" />
        <MacroStat label="Sugar" value={summary.totalSugar} unit="g" />
        <MacroStat label="Sodium" value={summary.totalSodium} unit="mg" />
      </div>
    </div>
  );
}

function MacroStat({ label, value, unit }: { label: string; value: number; unit: string }) {
  const rounded = Math.round(value * 10) / 10;
  return (
    <div className="rounded-xl border border-slate-200 bg-background p-3 text-center dark:border-slate-800">
      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
        {rounded}
        <span className="ml-0.5 text-[10px] font-normal text-slate-600">{unit}</span>
      </p>
    </div>
  );
}
