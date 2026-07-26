import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Leaf, Loader2, Mail, Lock, Eye, EyeOff, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — NutriGuard" },
      { name: "description", content: "Sign in to NutriGuard to save your dietary profile and scan history." },
      { property: "og:title", content: "Sign in — NutriGuard" },
      { property: "og:description", content: "Sign in to NutriGuard to save your dietary profile and scan history." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.navigate({ to: "/", replace: true });
      }
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const NAME_REGEX = /^[a-zA-Z\s'\-]+$/;
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Pre-submission validation checks
    if (mode === "signup") {
      if (!trimmedName || trimmedName.length > 50 || !NAME_REGEX.test(trimmedName)) {
        const err = "Full Name must be 50 characters or fewer and contain valid name characters.";
        setError(err);
        toast.error(err);
        return;
      }
    }

    if (!trimmedEmail || trimmedEmail.length > 254 || !EMAIL_REGEX.test(trimmedEmail)) {
      const err = "Please enter a valid email address (e.g., name@example.com).";
      setError(err);
      toast.error(err);
      return;
    }

    if (!password || password.length < 6 || password.length > 14) {
      const err = "Password must be between 6 and 14 characters long.";
      setError(err);
      toast.error(err);
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: trimmedName,
            },
          },
        });
        if (error) throw error;
        const msg = "Check your email to confirm your account.";
        setMessage(msg);
        toast.success(msg);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) throw error;
        toast.success("Signed in successfully!");
        router.navigate({ to: "/", replace: true });
      }
    } catch (err: any) {
      console.error("Auth submit error:", err);
      let friendlyMessage = err?.message || "Authentication failed. Please try again.";
      const raw = String(err?.message || "").toLowerCase();

      if (raw.includes("invalid login credentials") || raw.includes("invalid credentials")) {
        friendlyMessage = "Invalid email or password";
      } else if (raw.includes("user already registered") || raw.includes("already exists")) {
        friendlyMessage = "An account with this email already exists";
      } else if (raw.includes("password") && (raw.includes("weak") || raw.includes("least"))) {
        friendlyMessage = "Password is too weak. Please use at least 6 characters.";
      }

      setError(friendlyMessage);
      toast.error(friendlyMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center w-full max-w-full px-4 py-8 pb-28 md:pb-12 box-border">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm overflow-hidden">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Leaf className="h-6 w-6" />
          </div>
          <span className="text-2xl font-bold text-card-foreground">NutriGuard</span>
        </div>

        <h1 className="text-center text-xl sm:text-2xl font-semibold tracking-tight text-card-foreground">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-center text-xs sm:text-sm text-muted-foreground">
          {mode === "signin"
            ? "Sign in to save scans and manage your dietary profile."
            : "Start eating safer with personalized AI food checks."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {mode === "signup" && (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label htmlFor="fullName" className="text-sm font-medium text-card-foreground">
                  Full Name
                </label>
                <span className="text-xs text-muted-foreground font-mono">{fullName.length}/50</span>
              </div>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="fullName"
                  type="text"
                  required
                  maxLength={50}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full min-h-[44px] rounded-2xl border border-input bg-background py-3 pl-10 pr-4 text-sm sm:text-base text-foreground outline-none ring-ring focus:ring-2 transition-all"
                  placeholder="Jane Doe"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Max 50 characters (letters, spaces, hyphens, apostrophes)</p>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label htmlFor="email" className="text-sm font-medium text-card-foreground">
                Email
              </label>
              <span className="text-xs text-muted-foreground font-mono">{email.length}/254</span>
            </div>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="email"
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-[44px] rounded-2xl border border-input bg-background py-3 pl-10 pr-4 text-sm sm:text-base text-foreground outline-none ring-ring focus:ring-2 transition-all"
                placeholder="you@example.com"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Standard email format (e.g. name@example.com)</p>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label htmlFor="password" className="text-sm font-medium text-card-foreground">
                Password
              </label>
              <span className="text-xs text-muted-foreground font-mono">{password.length}/14</span>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                maxLength={14}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[44px] rounded-2xl border border-input bg-background py-3 pl-10 pr-10 text-sm sm:text-base text-foreground outline-none ring-ring focus:ring-2 transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground active:scale-90 transition-all"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">Must be between 6 and 14 characters long</p>
          </div>

          {error && (
            <div className="rounded-xl bg-danger/10 p-3 text-sm font-medium text-danger">{error}</div>
          )}
          {message && (
            <div className="rounded-xl bg-success/10 p-3 text-sm font-medium text-success">{message}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-[48px] h-12 w-full items-center justify-center rounded-full bg-primary py-3.5 text-base font-bold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary/90 active:scale-95 disabled:opacity-70 cursor-pointer"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "signin" ? "signup" : "signin"));
              setError(null);
              setMessage(null);
            }}
            className="font-medium text-primary hover:underline"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>

        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to scanner
          </Link>
        </div>
      </div>
    </div>
  );
}
