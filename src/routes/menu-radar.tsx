import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { analyzeBatchMenu, type BatchMenuItem } from "@/lib/scan.functions";
import { getProfile } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  ScanLine,
  Upload,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  X,
  Plus,
  ArrowLeft,
  UtensilsCrossed,
} from "lucide-react";
import { BatchMenuResults } from "@/components/BatchMenuResults";
import { SafeOrderModal } from "@/components/SafeOrderModal";
import { CameraViewfinderModal } from "@/components/CameraViewfinderModal";
import { toast } from "sonner";

export const Route = createFileRoute("/menu-radar")({
  head: () => ({
    meta: [
      { title: "Instant Menu Allergen Radar — NutriGuard" },
      {
        name: "description",
        content:
          "Scan an entire restaurant menu page at once. NutriGuard AI extracts every dish, flags allergens, and highlights safe options instantly.",
      },
      { property: "og:title", content: "Instant Menu Allergen Radar — NutriGuard" },
      {
        property: "og:description",
        content:
          "Scan an entire restaurant menu page at once. NutriGuard AI extracts every dish, flags allergens, and highlights safe options instantly.",
      },
    ],
  }),
  component: MenuRadarPage,
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

function MenuRadarPage() {
  const analyzeBatchFn = useServerFn(analyzeBatchMenu);
  const getProfileFn = useServerFn(getProfile);

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [customRestrictionInput, setCustomRestrictionInput] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchMenuItem[] | null>(null);
  const [activeBatchSafeDish, setActiveBatchSafeDish] = useState<BatchMenuItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraViewfinderOpen, setIsCameraViewfinderOpen] = useState(false);
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

  async function executeBatchScanWithImage(base64Data: string) {
    setImageBase64(base64Data);
    setError(null);
    setLoading(true);
    setBatchResults(null);

    try {
      const batchRes = await analyzeBatchFn({
        data: {
          imageBase64: base64Data,
          restrictions,
          customNotes,
        },
      });
      setBatchResults(batchRes.items);
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : "Batch menu analysis failed. Please try again.";
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
    executeBatchScanWithImage(base64Image);
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
      setRestrictions((prev) => {
        const next = [...prev, trimmed];
        saveGuestState(next, customNotes);
        return next;
      });
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateImageFile(file)) return;
    const reader = new FileReader();
    reader.onloadend = () => setImageBase64(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleBatchScan(e: React.FormEvent) {
    e.preventDefault();
    if (!imageBase64) {
      const msg = "Please upload a photo of a menu page first.";
      setError(msg);
      toast.error(msg);
      return;
    }

    setError(null);
    setLoading(true);
    setBatchResults(null);

    try {
      const batchRes = await analyzeBatchFn({
        data: {
          imageBase64,
          restrictions,
          customNotes,
        },
      });
      setBatchResults(batchRes.items);
    } catch (err: any) {
      const errMsg = err?.message || "Batch menu analysis failed. Please try again.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 pb-24 sm:px-6 md:pb-12 lg:px-8">
      {/* Back to Home Link */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Single Scanner
        </Link>
      </div>

      {/* Hero Header */}
      <div className="rounded-[2rem] bg-gradient-to-br from-emerald-50 via-slate-50 to-white p-6 border border-emerald-100/80 shadow-xs sm:p-10 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-950 dark:border-emerald-900/40">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#008000] text-white shadow-sm">
            <ScanLine className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              Instant Menu Allergen Radar
            </h1>
            <p className="mt-1 text-xs font-medium text-slate-600 sm:text-sm dark:text-slate-400">
              Batch Menu Scanner powered by Groq AI (Llama 3)
            </p>
          </div>
        </div>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          Upload a photo of an entire restaurant menu page. NutriGuard extracts every dish, checks ingredients against your allergies, and displays a color-coded safety list instantly.
        </p>
      </div>

      {/* Scanner Box */}
      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <form onSubmit={handleBatchScan}>
          {/* Upload Area */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-semibold text-slate-900 dark:text-white">
              Menu Page Photo
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center transition-all hover:bg-emerald-50/50 hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
            >
              {imageBase64 ? (
                <img
                  src={imageBase64}
                  alt="Selected menu page"
                  className="mb-4 max-h-64 w-full rounded-xl object-contain shadow-xs"
                />
              ) : (
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-[#008000] dark:bg-emerald-950 dark:text-emerald-400">
                  <Upload className="h-7 w-7" />
                </div>
              )}
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {imageBase64 ? "Tap to change menu photo" : "Upload Full Menu Page Photo"}
              </span>
              <span className="mt-1 text-xs text-slate-500">
                Supports clear photos of menu pages (PNG, JPG, WEBP up to 10MB)
              </span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Active Restrictions */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-semibold text-slate-900 dark:text-white">
              Target Restrictions & Allergies
            </label>

            <div className="flex flex-wrap gap-2">
              {RESTRICTION_OPTIONS.map((name) => {
                const active = restrictions.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleRestriction(name)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "bg-[#008000] text-white shadow-xs"
                        : "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}

              {/* Custom pills */}
              {restrictions
                .filter((r) => !RESTRICTION_OPTIONS.includes(r))
                .map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#008000] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs"
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

            {/* Inline Custom Input */}
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
                className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-900 outline-none ring-[#008000] focus:ring-2 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
              <button
                type="button"
                onClick={handleAddCustomRestriction}
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-[#008000]/20 bg-[#008000]/10 px-3.5 text-xs font-semibold text-[#008000] transition-all hover:bg-[#008000]/20"
              >
                <Plus className="h-3.5 w-3.5 text-[#008000]" />
                <span>Add Custom</span>
              </button>
            </div>
          </div>

          {/* Custom Medical Notes */}
          <div className="mb-6">
            <label htmlFor="notes" className="mb-2 block text-sm font-semibold text-slate-900 dark:text-white">
              Special Medical & Kitchen Notes
            </label>
            <textarea
              id="notes"
              value={customNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="e.g., Severe celiac disease, strict cross-contamination risk"
              rows={2}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 outline-none ring-[#008000] focus:ring-2 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          {error && (
            <div className="mb-4 rounded-2xl bg-rose-50 p-4 text-xs font-semibold text-rose-800 border border-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#008000] py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-[#006600] disabled:opacity-70 sm:w-auto sm:px-10"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Scanning Menu Page with Radar...</span>
              </>
            ) : (
              <>
                <ScanLine className="h-5 w-5" />
                <span>Scan Full Menu Page with Radar</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Batch Results View */}
      {batchResults && (
        <BatchMenuResults
          items={batchResults}
          onMakeItSafe={(dish) => setActiveBatchSafeDish(dish)}
          onResetScan={() => {
            setBatchResults(null);
            setImageBase64(null);
          }}
        />
      )}

      {/* Batch SafeOrderModal */}
      {activeBatchSafeDish && (
        <SafeOrderModal
          isOpen={!!activeBatchSafeDish}
          onClose={() => setActiveBatchSafeDish(null)}
          dishName={activeBatchSafeDish.dish_name}
          flaggedIngredients={activeBatchSafeDish.detected_allergens}
          restrictions={restrictions}
          customNotes={customNotes}
          safetyLevel={activeBatchSafeDish.safety_level === "AVOID" ? "AVOID" : "CAUTION"}
        />
      )}

      <CameraViewfinderModal
        isOpen={isCameraViewfinderOpen}
        onClose={() => setIsCameraViewfinderOpen(false)}
        onCapture={handleWebcamCapture}
      />
    </div>
  );
}
