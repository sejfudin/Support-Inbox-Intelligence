import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { getSelectionStageTheme } from '@/helpers/projects';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/user-avatar';

function SelectionColumn({ stage, title, interns }) {
  const theme = getSelectionStageTheme(stage);
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
              <UserAvatar
                user={intern}
                className={cn('h-8 w-8 text-[11px] font-semibold', theme.avatar)}
                showTitle={false}
              />
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
