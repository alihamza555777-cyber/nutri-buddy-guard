import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getScanHistory } from "@/lib/history.functions";
import { Loader2, AlertTriangle, CheckCircle2, XCircle, History, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Scan History — NutriGuard" },
      { name: "description", content: "Review your past food scans, safety results, and nutrition breakdowns in NutriGuard." },
      { property: "og:title", content: "Scan History — NutriGuard" },
      { property: "og:description", content: "Review your past food scans, safety results, and nutrition breakdowns in NutriGuard." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const getHistoryFn = useServerFn(getScanHistory);
  const { data: scans, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["scan-history"],
    queryFn: () => getHistoryFn(),
    staleTime: 60 * 1000,
  });

  return (
    <div className="mx-auto max-w-5xl w-full max-w-full px-4 py-8 pb-28 sm:px-6 md:pb-12 lg:px-8 overflow-x-hidden box-border">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <History className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground break-words">Scan history</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">All your past food inspections in one place.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="rounded-3xl border border-danger/20 bg-danger/5 p-6 sm:p-12 text-center overflow-hidden">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">Failed to load scan history</h3>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            {error instanceof Error ? error.message : "A database or connection issue occurred while fetching your history."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all duration-150 hover:bg-primary/90 active:scale-95 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      ) : !scans?.length ? (
        <div className="rounded-3xl border border-border bg-card p-8 sm:p-12 text-center overflow-hidden">
          <p className="text-sm text-muted-foreground">No scans yet.</p>
          <Link
            to="/"
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/90 active:scale-95"
          >
            Scan your first dish
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {scans.map((scan) => (
            <div
              key={scan.id}
              className="w-full max-w-full rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-sm transition-all duration-150 hover:bg-accent/20 overflow-hidden"
            >
              <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold text-card-foreground break-words">{scan.dish_name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {scan.created_at ? format(new Date(scan.created_at), "MMM d, yyyy h:mm a") : "—"} ·{" "}
                    {scan.input_type === "image" ? "Photo scan" : "Text scan"}
                  </p>
                </div>
                <SafetyBadge level={scan.safety_level as "SAFE" | "CAUTION" | "AVOID"} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4 lg:grid-cols-7">
                <Nutrient label="Calories" value={scan.calories} unit="" />
                <Nutrient label="Protein" value={scan.protein_g} unit="g" />
                <Nutrient label="Carbs" value={scan.carbs_g} unit="g" />
                <Nutrient label="Fats" value={scan.fats_g} unit="g" />
                <Nutrient label="Fiber" value={scan.fiber_g} unit="g" />
                <Nutrient label="Sugar" value={scan.sugar_g} unit="g" />
                <Nutrient label="Sodium" value={scan.sodium_mg} unit="mg" />
              </div>

              {scan.flagged_ingredients && scan.flagged_ingredients.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {scan.flagged_ingredients.map((ing) => (
                    <span
                      key={ing}
                      className="rounded-full bg-danger/10 px-3 py-1 text-xs font-medium text-danger"
                    >
                      {ing}
                    </span>
                  ))}
                </div>
              )}

              {scan.waiter_question && (
                <p className="mt-4 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">Ask your server:</span> {scan.waiter_question}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SafetyBadge({ level }: { level: "SAFE" | "CAUTION" | "AVOID" }) {
  const styles = {
    SAFE: "bg-success text-success-foreground",
    CAUTION: "bg-warning text-warning-foreground",
    AVOID: "bg-danger text-danger-foreground",
  };
  const icons = {
    SAFE: CheckCircle2,
    CAUTION: AlertTriangle,
    AVOID: XCircle,
  };
  const Icon = icons[level];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${styles[level]}`}>
      <Icon className="h-3.5 w-3.5" />
      {level}
    </span>
  );
}

function Nutrient({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="rounded-2xl bg-muted p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">
        {value ?? "—"}
        {value && <span className="text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}
