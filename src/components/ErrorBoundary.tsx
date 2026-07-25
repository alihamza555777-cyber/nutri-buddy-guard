import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled React Error Boundary caught an exception:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-danger/10 text-danger border border-danger/20">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground">
            Oops! Something went wrong loading this view
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            An unexpected application error occurred. Don't worry, your profile data and scan history are safe.
          </p>
          {this.state.error?.message && (
            <div className="mt-4 rounded-2xl bg-accent/50 border border-border p-3 text-xs text-muted-foreground font-mono max-w-lg overflow-auto">
              {this.state.error.message}
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-input bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <Home className="h-4 w-4" />
              Return Home
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
