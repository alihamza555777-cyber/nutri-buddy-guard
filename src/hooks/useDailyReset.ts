import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const LAST_ACTIVE_DATE_KEY = "nutriguard_last_active_date";

/**
 * Custom React hook that monitors calendar day transitions (12:00 AM midnight local time)
 * and automatically triggers a daily nutrition budget reset notification and query refresh.
 * Safely executes inside useEffect to guarantee SSR compatibility.
 */
export function useDailyReset(queryClient?: QueryClient) {
  useEffect(() => {
    // Ensure this runs only on browser client
    if (typeof window === "undefined" || !window.localStorage) return;

    function checkAndTriggerReset() {
      try {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const lastActiveDate = localStorage.getItem(LAST_ACTIVE_DATE_KEY);

        if (lastActiveDate && lastActiveDate !== todayStr) {
          // A new calendar day has started past 12:00 AM local time!
          if (queryClient) {
            queryClient.invalidateQueries({ queryKey: ["today-summary"] });
            queryClient.invalidateQueries({ queryKey: ["scan-history"] });
          }
          toast.info("New day detected! Your daily nutrition budget has been reset.", {
            description: "Food scans from today will populate your fresh daily budget.",
          });
        }

        localStorage.setItem(LAST_ACTIVE_DATE_KEY, todayStr);
      } catch (err) {
        console.warn("[NutriGuard] useDailyReset error:", err);
      }
    }

    // Run check on mount
    checkAndTriggerReset();

    // Check every 60 seconds to catch live midnight 12:00 AM transitions
    const interval = setInterval(checkAndTriggerReset, 60 * 1000);
    return () => clearInterval(interval);
  }, [queryClient]);
}
