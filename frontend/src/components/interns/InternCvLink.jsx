import { ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function InternCvLink({
  cvUrl,
  className,
  showEmptyState = false,
  testId = 'intern-cv-link',
}) {
  if (!cvUrl) {
    if (!showEmptyState) return null;
    return <p className="text-sm text-muted-foreground">No CV uploaded yet.</p>;
  }

  return (
    <Button
      asChild
      variant="outline"
      className={cn('gap-2 border-primary/25 bg-primary/5 hover:bg-primary/10', className)}
      data-test={testId}
    >
      <a href={cvUrl} target="_blank" rel="noopener noreferrer">
        <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
        View CV
        <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
      </a>
    </Button>
  );
}
