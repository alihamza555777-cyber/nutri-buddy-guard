import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  analyzeFood,
  saveScan,
  type ScanResult,
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
  AlertCircle,
  ScanLine,
} from "lucide-react";
import heroFood from "@/assets/hero-food.png";
import { SafeOrderModal } from "@/components/SafeOrderModal";
import { DailyBudgetDashboard } from "@/components/DailyBudgetDashboard";
import { DigitalWaiterCardModal } from "@/components/DigitalWaiterCardModal";
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

  /**
   * Persists a scan record to Supabase `scan_history` table.
   * This function NEVER throws — all errors are handled internally with toasts.
   */
  async function persistScanRecord(
    currentUser: SupabaseUser,
    inputType: "text" | "image",
    scanResult: ScanResult,
    imageFileObj?: File | null
  ) {
    try {
      // ── STEP 1: Refresh session to get a valid JWT ──
      let verifiedUserId = currentUser.id;
      let accessToken: string | undefined;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          verifiedUserId = sessionData.session.user.id;
          accessToken = sessionData.session.access_token;
        }
      } catch (sessionErr) {
        console.warn("[NutriGuard] Session refresh threw (using cached user):", sessionErr);
      }

      if (!verifiedUserId) {
        toast.info("Session expired — please sign in again to save scans.");
        return;
      }

      console.log("[NutriGuard] Save: userId =", verifiedUserId, "| hasToken =", !!accessToken);

      // ── STEP 2: Upload image (non-fatal) ──
      let imageUrl: string | null = null;
      if (imageFileObj) {
        try {
          const path = `${verifiedUserId}/${Date.now()}-${imageFileObj.name}`;
          const { data: upData, error: upErr } = await supabase.storage
            .from("scan-images")
            .upload(path, imageFileObj);
          if (!upErr && upData) {
            const { data: signed } = await supabase.storage
              .from("scan-images")
              .createSignedUrl(upData.path, 60 * 60 * 24 * 365);
            imageUrl = signed?.signedUrl ?? upData.path;
          }
        } catch {}
      }

      // ── STEP 3: Build payload matching scan_history.Insert exactly ──
      const rawStatus =
        (scanResult as any).safety_status ||
        scanResult.safety_level ||
        (scanResult as any).safetyStatus ||
        (scanResult as any).status ||
        "CAUTION";
      const resolvedSafetyStatus = String(rawStatus).toUpperCase();
      const validSafetyStatus = ["SAFE", "CAUTION", "AVOID"].includes(resolvedSafetyStatus)
        ? resolvedSafetyStatus
        : "CAUTION";

      const n = scanResult.nutrition || (scanResult as any).nutrition || {};
      const payload = {
        user_id: verifiedUserId,
        dish_name: String(scanResult.dish_name || (scanResult as any).dishName || "Unknown Dish"),
        input_type: String(inputType),
        safety_level: validSafetyStatus,
        calories: typeof scanResult.calories === "number" ? scanResult.calories : (typeof n.calories === "number" ? n.calories : null),
        protein_g: typeof scanResult.protein_g === "number" ? scanResult.protein_g : (typeof n.protein_g === "number" ? n.protein_g : null),
        carbs_g: typeof scanResult.carbs_g === "number" ? scanResult.carbs_g : (typeof n.carbs_g === "number" ? n.carbs_g : null),
        fats_g: typeof scanResult.fats_g === "number" ? scanResult.fats_g : (typeof n.fats_g === "number" ? n.fats_g : null),
        fiber_g: typeof scanResult.fiber_g === "number" ? scanResult.fiber_g : (typeof n.fiber_g === "number" ? n.fiber_g : null),
        sugar_g: typeof scanResult.sugar_g === "number" ? scanResult.sugar_g : (typeof n.sugar_g === "number" ? n.sugar_g : null),
        sodium_mg: typeof scanResult.sodium_mg === "number" ? scanResult.sodium_mg : (typeof n.sodium_mg === "number" ? n.sodium_mg : null),
        flagged_ingredients: Array.isArray(scanResult.flagged_ingredients)
          ? scanResult.flagged_ingredients
          : (Array.isArray((scanResult as any).flaggedIngredients) ? (scanResult as any).flaggedIngredients : []),
        explanation: String(scanResult.explanation || (scanResult as any).summary || ""),
        waiter_question: String(scanResult.server_question || (scanResult as any).serverQuestion || scanResult.waiter_question || ""),
        image_url: imageUrl,
      };

      // Explicit pre-insert validation
      if (!payload.safety_status) {
        console.error("Missing safety_status in payload:", payload);
        payload.safety_status = "CAUTION";
        payload.safety_level = "CAUTION";
      }

      console.log("[NutriGuard] INSERT payload:", JSON.stringify(payload));

      // ── STEP 4: Direct client-side insert ──
      const { error: dbError } = await supabase.from("scan_history").insert(payload);

      if (!dbError) {
        console.log("[NutriGuard] ✅ Direct insert succeeded!");
        queryClient.invalidateQueries({ queryKey: ["today-summary"] });
        queryClient.invalidateQueries({ queryKey: ["scan-history"] });
        toast.success("Scan saved to your history!");
        return;
      }

      // ── STEP 5: Direct insert failed — log and try fallback ──
      console.error("[NutriGuard] ❌ Direct INSERT error:", dbError.code, dbError.message, dbError.details, dbError.hint);

      try {
        const headers: Record<string, string> = {};
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
        await save({ data: { inputType, imageUrl, result: scanResult }, headers });
        console.log("[NutriGuard] ✅ Server fallback succeeded!");
        queryClient.invalidateQueries({ queryKey: ["today-summary"] });
        queryClient.invalidateQueries({ queryKey: ["scan-history"] });
        toast.success("Scan saved to your history!");
        return;
      } catch (fbErr) {
        console.error("[NutriGuard] ❌ Server fallback also failed:", fbErr);
      }

      // Both paths failed — show the specific DB error
      toast.error(`Save failed [${dbError.code}]: ${dbError.message}`);

    } catch (fatalError: any) {
      // This catches ANY unexpected throw from the entire function body
      const msg = fatalError?.message || String(fatalError);
      console.error("[NutriGuard] 💀 FATAL persistScanRecord error:", msg, fatalError);
      toast.error(`Scan save error: ${msg}`);
    }
  }

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
        // persistScanRecord handles ALL its own errors internally — never throws
        await persistScanRecord(currentUser, "image", data, fileObj);
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
        // persistScanRecord handles ALL its own errors internally — never throws
        await persistScanRecord(currentUser, tab, data, imageFile);
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

  const saveGuestState = useCallback((newRestrictions: string[], newNotes: string) => {
    try {
      localStorage.setItem(GUEST_RESTRICTIONS_KEY, JSON.stringify(newRestrictions));
      localStorage.setItem(GUEST_NOTES_KEY, newNotes);
    } catch {}
  }, []);

  const toggleRestriction = useCallback((name: string) => {
    setRestrictions((prev) => {
      const next = prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name];
      saveGuestState(next, customNotes);
      return next;
    });
  }, [customNotes, saveGuestState]);

  const handleAddCustomRestriction = useCallback(() => {
    const trimmed = customRestrictionInput.trim();
    if (!trimmed) return;
    setRestrictions((prev) => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed];
      saveGuestState(next, customNotes);
      return next;
    });
    setCustomRestrictionInput("");
  }, [customRestrictionInput, customNotes, saveGuestState]);

  const removeCustomRestriction = useCallback((name: string) => {
    setRestrictions((prev) => {
      const next = prev.filter((r) => r !== name);
      saveGuestState(next, customNotes);
      return next;
    });
  }, [customNotes, saveGuestState]);

  const handleNotesChange = useCallback((value: string) => {
    setCustomNotes(value);
    saveGuestState(restrictions, value);
  }, [restrictions, saveGuestState]);

  return (
    <div className="mx-auto max-w-6xl w-full max-w-full px-4 py-8 pb-28 sm:px-6 md:pb-12 lg:px-8 overflow-x-hidden box-border">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-secondary to-background p-6 sm:p-10 lg:p-16 border border-border/40 shadow-xs">
        <div className="relative z-10 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-tight break-words">
              Eat out with <span className="text-primary">confidence</span>
            </h1>
            <p className="mt-4 max-w-lg text-base sm:text-lg text-muted-foreground leading-relaxed">
              Snap a menu photo or type a dish name. NutriGuard checks for hidden allergens,
              breaks down nutrition, and tells you exactly what to ask your server.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3 w-full">
              {!user && (
                <Link
                  to="/auth"
                  className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary/90 active:scale-95"
                >
                  Sign in to save scans
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              )}
              <button
                type="button"
                onClick={() => setIsWaiterModalOpen(true)}
                className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center rounded-full border border-emerald-200/80 bg-emerald-50 px-6 py-3 text-sm font-bold text-emerald-600 shadow-xs transition-all duration-150 hover:bg-emerald-100 active:scale-95 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 cursor-pointer"
              >
                <Utensils className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Dining Out Mode (Waiter Card)
              </button>
              <Link
                to="/profile"
                className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center rounded-full border border-input bg-background px-6 py-3 text-sm font-medium text-foreground transition-all duration-150 hover:bg-accent active:scale-95"
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
              className="rounded-3xl object-cover shadow-lg w-full max-w-full"
            />
          </div>
        </div>
      </section>

      {/* Daily Budget Dashboard */}
      <section className="mt-8 sm:mt-10">
        <DailyBudgetDashboard userId={user?.id} />
      </section>

      {/* Scanner card */}
      <section className="mt-8 sm:mt-10">
        <div className="w-full max-w-full rounded-3xl border border-border bg-card p-5 sm:p-8 shadow-sm overflow-hidden">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-card-foreground">Food scanner</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {user ? "Signed in — your scans will be saved." : "Signed out — scans won't be saved."}
              </p>
            </div>
          </div>

          <form onSubmit={handleAnalyze}>
            <div className="mb-6 flex w-full sm:w-auto sm:inline-flex rounded-2xl sm:rounded-full bg-muted p-1 gap-1">
              <button
                type="button"
                onClick={() => {
                  setTab("text");
                  setResult(null);
                }}
                className={`flex-1 sm:flex-initial inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl sm:rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-95 ${
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
                className={`flex-1 sm:flex-initial inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl sm:rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-95 ${
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
                  className="w-full min-h-[44px] rounded-2xl border border-input bg-background px-4 py-3 text-sm sm:text-base text-foreground outline-none ring-ring focus:ring-2 transition-all"
                />
              </div>
            ) : (
              <div className="mb-6 space-y-4">
                <div className="flex flex-wrap items-center gap-3 w-full">
                  {/* Primary Open Live Camera Button */}
                  <button
                    type="button"
                    onClick={() => setIsCameraViewfinderOpen(true)}
                    className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[#008000] px-5 py-3 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-[#006600] active:scale-95 cursor-pointer"
                  >
                    <Camera className="h-4 w-4 text-white" />
                    <span>📷 Open Live Camera</span>
                  </button>

                  {/* Upload Photo Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition-all duration-150 hover:bg-slate-200 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
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
                      className="absolute top-4 right-4 rounded-full bg-slate-900/80 p-2 text-white backdrop-blur-xs transition hover:bg-slate-900 active:scale-95 cursor-pointer"
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
                    className={`inline-flex min-h-[38px] items-center justify-center rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all duration-150 active:scale-95 cursor-pointer ${
                      restrictions.includes(name)
                        ? "bg-primary text-primary-foreground shadow-xs"
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
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-[#008000] px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-xs"
                    >
                      <span>{name}</span>
                      <button
                        type="button"
                        onClick={() => removeCustomRestriction(name)}
                        className="rounded-full p-1 transition hover:bg-[#006600] active:scale-90 cursor-pointer"
                        title="Remove restriction"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
              </div>

              {/* Refactored Non-Overflowing Custom Allergen Input */}
              <div className="mt-3 flex flex-wrap sm:flex-nowrap items-center gap-2 w-full max-w-md">
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
                  className="flex-1 min-w-[180px] w-full min-h-[44px] rounded-full border border-input bg-background px-4 py-2.5 text-xs sm:text-sm text-foreground outline-none ring-ring focus:ring-2 transition-all"
                />
                <button
                  type="button"
                  onClick={handleAddCustomRestriction}
                  className="inline-flex min-h-[44px] h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#008000]/20 bg-[#008000]/10 px-5 text-xs sm:text-sm font-bold text-[#008000] transition-all duration-150 hover:bg-[#008000]/20 active:scale-95 cursor-pointer"
                >
                  <Plus className="h-4 w-4 text-[#008000]" />
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
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none ring-ring focus:ring-2 transition-all min-h-[80px]"
              />
            </div>

            {error && (
              <div className="mb-4 rounded-xl bg-danger/10 p-3 text-sm font-medium text-danger">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-[48px] h-12 w-full sm:w-auto items-center justify-center rounded-full bg-[#008000] px-8 py-3.5 text-base font-bold text-white shadow-md transition-all duration-150 hover:bg-[#006600] active:scale-95 disabled:opacity-70 cursor-pointer"
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
          <section className="mt-8 sm:mt-10 space-y-6">
            <div className="w-full max-w-full rounded-3xl border border-border bg-card p-5 sm:p-8 shadow-sm overflow-hidden">
              <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-card-foreground break-words">{result.dish_name}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">AI inspection result</p>
                </div>
                <SafetyBadge level={result.safety_level} />
              </div>

              <p className="mt-6 text-foreground leading-relaxed text-sm sm:text-base">{result.explanation}</p>

              {relevantFlaggedIngredients.length > 0 && (
                <div className="mt-6 rounded-2xl bg-danger/10 p-4 sm:p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-danger">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Flagged ingredients
                  </h4>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {relevantFlaggedIngredients.map((ing) => (
                      <span
                        key={ing}
                        className="rounded-full bg-danger/20 px-3 py-1 text-xs sm:text-sm font-semibold text-danger"
                      >
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 rounded-2xl bg-info/10 p-4 sm:p-5">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-info-foreground">
                  <Leaf className="h-4 w-4 shrink-0" />
                  Ask your server
                </h4>
                <p className="mt-2 text-sm sm:text-base text-info-foreground leading-relaxed">{result.server_question || result.waiter_question}</p>
              </div>

              {result.make_it_safe_instructions && result.make_it_safe_instructions.length > 0 && (
                <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 sm:p-5 dark:border-emerald-500/30 dark:bg-emerald-950/40">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    Make It Safe Instructions
                  </h4>
                  <ul className="mt-2 space-y-1.5 list-disc list-inside text-sm text-foreground leading-relaxed">
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
                    className="inline-flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#008000] px-6 py-3.5 text-base font-bold text-white shadow-md transition-all duration-150 hover:bg-[#006600] hover:shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#008000] focus:ring-offset-2 sm:w-auto cursor-pointer"
                  >
                    <Sparkles className="h-5 w-5 shrink-0" />
                    <span>Make It Safe — AI Ordering Instructions</span>
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
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-bold shadow-xs ${styles[level]}`}>
      <Icon className="h-4 w-4 shrink-0" />
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
    <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
      {items.map((item) => {
        const pct = item.value && item.target ? Math.min(100, Math.round((item.value / item.target) * 100)) : null;
        return (
          <div
            key={item.label}
            className="rounded-2xl border border-border bg-card p-3.5 sm:p-5 transition-all duration-150 hover:bg-accent/30 flex flex-col justify-between"
          >
            <div>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-xl sm:text-2xl font-bold text-card-foreground tracking-tight">
                {item.value ?? "—"}
                {item.value !== null && item.value !== undefined && <span className="ml-1 text-xs font-normal text-muted-foreground">{item.unit}</span>}
              </p>
            </div>
            {pct !== null && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
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
