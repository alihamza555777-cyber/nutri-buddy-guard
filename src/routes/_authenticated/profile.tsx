import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { getProfile, updateProfile } from "@/lib/profile.functions";
import { Bell, Loader2, Plus, Save, Tag, User, X, Scale, HeartPulse, CheckCircle2, AlertCircle } from "lucide-react";
import { BmiHealthCard } from "@/components/BmiHealthCard";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile Settings — NutriGuard" },
      { name: "description", content: "Manage your health profile, BMI metrics, allergies, and notification preferences in NutriGuard." },
      { property: "og:title", content: "Profile Settings — NutriGuard" },
      { property: "og:description", content: "Manage your health profile, BMI metrics, allergies, and notification preferences in NutriGuard." },
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

  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState<string>("");
  const [weightKg, setWeightKg] = useState<string>("");
  const [heightCm, setHeightCm] = useState<string>("170");
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
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      const p = profile as typeof profile & {
        full_name?: string | null;
        age?: number | null;
        weight_kg?: number | null;
        height_cm?: number | null;
        notify_email?: boolean;
        notify_push?: boolean;
        notify_scan_alerts?: boolean;
        notify_weekly_summary?: boolean;
        saved_brands?: string[] | null;
      };
      setFullName(p.full_name ?? "");
      setAge(p.age?.toString() ?? "");
      setWeightKg(p.weight_kg?.toString() ?? "");
      setHeightCm(p.height_cm?.toString() ?? "170");
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

  const parsedWeight = useMemo(() => (weightKg ? parseFloat(weightKg) : null), [weightKg]);
  const parsedHeight = useMemo(() => (heightCm ? parseFloat(heightCm) : 170), [heightCm]);
  const parsedAge = useMemo(() => (age ? parseInt(age, 10) : null), [age]);

  // Dirty State Detection
  const isDirty = useMemo(() => {
    if (!profile) return false;
    const p = profile as any;
    const initialFullName = p.full_name ?? "";
    const initialAge = p.age?.toString() ?? "";
    const initialWeightKg = p.weight_kg?.toString() ?? "";
    const initialHeightCm = p.height_cm?.toString() ?? "170";
    const initialRestrictions = p.dietary_flags ?? [];
    const initialCalories = p.target_calories?.toString() ?? "";
    const initialProtein = p.target_protein?.toString() ?? "";
    const initialNotes = p.custom_notes ?? "";
    const initialNotifyEmail = p.notify_email ?? true;
    const initialNotifyPush = p.notify_push ?? false;
    const initialNotifyScanAlerts = p.notify_scan_alerts ?? true;
    const initialNotifyWeeklySummary = p.notify_weekly_summary ?? true;
    const initialSavedBrands = p.saved_brands ?? [];

    if (fullName !== initialFullName) return true;
    if (age !== initialAge) return true;
    if (weightKg !== initialWeightKg) return true;
    if (heightCm !== initialHeightCm) return true;
    if (customNotes !== initialNotes) return true;
    if (targetCalories !== initialCalories) return true;
    if (targetProtein !== initialProtein) return true;
    if (notifyEmail !== initialNotifyEmail) return true;
    if (notifyPush !== initialNotifyPush) return true;
    if (notifyScanAlerts !== initialNotifyScanAlerts) return true;
    if (notifyWeeklySummary !== initialNotifyWeeklySummary) return true;

    if (restrictions.length !== initialRestrictions.length ||
        restrictions.some((r, i) => r !== initialRestrictions[i])) return true;
    if (savedBrands.length !== initialSavedBrands.length ||
        savedBrands.some((b, i) => b !== initialSavedBrands[i])) return true;

    return false;
  }, [
    profile, fullName, age, weightKg, heightCm, restrictions, customNotes,
    targetCalories, targetProtein, notifyEmail, notifyPush, notifyScanAlerts,
    notifyWeeklySummary, savedBrands
  ]);

  const mutation = useMutation({
    mutationFn: () =>
      updateProfileFn({
        data: {
          fullName: fullName || null,
          age: parsedAge,
          weightKg: parsedWeight,
          heightCm: parsedHeight,
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
      toast.success("Profile updated successfully!");
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: any) => {
      console.error("Profile update error:", err);
      const errMsg = err?.message || "Failed to update profile due to network connection. Please try again.";
      toast.error(errMsg);
    },
  });

  function handleSave() {
    setValidationError(null);

    // 1. Dirty check
    if (!isDirty) {
      toast.info("No changes detected. Your profile is already up to date!");
      return;
    }

    // 2. Input Validations
    const trimmedName = fullName.trim();
    const NAME_REGEX = /^[a-zA-Z\s'\-]+$/;
    if (trimmedName && (trimmedName.length > 50 || !NAME_REGEX.test(trimmedName))) {
      const err = "Full Name must be 50 characters or fewer and contain valid name characters.";
      setValidationError(err);
      toast.error(err);
      return;
    }

    if (parsedAge !== null && (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120)) {
      const err = "Please enter a valid age between 1 and 120 years.";
      setValidationError(err);
      toast.error(err);
      return;
    }

    if (parsedWeight !== null && (isNaN(parsedWeight) || parsedWeight <= 0 || parsedWeight > 500)) {
      const err = "Please enter a valid weight in kg (e.g., 70)";
      setValidationError(err);
      toast.error(err);
      return;
    }

    if (parsedHeight !== null && (isNaN(parsedHeight) || parsedHeight <= 0 || parsedHeight > 300)) {
      const err = "Please enter a valid height in cm (e.g., 170)";
      setValidationError(err);
      toast.error(err);
      return;
    }

    if (targetCalories && (isNaN(parseInt(targetCalories, 10)) || parseInt(targetCalories, 10) < 0)) {
      const err = "Daily calorie target must be a positive number.";
      setValidationError(err);
      toast.error(err);
      return;
    }

    if (targetProtein && (isNaN(parseInt(targetProtein, 10)) || parseInt(targetProtein, 10) < 0)) {
      const err = "Daily protein target must be a positive number.";
      setValidationError(err);
      toast.error(err);
      return;
    }

    mutation.mutate();
  }

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
    <div className="mx-auto max-w-2xl w-full max-w-full px-4 py-8 pb-28 sm:px-6 md:pb-12 lg:px-8 overflow-x-hidden box-border">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <User className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground break-words">
            {fullName ? `${fullName}'s Profile` : "Profile settings"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage your personal metrics, BMI health status, allergies, and notifications.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Interactive BMI Visual Status Indicator */}
        <BmiHealthCard
          weightKg={parsedWeight}
          heightCm={parsedHeight}
          age={parsedAge}
        />

        {/* Personal & Health Details */}
        <section className="w-full max-w-full rounded-3xl border border-border bg-card p-5 sm:p-8 shadow-sm overflow-hidden">
          <div className="mb-4 flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-primary shrink-0" />
            <h2 className="text-lg font-semibold text-card-foreground">Personal Details</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="fullName" className="text-sm font-medium text-card-foreground">
                  Full Name
                </label>
                <span className="text-xs text-muted-foreground font-mono">{fullName.length}/50</span>
              </div>
              <input
                id="fullName"
                type="text"
                maxLength={50}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Alex Johnson"
                className="w-full min-h-[44px] rounded-2xl border border-input bg-background px-4 py-3 text-sm sm:text-base text-foreground outline-none ring-ring focus:ring-2 transition-all"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Max 50 characters (letters, spaces, hyphens, and apostrophes allowed).
              </p>
            </div>

            <div>
              <label htmlFor="age" className="mb-2 block text-sm font-medium text-card-foreground">
                Age (years)
              </label>
              <input
                id="age"
                type="number"
                min={1}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g., 28"
                className="w-full min-h-[44px] rounded-2xl border border-input bg-background px-4 py-3 text-sm sm:text-base text-foreground outline-none ring-ring focus:ring-2 transition-all"
              />
            </div>

            <div>
              <label htmlFor="weight" className="mb-2 block text-sm font-medium text-card-foreground">
                Weight (kg)
              </label>
              <input
                id="weight"
                type="number"
                step="0.1"
                min={1}
                max={500}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="e.g., 70.5"
                className="w-full min-h-[44px] rounded-2xl border border-input bg-background px-4 py-3 text-sm sm:text-base text-foreground outline-none ring-ring focus:ring-2 transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="height" className="mb-2 block text-sm font-medium text-card-foreground">
                Height (cm)
              </label>
              <input
                id="height"
                type="number"
                step="0.1"
                min={1}
                max={300}
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="e.g., 170"
                className="w-full min-h-[44px] rounded-2xl border border-input bg-background px-4 py-3 text-sm sm:text-base text-foreground outline-none ring-ring focus:ring-2 transition-all"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Defaulted to 170 cm if unspecified — required for accurate BMI calculation.
              </p>
            </div>
          </div>
        </section>
        {/* Allergies & dietary restrictions */}
        <section className="w-full max-w-full rounded-3xl border border-border bg-card p-5 sm:p-8 shadow-sm overflow-hidden">
          <h2 className="text-lg font-semibold text-card-foreground">Allergies & dietary restrictions</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Select all that apply.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {RESTRICTION_OPTIONS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => toggleRestriction(name)}
                className={`inline-flex min-h-[38px] items-center justify-center rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-all duration-150 active:scale-95 cursor-pointer ${
                  restrictions.includes(name)
                    ? "bg-primary text-primary-foreground shadow-xs"
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
                className="w-full min-h-[44px] rounded-2xl border border-input bg-background px-4 py-3 text-sm sm:text-base text-foreground outline-none ring-ring focus:ring-2 transition-all"
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
                className="w-full min-h-[44px] rounded-2xl border border-input bg-background px-4 py-3 text-sm sm:text-base text-foreground outline-none ring-ring focus:ring-2 transition-all"
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
              className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none ring-ring focus:ring-2 transition-all min-h-[80px]"
            />
          </div>
        </section>

        {/* Notification preferences */}
        <section className="w-full max-w-full rounded-3xl border border-border bg-card p-5 sm:p-8 shadow-sm overflow-hidden">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary shrink-0" />
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
        <section className="w-full max-w-full rounded-3xl border border-border bg-card p-5 sm:p-8 shadow-sm overflow-hidden">
          <div className="mb-2 flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary shrink-0" />
            <h2 className="text-lg font-semibold text-card-foreground">Saved brands</h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
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
              className="flex-1 min-h-[44px] rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none ring-ring focus:ring-2 transition-all"
            />
            <button
              type="button"
              onClick={addBrand}
              className="inline-flex min-h-[44px] h-11 shrink-0 items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all duration-150 hover:bg-primary/90 active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {savedBrands.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {savedBrands.map((brand) => (
                <span
                  key={brand}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs sm:text-sm font-medium text-accent-foreground shadow-xs"
                >
                  {brand}
                  <button
                    type="button"
                    onClick={() => removeBrand(brand)}
                    className="rounded-full p-0.5 hover:bg-background/60 active:scale-90 transition-all cursor-pointer"
                    aria-label={`Remove ${brand}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs sm:text-sm text-muted-foreground">No brands saved yet.</p>
          )}
        </section>

        <div className="flex flex-col gap-2">
          {validationError && (
            <div className="flex items-center gap-2 rounded-2xl bg-danger/10 border border-danger/20 p-3 text-sm text-danger font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={mutation.isPending}
              className="inline-flex min-h-[48px] h-12 w-full sm:w-auto items-center justify-center rounded-full bg-primary px-8 py-3.5 text-base font-bold text-primary-foreground shadow-md transition-all duration-150 hover:bg-primary/90 active:scale-95 disabled:opacity-70 cursor-pointer"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save settings
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Profile updated successfully!
              </span>
            )}
          </div>
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
