import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getScanHistory, deleteScanRecord, clearAllScanRecords } from "@/lib/history.functions";
import { deleteScanById, clearAllScanHistory } from "@/services/history";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  History,
  RefreshCw,
  Trash2,
  Utensils,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

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
  const queryClient = useQueryClient();
  const getHistoryFn = useServerFn(getScanHistory);
  const deleteScanFn = useServerFn(deleteScanRecord);
  const clearAllFn = useServerFn(clearAllScanRecords);

  const { data: scans, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["scan-history"],
    queryFn: () => getHistoryFn(),
    staleTime: 60 * 1000,
  });

  const [localScans, setLocalScans] = useState<any[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);

  useEffect(() => {
    if (scans) {
      setLocalScans(scans);
    }
  }, [scans]);

  const displayScans = localScans ?? scans ?? [];

  // Single Item Delete handler
  const handleDeleteSingle = async (scanId: string) => {
    if (deletingId || isClearingAll) return;
    setDeletingId(scanId);

    // Optimistic UI update
    const previousList = localScans;
    const updatedList = (localScans || []).filter((s) => s.id !== scanId);
    setLocalScans(updatedList);
    queryClient.setQueryData(["scan-history"], updatedList);

    try {
      // 1. Try direct Supabase client service delete
      await deleteScanById(scanId);
      toast.success("Scan deleted");
      queryClient.invalidateQueries({ queryKey: ["scan-history"] });
      queryClient.invalidateQueries({ queryKey: ["today-summary"] });
    } catch (err) {
      console.warn("Client deleteScanById failed, trying server function fallback...", err);
      try {
        // 2. Fallback to server function
        await deleteScanFn({ data: { scanId } });
        toast.success("Scan deleted");
        queryClient.invalidateQueries({ queryKey: ["scan-history"] });
        queryClient.invalidateQueries({ queryKey: ["today-summary"] });
      } catch (fallbackErr) {
        console.error("Failed to delete scan:", fallbackErr);
        // Revert optimistic update
        setLocalScans(previousList);
        queryClient.setQueryData(["scan-history"], previousList);
        toast.error("Failed to delete history");
      }
    } finally {
      setDeletingId(null);
    }
  };

  // Bulk Delete All History handler
  const handleConfirmClearAll = async () => {
    setIsClearAllDialogOpen(false);
    if (isClearingAll) return;
    setIsClearingAll(true);

    const previousList = localScans;
    setLocalScans([]);
    queryClient.setQueryData(["scan-history"], []);

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user?.id) {
        await clearAllScanHistory(authData.user.id);
      } else {
        await clearAllFn();
      }
      toast.success("All history cleared");
      queryClient.invalidateQueries({ queryKey: ["scan-history"] });
      queryClient.invalidateQueries({ queryKey: ["today-summary"] });
    } catch (err) {
      console.warn("Client clearAllScanHistory failed, trying server function fallback...", err);
      try {
        await clearAllFn();
        toast.success("All history cleared");
        queryClient.invalidateQueries({ queryKey: ["scan-history"] });
        queryClient.invalidateQueries({ queryKey: ["today-summary"] });
      } catch (fallbackErr) {
        console.error("Failed to clear scan history:", fallbackErr);
        setLocalScans(previousList);
        queryClient.setQueryData(["scan-history"], previousList);
        toast.error("Failed to delete history");
      }
    } finally {
      setIsClearingAll(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl w-full max-w-full px-4 py-8 pb-28 sm:px-6 md:pb-12 lg:px-8 overflow-x-hidden box-border">
      {/* Page Header Bar */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <History className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground break-words">Scan history</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">All your past food inspections in one place.</p>
          </div>
        </div>

        {/* Clear All History Action Button */}
        {displayScans && displayScans.length > 0 && (
          <button
            type="button"
            onClick={() => setIsClearAllDialogOpen(true)}
            disabled={isClearingAll}
            className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-5 py-2.5 text-xs sm:text-sm font-bold text-rose-600 shadow-xs transition-all duration-150 hover:bg-rose-100 active:scale-95 disabled:opacity-50 cursor-pointer dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400"
          >
            {isClearingAll ? (
              <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
            ) : (
              <Trash2 className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>Clear All History</span>
          </button>
        )}
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
      ) : !displayScans?.length ? (
        <div className="rounded-3xl border border-border bg-card p-8 sm:p-12 text-center overflow-hidden">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Utensils className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-foreground">No scan history yet</h3>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Scan a food item or menu to get started tracking hidden allergens and nutrition!
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary/90 active:scale-95"
          >
            Scan a food item
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {displayScans.map((scan: any) => (
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
                <div className="flex items-center gap-2 shrink-0">
                  <SafetyBadge level={scan.safety_level as "SAFE" | "CAUTION" | "AVOID"} />
                  {/* Single Item Trash / Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteSingle(scan.id)}
                    disabled={deletingId === scan.id || isClearingAll}
                    className="flex min-h-[44px] min-w-[44px] h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-rose-50 hover:text-rose-600 active:scale-90 transition-all cursor-pointer dark:hover:bg-rose-950/50"
                    title="Delete this scan record"
                    aria-label="Delete scan"
                  >
                    {deletingId === scan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400" />
                    )}
                  </button>
                </div>
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
                  {scan.flagged_ingredients.map((ing: string) => (
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

      {/* Confirmation Modal / Dialog for Clear All History */}
      <AlertDialog open={isClearAllDialogOpen} onOpenChange={setIsClearAllDialogOpen}>
        <AlertDialogContent className="rounded-3xl border border-border bg-card p-6 shadow-xl max-w-md w-full">
          <AlertDialogHeader className="text-left">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <AlertDialogTitle className="text-lg font-bold text-foreground">
                Clear All Scan History?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete all scan history? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            <AlertDialogCancel className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center rounded-full border border-input bg-background px-5 py-2.5 text-xs sm:text-sm font-semibold text-foreground transition-all hover:bg-accent active:scale-95 cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClearAll}
              className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center rounded-full bg-rose-600 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md transition-all duration-150 hover:bg-rose-700 active:scale-95 cursor-pointer"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${styles[level]}`}>
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
        {value !== null && value !== undefined && <span className="text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

