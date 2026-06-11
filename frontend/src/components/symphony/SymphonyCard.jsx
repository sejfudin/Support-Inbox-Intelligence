import { cn } from '@/lib/utils';

export function SymphonyCard({ children, className, variant = 'default' }) {
  const variantClass =
    variant === 'brand' || variant === 'gradient' ? 'symphony-brand-card' : 'symphony-card';

  return (
    <div className={cn(variantClass, 'p-5 md:p-6', className)}>
      {children}
    </div>
  );
}
