import { cn } from '@/lib/utils';

export default function PageHeader({ children, className }) {
  return (
    <header
      className={cn(
        'sticky top-0 z-20 shrink-0 border-b border-border/40 bg-card shadow-elevated-sm',
        className
      )}
    >
      {/* px-12 matches .app-page-content's side gutter so the header lines up with
          the content below it at every breakpoint. */}
      <div className="flex min-h-16 items-center px-12">{children}</div>
    </header>
  );
}
