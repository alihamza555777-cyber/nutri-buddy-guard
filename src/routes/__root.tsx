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
import { Leaf, Menu, X, Scan, History, User as UserIcon } from "lucide-react";

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
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
              <NavLink to="/history">History</NavLink>
              <NavLink to="/profile">Profile</NavLink>
            </nav>

            <div className="hidden items-center gap-3 md:flex">
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
                <MobileNavLink to="/history" onClick={() => setMobileMenuOpen(false)}>History</MobileNavLink>
                <MobileNavLink to="/profile" onClick={() => setMobileMenuOpen(false)}>Profile</MobileNavLink>
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
          <Outlet />
        </main>

        <footer className="hidden border-t border-border/60 bg-background py-8 md:block">
          <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
            © {new Date().getFullYear()} NutriGuard. Eat well, stay safe.
          </div>
        </footer>

        <MobileBottomNav />
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

function MobileBottomNav() {
  const { state } = useRouter();
  const pathname = state.location.pathname;

  const tabs = [
    { to: "/", label: "Scan", icon: Scan },
    { to: "/history", label: "History", icon: History },
    { to: "/profile", label: "Profile", icon: UserIcon },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/90 backdrop-blur-md border-t border-slate-200">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
        {tabs.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span className={`text-xs font-medium ${active ? "font-semibold" : ""}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
