import { cn } from '@/lib/utils';
import { SymphonyKicker } from './SymphonyKicker';

export function SymphonyHero({ kicker, title, subtitle, children, className }) {
  return (
    <section className={cn('symphony-hero px-6 py-8 md:px-10 md:py-10', className)}>
      {kicker && (
        <SymphonyKicker className="border-white/25 bg-white/10 text-white/95">
          {kicker}
        </SymphonyKicker>
      )}
      <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
      {subtitle && <p className="mt-3 max-w-2xl text-sm leading-7 text-white/85">{subtitle}</p>}
      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}
