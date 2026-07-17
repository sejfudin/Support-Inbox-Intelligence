import { cn } from '@/lib/utils';

export function SymphonyCard({ children, className, variant = 'default' }) {
  let variantClass = 'symphony-card';
  if (variant === 'brand' || variant === 'gradient') variantClass = 'symphony-brand-card';
  else if (variant === 'muted') variantClass = 'symphony-card-muted';

  return <div className={cn(variantClass, 'p-5 md:p-6', className)}>{children}</div>;
}
