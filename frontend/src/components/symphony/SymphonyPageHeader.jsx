import { SymphonyKicker } from '@/components/symphony/SymphonyKicker';
import { cn } from '@/lib/utils';

export function SymphonyPageHeader({ kicker, title, subtitle, actions, className, children }) {
  return (
    <header className={cn('space-y-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          {kicker && <SymphonyKicker>{kicker}</SymphonyKicker>}
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{title}</h1>
          {subtitle && (
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
