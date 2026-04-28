import { cn } from "@/lib/utils";

export default function PageHeader({ children, className }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 shrink-0 border-b border-white/60 bg-white/80",
        className,
      )}
    >
      <div className="flex min-h-16 items-center px-4 sm:px-6 lg:px-8">{children}</div>
    </header>
  );
}
