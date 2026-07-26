import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  analyzeFood,
  saveScan,
  analyzeBatchMenu,
  type ScanResult,
  type BatchMenuItem,
} from "@/lib/scan.functions";
import { getProfile } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Sparkles,
  Plus,
  X,
  FileText,
  AlertCircle,
  ScanLine,
} from "lucide-react";
import heroFood from "@/assets/hero-food.png";
import { SafeOrderModal } from "@/components/SafeOrderModal";
import { DailyBudgetDashboard } from "@/components/DailyBudgetDashboard";
import { DigitalWaiterCardModal } from "@/components/DigitalWaiterCardModal";
import { BatchMenuResults } from "@/components/BatchMenuResults";
import { WebcamScannerModal } from "@/components/WebcamScannerModal";
import { CameraViewfinderModal } from "@/components/CameraViewfinderModal";
import { toast } from "sonner";

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

const GUEST_RESTRICTIONS_KEY = "nutriguard_guest_restrictions";
const GUEST_NOTES_KEY = "nutriguard_guest_notes";

function HomePage() {
  const queryClient = useQueryClient();
  const analyze = useServerFn(analyzeFood);
  const save = useServerFn(saveScan);
  const getProfileFn = useServerFn(getProfile);

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [tab, setTab] = useState<"image" | "text">("text");
  const [textInput, setTextInput] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [customRestrictionInput, setCustomRestrictionInput] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSafeModalOpen, setIsSafeModalOpen] = useState(false);
  const [isWaiterModalOpen, setIsWaiterModalOpen] = useState(false);
  const [isWebcamModalOpen, setIsWebcamModalOpen] = useState(false);
  const [isCameraViewfinderOpen, setIsCameraViewfinderOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
    try {
      const savedRestrictions = localStorage.getItem(GUEST_RESTRICTIONS_KEY);
      const savedNotes = localStorage.getItem(GUEST_NOTES_KEY);
      if (savedRestrictions) {
        const parsed = JSON.parse(savedRestrictions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRestrictions((prev) => Array.from(new Set([...prev, ...parsed])));
        }
      }
      if (savedNotes) {
        setCustomNotes((prev) => (prev ? prev : savedNotes));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (profile) {
      const profileFlags = profile.dietary_flags ?? [];
      setRestrictions((prev) => Array.from(new Set([...profileFlags, ...prev])));
      if (profile.custom_notes) {
        setCustomNotes(profile.custom_notes);
      }
    }
  }, [profile]);

  useEffect(() => {
    const handleOpenCamera = () => setIsCameraViewfinderOpen(true);
    window.addEventListener("nutriguard-open-camera", handleOpenCamera);
    return () => window.removeEventListener("nutriguard-open-camera", handleOpenCamera);
  }, []);

  async function executeInstantScan(base64Data: string, fileObj?: File) {
    setImageBase64(base64Data);
    if (fileObj) setImageFile(fileObj);
    setTab("image");
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const data = await analyze({
        data: {
          inputType: "image",
          dishInput: base64Data,
          restrictions,
          customNotes,
          targetCalories: profile?.target_calories ?? null,
          targetProtein: profile?.target_protein ?? null,
        },
      });
      setResult(data);

      const currentUser = user || (await supabase.auth.getUser()).data.user;

      if (currentUser) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          const headers: Record<string, string> = {};
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }

          let imageUrl: string | null = null;
          if (fileObj) {
            const path = `${currentUser.id}/${Date.now()}-${fileObj.name}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("scan-images")
              .upload(path, fileObj);
            if (!uploadError && uploadData) {
              const { data: signedData, error: signedError } = await supabase.storage
                .from("scan-images")
                .createSignedUrl(uploadData.path, 60 * 60 * 24 * 365);
              imageUrl = signedError ? uploadData.path : signedData?.signedUrl ?? null;
            }
          }
          await save({
            data: {
              inputType: "image",
              imageUrl,
              result: data,
            },
            headers,
          });
          queryClient.invalidateQueries({ queryKey: ["today-summary"] });
          queryClient.invalidateQueries({ queryKey: ["scan-history"] });
          toast.success("Scan saved to your history!");
        } catch (saveError) {
          console.error("Failed to save scan record to database:", saveError);
          toast.error("Scan completed, but could not be saved to history.");
        }
      } else {
        toast.info("Sign in or create an account to save your scan history!");
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Analysis failed. Please try again.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  }

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

      const currentUser = user || (await supabase.auth.getUser()).data.user;

      if (currentUser) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          const headers: Record<string, string> = {};
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }

          let imageUrl: string | null = null;
          if (imageFile) {
            const path = `${currentUser.id}/${Date.now()}-${imageFile.name}`;
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
            headers,
          });
          queryClient.invalidateQueries({ queryKey: ["today-summary"] });
          queryClient.invalidateQueries({ queryKey: ["scan-history"] });
          toast.success("Scan saved to your history!");
        } catch (saveError) {
          console.error("Failed to save scan record to database:", saveError);
          toast.error("Scan completed, but could not be saved to history.");
        }
      } else {
        toast.info("Sign in or create an account to save your scan history!");
      }
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : "Analysis failed. Please try again.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  }

  function validateImageFile(file: File): boolean {
    if (!file.type.startsWith("image/")) {
      const msg = "Invalid file type. Please upload a JPEG, PNG, or WebP image.";
      setError(msg);
      toast.error(msg);
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      const msg = "Image size is too large. Please select an image under 10MB.";
      setError(msg);
      toast.error(msg);
      return false;
    }
    return true;
  }

  function handleWebcamCapture(base64Image: string) {
    executeInstantScan(base64Image);
  }

  function handleNativeCameraCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateImageFile(file)) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        executeInstantScan(reader.result as string, file);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateImageFile(file)) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        executeInstantScan(reader.result as string, file);
      }
    };
    reader.readAsDataURL(file);
  }

  function saveGuestState(newRestrictions: string[], newNotes: string) {
    try {
      localStorage.setItem(GUEST_RESTRICTIONS_KEY, JSON.stringify(newRestrictions));
      localStorage.setItem(GUEST_NOTES_KEY, newNotes);
    } catch {}
  }

  function toggleRestriction(name: string) {
    setRestrictions((prev) => {
      const next = prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name];
      saveGuestState(next, customNotes);
      return next;
    });
  }

  function handleAddCustomRestriction() {
    const trimmed = customRestrictionInput.trim();
    if (!trimmed) return;
    if (!restrictions.includes(trimmed)) {
      const next = [...restrictions, trimmed];
      setRestrictions(next);
      saveGuestState(next, customNotes);
    }
    setCustomRestrictionInput("");
  }

  function removeCustomRestriction(name: string) {
    setRestrictions((prev) => {
      const next = prev.filter((r) => r !== name);
      saveGuestState(next, customNotes);
      return next;
    });
  }

  function handleNotesChange(value: string) {
    setCustomNotes(value);
    saveGuestState(restrictions, value);
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
              <button
                type="button"
                onClick={() => setIsWaiterModalOpen(true)}
                className="inline-flex items-center justify-center rounded-full border border-emerald-200/80 bg-emerald-50 px-6 py-3 text-sm font-bold text-emerald-600 shadow-xs transition-all hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
              >
                <Utensils className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Dining Out Mode (Waiter Card)
              </button>
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

      {/* Daily Budget Dashboard */}
      <section className="mt-10">
        <DailyBudgetDashboard userId={user?.id} />
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
                onClick={() => {
                  setTab("text");
                  setResult(null);
                }}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  tab === "text"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Type className="h-4 w-4" />
                Type dish name
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("image");
                  setResult(null);
                }}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  tab === "image"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Camera className="h-4 w-4" />
                Single dish photo
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
              <div className="mb-6 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Primary Open Live Camera Button */}
                  <button
                    type="button"
                    onClick={() => setIsCameraViewfinderOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#008000] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#006600] active:scale-95 cursor-pointer"
                  >
                    <Camera className="h-4 w-4 text-white" />
                    <span>📷 Open Live Camera</span>
                  </button>

                  {/* Upload Photo Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <Upload className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    <span>Upload photo</span>
                  </button>
                </div>

                {/* Uploaded / Captured Image Preview Box */}
                {imageBase64 && (
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900">
                    <img
                      src={imageBase64}
                      alt="Captured dish"
                      className="h-48 w-full rounded-xl object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageBase64(null);
                        setImageFile(null);
                      }}
                      className="absolute top-4 right-4 rounded-full bg-slate-900/80 p-1.5 text-white backdrop-blur-xs transition hover:bg-slate-900"
                      title="Clear photo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Hidden native camera & file inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleNativeCameraCapture}
                />
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
                Your dietary restrictions & allergies
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

                {/* Custom restrictions pills */}
                {restrictions
                  .filter((r) => !RESTRICTION_OPTIONS.includes(r))
                  .map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#008000] px-3.5 py-1.5 text-sm font-semibold text-white shadow-xs"
                    >
                      <span>{name}</span>
                      <button
                        type="button"
                        onClick={() => removeCustomRestriction(name)}
                        className="rounded-full p-0.5 transition hover:bg-[#006600]"
                        title="Remove restriction"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
              </div>

              {/* Refactored Compact + Add Custom Allergen Input */}
              <div className="mt-3 flex items-center gap-2 max-w-md">
                <input
                  type="text"
                  value={customRestrictionInput}
                  onChange={(e) => setCustomRestrictionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomRestriction();
                    }
                  }}
                  placeholder="Add custom allergy (e.g. Sesame, Mustard)..."
                  className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-xs text-foreground outline-none ring-ring focus:ring-2"
                />
                <button
                  type="button"
                  onClick={handleAddCustomRestriction}
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-[#008000]/20 bg-[#008000]/10 px-4 text-xs font-semibold text-[#008000] transition-all hover:bg-[#008000]/20"
                >
                  <Plus className="h-3.5 w-3.5 text-[#008000]" />
                  <span>Add Custom</span>
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="notes" className="mb-2 block text-sm font-medium text-card-foreground">
                Custom notes & medical conditions
              </label>
              <textarea
                id="notes"
                value={customNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="e.g., Severe celiac disease, strict cross-contamination risk, sensitive to soy sauce"
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
              className="inline-flex w-full items-center justify-center rounded-full bg-[#008000] py-3.5 text-base font-semibold text-white shadow-md transition-colors hover:bg-[#006600] disabled:opacity-70 sm:w-auto sm:px-10"
            >
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {loading ? "Analyzing..." : "Analyze food with AI"}
            </button>
          </form>
        </div>
      </section>

      {/* Single Scan Results */}
      {result && (() => {
        const relevantFlaggedIngredients = (result.flagged_ingredients || []).filter((_item: string) => {
          if (restrictions.length === 0 && !customNotes?.trim()) {
            return false; // User has no allergies set, so do not flag anything
          }
          return true;
        });

        return (
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

              {relevantFlaggedIngredients.length > 0 && (
                <div className="mt-6 rounded-2xl bg-danger/10 p-4">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-danger">
                    <AlertTriangle className="h-4 w-4" />
                    Flagged ingredients
                  </h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {relevantFlaggedIngredients.map((ing) => (
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
              <p className="mt-2 text-info-foreground">{result.server_question || result.waiter_question}</p>
            </div>

            {result.make_it_safe_instructions && result.make_it_safe_instructions.length > 0 && (
              <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/40">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="h-4 w-4" />
                  Make It Safe Instructions
                </h4>
                <ul className="mt-2 space-y-1.5 list-disc list-inside text-sm text-foreground">
                  {result.make_it_safe_instructions.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {(result.safety_level === "CAUTION" || result.safety_level === "AVOID") && (
              <div className="mt-6 border-t border-border pt-6">
                <button
                  type="button"
                  onClick={() => setIsSafeModalOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#008000] px-6 py-4 text-base font-bold text-white shadow-md transition-all hover:bg-[#006600] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#008000] focus:ring-offset-2 sm:w-auto"
                >
                  <Sparkles className="h-5 w-5" />
                  Make It Safe — AI Ordering Instructions
                </button>
              </div>
            )}
          </div>

          <NutritionGrid result={result} profile={profile ?? null} />

          {result && (result.safety_level === "CAUTION" || result.safety_level === "AVOID") && (
            <SafeOrderModal
              isOpen={isSafeModalOpen}
              onClose={() => setIsSafeModalOpen(false)}
              dishName={result.dish_name}
              flaggedIngredients={result.flagged_ingredients}
              restrictions={restrictions}
              customNotes={customNotes}
              safetyLevel={result.safety_level === "AVOID" ? "AVOID" : "CAUTION"}
            />
          )}
        </section>
        );
      })()}

      <DigitalWaiterCardModal
        isOpen={isWaiterModalOpen}
        onClose={() => setIsWaiterModalOpen(false)}
        initialRestrictions={restrictions}
        initialCustomNotes={customNotes}
      />

      <WebcamScannerModal
        isOpen={isWebcamModalOpen}
        onClose={() => setIsWebcamModalOpen(false)}
        onCapture={handleWebcamCapture}
      />

      <CameraViewfinderModal
        isOpen={isCameraViewfinderOpen}
        onClose={() => setIsCameraViewfinderOpen(false)}
        onCapture={handleWebcamCapture}
      />
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
  const nutrition = result.nutrition ?? {
    calories: result.calories,
    protein_g: result.protein_g,
    carbs_g: result.carbs_g,
    fats_g: result.fats_g,
    fiber_g: result.fiber_g,
    sugar_g: result.sugar_g,
    sodium_mg: result.sodium_mg,
  };

  const items = [
    { label: "Calories", value: nutrition.calories, unit: "kcal", target: profile?.target_calories },
    { label: "Protein", value: nutrition.protein_g, unit: "g", target: profile?.target_protein },
    { label: "Carbs", value: nutrition.carbs_g, unit: "g" },
    { label: "Fats", value: nutrition.fats_g, unit: "g" },
    { label: "Fiber", value: nutrition.fiber_g, unit: "g" },
    { label: "Sugar", value: nutrition.sugar_g, unit: "g" },
    { label: "Sodium", value: nutrition.sodium_mg, unit: "mg" },
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
              {item.value !== null && item.value !== undefined && <span className="ml-1 text-sm font-normal text-muted-foreground">{item.unit}</span>}
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
