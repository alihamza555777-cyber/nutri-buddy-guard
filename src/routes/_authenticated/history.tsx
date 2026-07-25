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
    <div className="mx-auto max-w-5xl px-4 py-10 pb-20 sm:px-6 md:pb-10 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <History className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Scan history</h1>
          <p className="text-sm text-muted-foreground">All your past food inspections in one place.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="rounded-3xl border border-danger/20 bg-danger/5 p-8 text-center sm:p-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">Failed to load scan history</h3>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto">
            {error instanceof Error ? error.message : "A database or connection issue occurred while fetching your history."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      ) : !scans?.length ? (
        <div className="rounded-3xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">No scans yet.</p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Scan your first dish
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {scans.map((scan) => (
            <div
              key={scan.id}
              className="rounded-3xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-accent/20 sm:p-6"
            >
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-semibold text-card-foreground">{scan.dish_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {scan.created_at ? format(new Date(scan.created_at), "MMM d, yyyy h:mm a") : "—"} ·{" "}
                    {scan.input_type === "image" ? "Photo scan" : "Text scan"}
                  </p>
                </div>
                <SafetyBadge level={scan.safety_level as "SAFE" | "CAUTION" | "AVOID"} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
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
                      className="rounded-full bg-danger/10 px-2.5 py-1 text-xs font-medium text-danger"
                    >
                      {ing}
                    </span>
                  ))}
                </div>
              )}

              {scan.waiter_question && (
                <p className="mt-4 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Ask your server:</span> {scan.waiter_question}
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
