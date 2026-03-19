import { cn } from "@/lib/utils";

export function PageShell({ children, className }) {
  return <div className={cn("app-page flex min-h-screen flex-col", className)}>{children}</div>;
}

export function PageSection({ children, className }) {
  return <div className={cn("app-page-content", className)}>{children}</div>;
}

export function PagePanel({ children, className }) {
  return <div className={cn("app-panel overflow-hidden", className)}>{children}</div>;
}
