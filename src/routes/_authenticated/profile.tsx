import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getProfile, updateProfile } from "@/lib/profile.functions";
import { Bell, Loader2, Plus, Save, Tag, User, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile Settings — NutriGuard" },
      { name: "description", content: "Manage your allergies, notification preferences, and saved brands in NutriGuard." },
      { property: "og:title", content: "Profile Settings — NutriGuard" },
      { property: "og:description", content: "Manage your allergies, notification preferences, and saved brands in NutriGuard." },
    ],
  }),
  component: ProfilePage,
});

const RESTRICTION_OPTIONS = [
  "Peanut",
  "Tree Nut",
  "Gluten",
  "Lactose/Dairy",
  "Shellfish",
  "Soy",
  "Egg",
  "Halal",
  "Vegan",
  "Keto",
];

function ProfilePage() {
  const queryClient = useQueryClient();
  const getProfileFn = useServerFn(getProfile);
  const updateProfileFn = useServerFn(updateProfile);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfileFn(),
    staleTime: 5 * 60 * 1000,
  });

  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [targetCalories, setTargetCalories] = useState<string>("");
  const [targetProtein, setTargetProtein] = useState<string>("");
  const [customNotes, setCustomNotes] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyPush, setNotifyPush] = useState(false);
  const [notifyScanAlerts, setNotifyScanAlerts] = useState(true);
  const [notifyWeeklySummary, setNotifyWeeklySummary] = useState(true);
  const [savedBrands, setSavedBrands] = useState<string[]>([]);
  const [brandInput, setBrandInput] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      const p = profile as typeof profile & {
        notify_email?: boolean;
        notify_push?: boolean;
        notify_scan_alerts?: boolean;
        notify_weekly_summary?: boolean;
        saved_brands?: string[] | null;
      };
      setRestrictions(p.dietary_flags ?? []);
      setTargetCalories(p.target_calories?.toString() ?? "");
      setTargetProtein(p.target_protein?.toString() ?? "");
      setCustomNotes(p.custom_notes ?? "");
      setNotifyEmail(p.notify_email ?? true);
      setNotifyPush(p.notify_push ?? false);
      setNotifyScanAlerts(p.notify_scan_alerts ?? true);
      setNotifyWeeklySummary(p.notify_weekly_summary ?? true);
      setSavedBrands(p.saved_brands ?? []);
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: () =>
      updateProfileFn({
        data: {
          dietaryFlags: restrictions,
          targetCalories: targetCalories ? parseInt(targetCalories, 10) : null,
          targetProtein: targetProtein ? parseInt(targetProtein, 10) : null,
          customNotes: customNotes || null,
          notifyEmail,
          notifyPush,
          notifyScanAlerts,
          notifyWeeklySummary,
          savedBrands,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function toggleRestriction(name: string) {
    setRestrictions((prev) =>
      prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name]
    );
  }

  function addBrand() {
    const trimmed = brandInput.trim();
    if (!trimmed) return;
    if (savedBrands.some((b) => b.toLowerCase() === trimmed.toLowerCase())) {
      setBrandInput("");
      return;
    }
    setSavedBrands((prev) => [...prev, trimmed]);
    setBrandInput("");
  }

  function removeBrand(name: string) {
    setSavedBrands((prev) => prev.filter((b) => b !== name));
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 pb-20 sm:px-6 md:pb-10 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profile settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your allergies, notifications, and saved brands.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Allergies & dietary restrictions */}
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-card-foreground">Allergies & dietary restrictions</h2>
          <p className="text-sm text-muted-foreground">Select all that apply.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {RESTRICTION_OPTIONS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => toggleRestriction(name)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  restrictions.includes(name)
                    ? "bg-primary text-primary-foreground"
                    : "border border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="calories" className="mb-2 block text-sm font-medium text-card-foreground">
                Daily calorie target
              </label>
              <input
                id="calories"
                type="number"
                min={0}
                value={targetCalories}
                onChange={(e) => setTargetCalories(e.target.value)}
                placeholder="e.g., 2000"
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-foreground outline-none ring-ring focus:ring-2"
              />
            </div>
            <div>
              <label htmlFor="protein" className="mb-2 block text-sm font-medium text-card-foreground">
                Daily protein target (g)
              </label>
              <input
                id="protein"
                type="number"
                min={0}
                value={targetProtein}
                onChange={(e) => setTargetProtein(e.target.value)}
                placeholder="e.g., 150"
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-foreground outline-none ring-ring focus:ring-2"
              />
            </div>
          </div>

          <div className="mt-6">
            <label htmlFor="notes" className="mb-2 block text-sm font-medium text-card-foreground">
              Custom notes or medical warnings
            </label>
            <textarea
              id="notes"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="e.g., Sensitive to soy and added sugars"
              rows={3}
              className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-foreground outline-none ring-ring focus:ring-2"
            />
          </div>
        </section>

        {/* Notification preferences */}
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-card-foreground">Notification preferences</h2>
          </div>
          <div className="space-y-3">
            <ToggleRow
              label="Email notifications"
              description="Receive account and activity updates by email."
              checked={notifyEmail}
              onChange={setNotifyEmail}
            />
            <ToggleRow
              label="Push notifications"
              description="Get real-time alerts on this device."
              checked={notifyPush}
              onChange={setNotifyPush}
            />
            <ToggleRow
              label="Allergen scan alerts"
              description="Warn me when a scanned dish flags one of my allergies."
              checked={notifyScanAlerts}
              onChange={setNotifyScanAlerts}
            />
            <ToggleRow
              label="Weekly nutrition summary"
              description="A digest of your week's macros and scans."
              checked={notifyWeeklySummary}
              onChange={setNotifyWeeklySummary}
            />
          </div>
        </section>

        {/* Saved brands */}
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-2 flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-card-foreground">Saved brands</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Brands you trust or want NutriGuard to recognize when analyzing food.
          </p>

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={brandInput}
              onChange={(e) => setBrandInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addBrand();
                }
              }}
              placeholder="Add a brand (e.g., Chobani)"
              maxLength={80}
              className="flex-1 rounded-2xl border border-input bg-background px-4 py-3 text-foreground outline-none ring-ring focus:ring-2"
            />
            <button
              type="button"
              onClick={addBrand}
              className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {savedBrands.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {savedBrands.map((brand) => (
                <span
                  key={brand}
                  className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
                >
                  {brand}
                  <button
                    type="button"
                    onClick={() => removeBrand(brand)}
                    className="rounded-full p-0.5 hover:bg-background/60"
                    aria-label={`Remove ${brand}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No brands saved yet.</p>
          )}
        </section>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save settings
          </button>
          {saved && <span className="text-sm font-medium text-success">Settings saved!</span>}
          {mutation.error && (
            <span className="text-sm font-medium text-danger">
              {mutation.error instanceof Error ? mutation.error.message : "Failed to save"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-border bg-background p-4 transition-colors hover:bg-accent/30">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-input"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
