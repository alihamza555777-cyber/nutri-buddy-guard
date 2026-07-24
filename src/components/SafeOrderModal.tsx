import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateSafeOrderOptions, type SafeOrderResult } from "@/lib/scan.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  CheckCircle2,
  MessageSquare,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  UtensilsCrossed,
  RefreshCw,
  X,
} from "lucide-react";

interface SafeOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  dishName: string;
  flaggedIngredients: string[];
  restrictions: string[];
  customNotes: string;
  safetyLevel: "CAUTION" | "AVOID";
}

export function SafeOrderModal({
  isOpen,
  onClose,
  dishName,
  flaggedIngredients,
  restrictions,
  customNotes,
  safetyLevel,
}: SafeOrderModalProps) {
  const getSafeOptionsFn = useServerFn(generateSafeOrderOptions);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SafeOrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchOptions = async () => {
    if (!dishName) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getSafeOptionsFn({
        data: {
          dishName,
          flaggedIngredients,
          restrictions,
          customNotes,
          safetyLevel,
        },
      });
      setData(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate ordering instructions. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOptions();
    } else {
      setData(null);
      setError(null);
      setCopied(false);
    }
  }, [isOpen, dishName]);

  const handleCopyScript = () => {
    if (!data?.custom_server_script) return;
    navigator.clipboard.writeText(data.custom_server_script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border-border bg-card p-6 pb-20 sm:p-8 md:pb-8 shadow-xl">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                Make It Safe
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                AI kitchen ordering instructions for <span className="font-semibold text-foreground">{dishName}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="my-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
            <p className="mt-4 text-sm font-medium text-foreground">
              Asking NutriGuard AI for safe kitchen modifications…
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tailoring instructions to your dietary profile
            </p>
          </div>
        ) : error ? (
          <div className="my-6 rounded-2xl bg-danger/10 p-5 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-danger" />
            <p className="mt-2 text-sm font-medium text-danger">{error}</p>
            <button
              onClick={fetchOptions}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        ) : data ? (
          <div className="mt-4 space-y-6">
            {/* Kitchen Modifications */}
            <div className="rounded-2xl border border-border bg-background p-5">
              <div className="mb-3 flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-emerald-600" />
                <h4 className="text-sm font-semibold tracking-tight text-foreground">
                  Kitchen Customizations
                </h4>
              </div>
              <ul className="space-y-2.5">
                {data.modifications.map((mod, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                    <span>{mod}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Safe Substitutions */}
            {data.safe_substitutions.length > 0 && (
              <div className="rounded-2xl border border-border bg-background p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-sm font-semibold tracking-tight text-foreground">
                    Recommended Substitutions
                  </h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.safe_substitutions.map((sub, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Server Script */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-sm font-semibold tracking-tight text-foreground">
                    What to say to your server
                  </h4>
                </div>
                <button
                  onClick={handleCopyScript}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-card px-3 py-1 text-xs font-medium text-foreground transition hover:bg-accent"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Copy script</span>
                    </>
                  )}
                </button>
              </div>
              <p className="mt-2 text-sm italic leading-relaxed text-slate-800 dark:text-slate-200">
                "{data.custom_server_script}"
              </p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
