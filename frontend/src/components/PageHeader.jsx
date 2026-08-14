import { cn } from '@/lib/utils';

// `compact` is for pages with no header content of their own — the bar would
// otherwise be a full-height, full-width strip holding nothing but the bell.
export default function PageHeader({ children, className, compact = false }) {
  return (
    <header
      className={cn(
        'sticky top-0 z-20 shrink-0 border-b border-border/40 bg-card shadow-elevated-sm',
        className
      )}
    >
      {/* px-12 matches .app-page-content's side gutter so the header lines up with
          the content below it at every breakpoint — skipped in compact mode, which
          only ever holds the right-aligned bell. */}
      <div className={cn('flex items-center', compact ? 'min-h-12 px-4' : 'min-h-16 px-12')}>
        {children}
      </div>
    </header>
  );
}
