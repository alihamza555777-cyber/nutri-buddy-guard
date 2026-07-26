import { useState, useMemo } from "react";
import { BatchMenuItem } from "@/lib/scan.functions";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Search,
  ListFilter,
} from "lucide-react";

interface BatchMenuResultsProps {
  items: BatchMenuItem[];
  onMakeItSafe?: (dish: BatchMenuItem) => void;
  onResetScan?: () => void;
}

export function BatchMenuResults({
  items,
  onMakeItSafe,
  onResetScan,
}: BatchMenuResultsProps) {
  const [filter, setFilter] = useState<"ALL" | "SAFE" | "FLAGGED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const safeCount = useMemo(
    () => items.filter((i) => i.safety_level === "SAFE").length,
    [items]
  );

  const flaggedCount = useMemo(
    () =>
      items.filter(
        (i) => i.safety_level === "CAUTION" || i.safety_level === "AVOID"
      ).length,
    [items]
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category filter
      if (filter === "SAFE" && item.safety_level !== "SAFE") return false;
      if (
        filter === "FLAGGED" &&
        item.safety_level !== "CAUTION" &&
        item.safety_level !== "AVOID"
      )
        return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.dish_name.toLowerCase().includes(q);
        const matchAllergens = item.detected_allergens.some((a) =>
          a.toLowerCase().includes(q)
        );
        const matchSummary = item.brief_summary.toLowerCase().includes(q);
        return matchName || matchAllergens || matchSummary;
      }

      return true;
    });
  }, [items, filter, searchQuery]);

  return (
    <div className="mt-8 space-y-6 w-full max-w-full overflow-hidden box-border">
      {/* Header & Overview Stats Bar */}
      <div className="w-full max-w-full rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-[#008000] animate-pulse shrink-0" />
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white break-words">
                Instant Allergen Radar
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Scanned full menu page: <span className="font-semibold text-slate-900 dark:text-white">{items.length} dishes detected</span>
            </p>
          </div>

          {onResetScan && (
            <button
              type="button"
              onClick={onResetScan}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition-all duration-150 hover:bg-slate-100 active:scale-95 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              Scan New Menu
            </button>
          )}
        </div>

        {/* Filter Controls & Search */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer ${
                filter === "ALL"
                  ? "bg-[#008000] text-white shadow-xs"
                  : "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <ListFilter className="h-3.5 w-3.5 shrink-0" />
              <span>Show All ({items.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilter("SAFE")}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer ${
                filter === "SAFE"
                  ? "border border-emerald-300 bg-emerald-100 text-emerald-900 shadow-xs"
                  : "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <span>🟢 Safe Only ({safeCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilter("FLAGGED")}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer ${
                filter === "FLAGGED"
                  ? "border border-amber-300 bg-amber-100 text-amber-900 shadow-xs"
                  : "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <span>⚠️ Flagged Only ({flaggedCount})</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dish or ingredient..."
              className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none ring-[#008000] focus:ring-2 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Grid of Dishes */}
      {filteredItems.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item, index) => {
            const isSafe = item.safety_level === "SAFE";
            const isCaution = item.safety_level === "CAUTION";
            const isAvoid = item.safety_level === "AVOID";

            return (
              <div
                key={index}
                className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-xs transition-all duration-150 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
              >
                <div>
                  {/* Status Badge & Icon */}
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-base font-bold tracking-tight text-slate-900 dark:text-white break-words flex-1">
                      {item.dish_name}
                    </h4>

                    {isSafe && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#008000] shrink-0" />
                        SAFE
                      </span>
                    )}

                    {isCaution && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 shrink-0">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        CAUTION
                      </span>
                    )}

                    {isAvoid && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-800 shrink-0">
                        <ShieldAlert className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                        AVOID
                      </span>
                    )}
                  </div>

                  {/* Brief Summary */}
                  <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {item.brief_summary}
                  </p>

                  {/* Flagged Allergens */}
                  {item.detected_allergens.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.detected_allergens.map((alg, i) => (
                        <span
                          key={i}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                            isAvoid
                              ? "bg-rose-100 text-rose-900 border border-rose-200"
                              : "bg-amber-100 text-amber-900 border border-amber-200"
                          }`}
                        >
                          ⚠️ {alg}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Action Button */}
                {!isSafe && onMakeItSafe && (
                  <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => onMakeItSafe(item)}
                      className="inline-flex min-h-[44px] h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#008000] px-3.5 py-2 text-xs sm:text-sm font-bold text-white shadow-xs transition-all duration-150 hover:bg-[#006600] active:scale-95 cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4 shrink-0" />
                      <span>Make It Safe</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-medium">No dishes match the selected filter or search.</p>
        </div>
      )}
    </div>
  );
}
