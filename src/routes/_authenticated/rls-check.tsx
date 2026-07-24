import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, ShieldAlert, Loader2, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rls-check")({
  head: () => ({
    meta: [
      { title: "RLS Verification — NutriGuard" },
      { name: "description", content: "Verify row-level security: confirm you can only read your own profile and scan history." },
      { property: "og:title", content: "RLS Verification — NutriGuard" },
      { property: "og:description", content: "Verify row-level security: confirm you can only read your own profile and scan history." },
    ],
  }),
  component: RlsCheckPage,
});

type CheckState = {
  name: string;
  description: string;
  pass: boolean | null;
  detail: string;
};

function RlsCheckPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [checks, setChecks] = useState<CheckState[]>([]);
  const [running, setRunning] = useState(false);

  const runChecks = async () => {
    setRunning(true);
    const results: CheckState[] = [];
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setUserId(uid);

    // 1. Own profile: should return exactly one row.
    {
      const { data, error } = await supabase.from("profiles").select("id");
      results.push({
        name: "Read profiles table",
        description: "Should only return your own profile row.",
        pass: !error && Array.isArray(data) && data.length === 1 && data[0].id === uid,
        detail: error
          ? `Error: ${error.message}`
          : `Returned ${data?.length ?? 0} row(s). ${data?.every((r) => r.id === uid) ? "All rows belong to you." : "Foreign rows leaked!"}`,
      });
    }

    // 2. Attempt to read a fabricated other user's profile: should return 0 rows.
    {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const { data, error } = await supabase.from("profiles").select("id").eq("id", fakeId);
      results.push({
        name: "Read another user's profile",
        description: "Filtering by a different user id must return 0 rows (blocked by RLS).",
        pass: !error && (data?.length ?? 0) === 0,
        detail: error ? `Error: ${error.message}` : `Returned ${data?.length ?? 0} row(s).`,
      });
    }

    // 3. Attempt to update another user's profile: should affect 0 rows.
    {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const { data, error } = await supabase
        .from("profiles")
        .update({ custom_notes: "rls-test-should-not-write" })
        .eq("id", fakeId)
        .select("id");
      results.push({
        name: "Update another user's profile",
        description: "RLS should prevent updates to rows you don't own.",
        pass: !error && (data?.length ?? 0) === 0,
        detail: error ? `Error: ${error.message}` : `Updated ${data?.length ?? 0} row(s).`,
      });
    }

    // 4. Scan history: every returned row must belong to the current user.
    {
      const { data, error } = await supabase.from("scan_history").select("id, user_id");
      const allMine = (data ?? []).every((r) => r.user_id === uid);
      results.push({
        name: "Read scan_history table",
        description: "All returned rows must belong to you.",
        pass: !error && allMine,
        detail: error
          ? `Error: ${error.message}`
          : `Returned ${data?.length ?? 0} row(s). ${allMine ? "All rows belong to you." : "Foreign rows leaked!"}`,
      });
    }

    // 5. Attempt to insert a scan for another user: should fail RLS check.
    {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const { data, error } = await supabase
        .from("scan_history")
        .insert({ user_id: fakeId, dish_name: "rls-test-should-not-insert" })
        .select("id");
      results.push({
        name: "Insert scan for another user",
        description: "RLS WITH CHECK must reject inserts where user_id ≠ auth.uid().",
        pass: !!error || (data?.length ?? 0) === 0,
        detail: error ? `Blocked: ${error.message}` : `Inserted ${data?.length ?? 0} row(s) — unexpected!`,
      });
    }

    // 6. Query scan_history filtered to fake user: 0 rows.
    {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const { data, error } = await supabase.from("scan_history").select("id").eq("user_id", fakeId);
      results.push({
        name: "Read another user's scans",
        description: "Filtering by a different user id must return 0 rows.",
        pass: !error && (data?.length ?? 0) === 0,
        detail: error ? `Error: ${error.message}` : `Returned ${data?.length ?? 0} row(s).`,
      });
    }

    setChecks(results);
    setRunning(false);
  };

  useEffect(() => {
    runChecks();
  }, []);

  const allPass = checks.length > 0 && checks.every((c) => c.pass);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 pb-20 sm:px-6 md:pb-10 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">RLS verification</h1>
          <p className="text-sm text-muted-foreground">
            Live checks confirming you can only read and write your own data.
          </p>
        </div>
      </div>

      {userId && (
        <p className="mb-6 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Signed in as <span className="font-mono text-foreground">{userId}</span>
        </p>
      )}

      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={runChecks}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
        >
          {running && <Loader2 className="h-4 w-4 animate-spin" />}
          {running ? "Running…" : "Re-run checks"}
        </button>
        {checks.length > 0 && (
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
              allPass ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
            }`}
          >
            {allPass ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            {allPass ? "All checks passed" : "Some checks failed"}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {checks.map((c) => (
          <div
            key={c.name}
            className={`rounded-xl border p-4 ${
              c.pass ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
            }`}
          >
            <div className="flex items-start gap-3">
              {c.pass ? (
                <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-success" />
              ) : (
                <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{c.name}</h3>
                <p className="text-sm text-muted-foreground">{c.description}</p>
                <p className="mt-2 font-mono text-xs text-foreground/80">{c.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
