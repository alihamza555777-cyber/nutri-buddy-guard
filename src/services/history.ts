import { supabase } from "@/integrations/supabase/client";

/**
 * Deletes a single scan record from `scan_history` by its unique ID.
 */
export async function deleteScanById(scanId: string): Promise<void> {
  const { error } = await supabase
    .from("scan_history")
    .delete()
    .eq("id", scanId);

  if (error) {
    console.error("deleteScanById error:", error);
    throw new Error(error.message || "Failed to delete scan record.");
  }
}

/**
 * Performs bulk deletion of all scan history records for the specified user ID.
 */
export async function clearAllScanHistory(userId: string): Promise<void> {
  const { error } = await supabase
    .from("scan_history")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("clearAllScanHistory error:", error);
    throw new Error(error.message || "Failed to clear all scan history.");
  }
}
