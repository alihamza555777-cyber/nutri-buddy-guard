import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Leaf, Menu, X, Scan, ScanLine, History, User as UserIcon, UtensilsCrossed, ShieldAlert, Camera } from "lucide-react";
import { DigitalWaiterCardModal } from "@/components/DigitalWaiterCardModal";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useDailyReset } from "@/hooks/useDailyReset";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-input bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NutriGuard" },
      { name: "description", content: "AI-powered food inspection and nutrition tracking. Spot hidden allergens, check macros, and know what to ask your server." },
      { name: "author", content: "NutriGuard" },
      { property: "og:title", content: "NutriGuard" },
      { property: "og:description", content: "AI-powered food inspection and nutrition tracking. Spot hidden allergens, check macros, and know what to ask your server." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@NutriGuard" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useDailyReset();
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isWaiterCardOpen, setIsWaiterCardOpen] = useState(false);
  const [profileData, setProfileData] = useState<{ dietary_flags?: string[] | null; custom_notes?: string | null } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        if (event !== "SIGNED_OUT") {
          queryClient.invalidateQueries();
        }
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [router, queryClient]);

  useEffect(() => {
    if (user) {
      supabase
        .from("profiles")
        .select("dietary_flags, custom_notes")
        .eq("id", user.id)
        .single()
        .then(({ data }) => setProfileData(data ?? null));
    } else {
      setProfileData(null);
    }
  }, [user]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col bg-background">
        <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link to="/" className="flex items-center gap-2 text-foreground">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Leaf className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold tracking-tight">NutriGuard</span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              <NavLink to="/">Scanner</NavLink>
              <NavLink to="/menu-radar">Menu Radar</NavLink>
              <NavLink to="/history">History</NavLink>
              <NavLink to="/profile">Profile</NavLink>
            </nav>

            <div className="hidden items-center gap-3 md:flex">
              <button
                type="button"
                onClick={() => setIsWaiterCardOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-600 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
              >
                <UtensilsCrossed className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Dining Out Mode
              </button>
              {user ? (
                <button
                  onClick={async () => {
                    await queryClient.cancelQueries();
                    queryClient.clear();
                    await supabase.auth.signOut();
                    router.navigate({ to: "/", replace: true });
                  }}
                  className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Sign out
                </button>
              ) : (
                <Link
                  to="/auth"
                  className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Sign in
                </Link>
              )}
            </div>

            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent md:hidden"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="border-t border-border/60 px-4 py-3 md:hidden">
              <nav className="flex flex-col gap-1">
                <MobileNavLink to="/" onClick={() => setMobileMenuOpen(false)}>Scanner</MobileNavLink>
                <MobileNavLink to="/menu-radar" onClick={() => setMobileMenuOpen(false)}>Menu Radar</MobileNavLink>
                <MobileNavLink to="/history" onClick={() => setMobileMenuOpen(false)}>History</MobileNavLink>
                <MobileNavLink to="/profile" onClick={() => setMobileMenuOpen(false)}>Profile</MobileNavLink>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setIsWaiterCardOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-left text-sm font-bold text-emerald-600 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  <UtensilsCrossed className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Dining Out Mode (Waiter Card)
                </button>
                {user ? (
                  <button
                    onClick={async () => {
                      setMobileMenuOpen(false);
                      await queryClient.cancelQueries();
                      queryClient.clear();
                      await supabase.auth.signOut();
                      router.navigate({ to: "/", replace: true });
                    }}
                    className="mt-2 rounded-xl px-4 py-3 text-left text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    Sign out
                  </button>
                ) : (
                  <Link
                    to="/auth"
                    onClick={() => setMobileMenuOpen(false)}
                    className="mt-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
                  >
                    Sign in
                  </Link>
                )}
              </nav>
            </div>
          )}
        </header>

        <main className="flex-1">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        <footer className="hidden border-t border-border/60 bg-background py-8 md:block">
          <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
            © {new Date().getFullYear()} NutriGuard. Eat well, stay safe.
          </div>
        </footer>

        <MobileBottomNav />

        <DesktopCameraFAB />

        <DigitalWaiterCardModal
          isOpen={isWaiterCardOpen}
          onClose={() => setIsWaiterCardOpen(false)}
          initialRestrictions={profileData?.dietary_flags ?? []}
          initialCustomNotes={profileData?.custom_notes ?? ""}
        />

        <Toaster position="top-right" richColors />
      </div>
    </QueryClientProvider>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeProps={{ className: "bg-accent text-accent-foreground" }}
      inactiveProps={{ className: "text-muted-foreground hover:bg-accent hover:text-accent-foreground" }}
      className="rounded-full px-4 py-2 text-sm font-medium transition-colors"
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ to, onClick, children }: { to: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      activeProps={{ className: "bg-accent text-accent-foreground" }}
      inactiveProps={{ className: "text-muted-foreground hover:bg-accent hover:text-accent-foreground" }}
      className="rounded-xl px-4 py-3 text-sm font-medium transition-colors"
    >
      {children}
    </Link>
  );
}

function DesktopCameraFAB() {
  const { state } = useRouter();
  const pathname = state.location.pathname;
  const isCameraPage = pathname === "/" || pathname === "/menu-radar";

  if (!isCameraPage) return null;

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("nutriguard-open-camera"))}
      className="hidden md:flex fixed bottom-8 right-8 z-50 items-center gap-2.5 rounded-full bg-[#008000] px-5 py-3.5 text-sm font-bold text-white shadow-2xl transition-all hover:scale-105 hover:bg-[#006600] active:scale-95 cursor-pointer border-2 border-white/20"
      title="Instant Camera Scan"
    >
      <Camera className="h-5 w-5 text-white" />
      <span>Instant Camera Scan</span>
    </button>
  );
}

function MobileBottomNav() {
  const { state } = useRouter();
  const pathname = state.location.pathname;
  const isCameraPage = pathname === "/" || pathname === "/menu-radar";

  const triggerCamera = () => {
    window.dispatchEvent(new CustomEvent("nutriguard-open-camera"));
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
        <Link
          to="/"
          className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors ${
            pathname === "/" ? "text-[#008000] font-semibold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Scan className="h-5 w-5" strokeWidth={pathname === "/" ? 2.5 : 2} />
          <span className={`text-xs ${pathname === "/" ? "font-semibold text-[#008000]" : "font-medium"}`}>Scan</span>
        </Link>

        <Link
          to="/menu-radar"
          className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors ${
            pathname === "/menu-radar" ? "text-[#008000] font-semibold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ScanLine className="h-5 w-5" strokeWidth={pathname === "/menu-radar" ? 2.5 : 2} />
          <span className={`text-xs ${pathname === "/menu-radar" ? "font-semibold text-[#008000]" : "font-medium"}`}>Radar</span>
        </Link>

        {/* Elevated Mobile Circular Camera FAB */}
        {isCameraPage && (
          <div className="flex flex-col items-center justify-center relative -top-4 px-1">
            <button
              type="button"
              onClick={triggerCamera}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[#008000] text-white shadow-xl border-4 border-white transition-transform hover:scale-105 hover:bg-[#006600] active:scale-95 cursor-pointer"
              title="Instant Camera Scan"
            >
              <Camera className="h-6 w-6 text-white" />
            </button>
          </div>
        )}

        <Link
          to="/history"
          className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors ${
            pathname === "/history" ? "text-[#008000] font-semibold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="h-5 w-5" strokeWidth={pathname === "/history" ? 2.5 : 2} />
          <span className={`text-xs ${pathname === "/history" ? "font-semibold text-[#008000]" : "font-medium"}`}>History</span>
        </Link>

        <Link
          to="/profile"
          className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors ${
            pathname === "/profile" ? "text-[#008000] font-semibold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserIcon className="h-5 w-5" strokeWidth={pathname === "/profile" ? 2.5 : 2} />
          <span className={`text-xs ${pathname === "/profile" ? "font-semibold text-[#008000]" : "font-medium"}`}>Profile</span>
        </Link>
      </div>
    </nav>
  );
}
