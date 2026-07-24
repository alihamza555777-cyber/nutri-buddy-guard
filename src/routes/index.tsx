import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { analyzeFood, saveScan, type ScanResult } from "@/lib/scan.functions";
import { getProfile } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  Camera,
  Type,
  Loader2,
  Upload,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Utensils,
  ChevronRight,
  Leaf,
  User,
} from "lucide-react";
import heroFood from "@/assets/hero-food.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NutriGuard — AI Food & Allergen Scanner" },
      { name: "description", content: "Scan a menu photo or type a dish name. NutriGuard checks for hidden allergens, breaks down nutrition, and tells you what to ask your server." },
      { property: "og:title", content: "NutriGuard — AI Food & Allergen Scanner" },
      { property: "og:description", content: "Scan a menu photo or type a dish name. NutriGuard checks for hidden allergens, breaks down nutrition, and tells you what to ask your server." },
      { property: "og:image", content: heroFood },
      { name: "twitter:image", content: heroFood },
    ],
  }),
  component: HomePage,
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

function HomePage() {
  const analyze = useServerFn(analyzeFood);
  const save = useServerFn(saveScan);
  const getProfileFn = useServerFn(getProfile);

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [tab, setTab] = useState<"image" | "text">("text");
  const [textInput, setTextInput] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfileFn(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (profile) {
      setRestrictions(profile.dietary_flags ?? []);
      setCustomNotes(profile.custom_notes ?? "");
    }
  }, [profile]);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const dishInput = tab === "image" ? imageBase64 : textInput;
    if (!dishInput) {
      setError(tab === "image" ? "Please upload a photo first." : "Please enter a dish name.");
      return;
    }

    setLoading(true);
    try {
      const data = await analyze({
        data: {
          inputType: tab,
          dishInput,
          restrictions,
          customNotes,
          targetCalories: profile?.target_calories ?? null,
          targetProtein: profile?.target_protein ?? null,
        },
      });
      setResult(data);

      if (user) {
        let imageUrl: string | null = null;
        if (imageFile) {
          const path = `${user.id}/${Date.now()}-${imageFile.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("scan-images")
            .upload(path, imageFile);
          if (!uploadError && uploadData) {
            const { data: signedData, error: signedError } = await supabase.storage
              .from("scan-images")
              .createSignedUrl(uploadData.path, 60 * 60 * 24 * 365);
            imageUrl = signedError ? uploadData.path : signedData?.signedUrl ?? null;
          }
        }
        await save({
          data: {
            inputType: tab,
            imageUrl,
            result: data,
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImageBase64(reader.result as string);
    reader.readAsDataURL(file);
  }

  function toggleRestriction(name: string) {
    setRestrictions((prev) =>
      prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name]
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 pb-20 sm:px-6 md:pb-10 lg:px-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-secondary to-background p-8 sm:p-12 lg:p-16">
        <div className="relative z-10 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Eat out with <span className="text-primary">confidence</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg text-muted-foreground">
              Snap a menu photo or type a dish name. NutriGuard checks for hidden allergens,
              breaks down nutrition, and tells you exactly what to ask your server.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {!user && (
                <Link
                  to="/auth"
                  className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Sign in to save scans
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              )}
              <Link
                to="/profile"
                className="inline-flex items-center justify-center rounded-full border border-input bg-background px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <User className="mr-2 h-4 w-4" />
                Set dietary profile
              </Link>
            </div>
          </div>
          <div className="hidden lg:block">
            <img
              src={heroFood}
              alt="Fresh salad bowl with smartphone scanner and vegetables"
              width={1344}
              height={768}
              className="rounded-3xl object-cover shadow-lg"
            />
          </div>
        </div>
      </section>

      {/* Scanner card */}
      <section className="mt-10">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-card-foreground">Food scanner</h2>
              <p className="text-sm text-muted-foreground">
                {user ? "Signed in — your scans will be saved." : "Signed out — scans won't be saved."}
              </p>
            </div>
          </div>

          <form onSubmit={handleAnalyze}>
            <div className="mb-6 inline-flex rounded-full bg-muted p-1">
              <button
                type="button"
                onClick={() => setTab("text")}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  tab === "text"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Type className="h-4 w-4" />
                Type dish name
              </button>
              <button
                type="button"
                onClick={() => setTab("image")}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  tab === "image"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Camera className="h-4 w-4" />
                Upload photo
              </button>
            </div>

            {tab === "text" ? (
              <div className="mb-6">
                <label htmlFor="dish" className="mb-2 block text-sm font-medium text-card-foreground">
                  Dish name
                </label>
                <input
                  id="dish"
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="e.g., Pad Thai with shrimp"
                  className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-foreground outline-none ring-ring focus:ring-2"
                />
              </div>
            ) : (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-input bg-background px-4 py-10 text-center transition-colors hover:bg-accent"
                >
                  {imageBase64 ? (
                    <img
                      src={imageBase64}
                      alt="Selected food"
                      className="mb-4 h-48 w-full rounded-xl object-cover"
                    />
                  ) : (
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                      <Upload className="h-6 w-6" />
                    </div>
                  )}
                  <span className="text-sm font-medium text-card-foreground">
                    {imageBase64 ? "Tap to change photo" : "Tap to upload a menu or food photo"}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">PNG, JPG up to 5 MB</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-card-foreground">
                Your dietary restrictions
              </label>
              <div className="flex flex-wrap gap-2">
                {RESTRICTION_OPTIONS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleRestriction(name)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      restrictions.includes(name)
                        ? "bg-primary text-primary-foreground"
                        : "border border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="notes" className="mb-2 block text-sm font-medium text-card-foreground">
                Custom notes
              </label>
              <textarea
                id="notes"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="e.g., Sensitive to soy sauce, trying to keep sodium low"
                rows={3}
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-foreground outline-none ring-ring focus:ring-2"
              />
            </div>

            {error && (
              <div className="mb-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-full bg-primary py-3.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70 sm:w-auto sm:px-10"
            >
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {loading ? "Analyzing..." : "Analyze food with AI"}
            </button>
          </form>
        </div>
      </section>

      {/* Results */}
      {result && (
        <section className="mt-10 space-y-6">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-2xl font-bold text-card-foreground">{result.dish_name}</h3>
                <p className="text-sm text-muted-foreground">AI inspection result</p>
              </div>
              <SafetyBadge level={result.safety_level} />
            </div>

            <p className="mt-6 text-foreground">{result.explanation}</p>

            {result.flagged_ingredients.length > 0 && (
              <div className="mt-6 rounded-2xl bg-danger/10 p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-danger">
                  <AlertTriangle className="h-4 w-4" />
                  Flagged ingredients
                </h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {result.flagged_ingredients.map((ing) => (
                    <span
                      key={ing}
                      className="rounded-full bg-danger/20 px-3 py-1 text-sm font-medium text-danger"
                    >
                      {ing}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 rounded-2xl bg-info/10 p-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-info-foreground">
                <Leaf className="h-4 w-4" />
                Ask your server
              </h4>
              <p className="mt-2 text-info-foreground">{result.waiter_question}</p>
            </div>
          </div>

          <NutritionGrid result={result} profile={profile ?? null} />
        </section>
      )}
    </div>
  );
}

function SafetyBadge({ level }: { level: ScanResult["safety_level"] }) {
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
    <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${styles[level]}`}>
      <Icon className="h-4 w-4" />
      {level}
    </span>
  );
}

function NutritionGrid({ result, profile }: { result: ScanResult; profile: { target_calories?: number | null; target_protein?: number | null } | null }) {
  const items = [
    { label: "Calories", value: result.calories, unit: "kcal", target: profile?.target_calories },
    { label: "Protein", value: result.protein_g, unit: "g", target: profile?.target_protein },
    { label: "Carbs", value: result.carbs_g, unit: "g" },
    { label: "Fats", value: result.fats_g, unit: "g" },
    { label: "Fiber", value: result.fiber_g, unit: "g" },
    { label: "Sugar", value: result.sugar_g, unit: "g" },
    { label: "Sodium", value: result.sodium_mg, unit: "mg" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const pct = item.value && item.target ? Math.min(100, Math.round((item.value / item.target) * 100)) : null;
        return (
          <div
            key={item.label}
            className="rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-accent/30"
          >
            <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-2xl font-bold text-card-foreground">
              {item.value ?? "—"}
              {item.value && <span className="ml-1 text-sm font-normal text-muted-foreground">{item.unit}</span>}
            </p>
            {pct !== null && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
