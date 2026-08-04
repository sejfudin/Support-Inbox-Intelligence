import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { getInitials } from '@/helpers/initials';
import { cn } from '@/lib/utils';

const STAGE_THEME = {
  recommended: {
    panel: 'border-[hsl(var(--symphony-brand)/0.2)] bg-[hsl(var(--symphony-brand)/0.05)]',
    dot: 'bg-[hsl(var(--symphony-brand))]',
    avatar:
      'bg-[hsl(var(--symphony-brand)/0.15)] text-[hsl(var(--symphony-brand-strong))] dark:text-[hsl(var(--symphony-brand))]',
    badge: 'default',
  },
  interviewing: {
    panel: 'border-amber-500/25 bg-amber-500/[0.05]',
    dot: 'bg-amber-500',
    avatar: 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    badge: 'warning',
  },
};

function SelectionColumn({ stage, title, interns }) {
  const theme = STAGE_THEME[stage];
  return (
    <div className={cn('rounded-xl border p-3', theme.panel)}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', theme.dot)} />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <Badge variant={theme.badge}>{interns.length}</Badge>
      </div>
      {interns.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 py-6 text-center text-xs text-muted-foreground">
          No one {title.toLowerCase()} right now.
        </p>
      ) : (
        <div className="space-y-2">
          {interns.map((intern) => (
            <div
              key={intern.recommendationId}
              className="flex items-center gap-2.5 rounded-lg bg-background/60 px-2.5 py-2"
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className={cn('text-[11px] font-semibold', theme.avatar)}>
                  {getInitials(intern.fullname)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{intern.fullname}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {intern.position || 'Unspecified role'} · {intern.projectName}
                  {intern.projectClient ? ` (${intern.projectClient})` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function InSelectionModal({ open, onOpenChange, recommended = [], interviewing = [] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>In selection</DialogTitle>
          <DialogDescription>
            Interns currently being pitched — recommended or interviewing.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
          <SelectionColumn stage="recommended" title="Recommended" interns={recommended} />
          <SelectionColumn stage="interviewing" title="Interviewing" interns={interviewing} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
