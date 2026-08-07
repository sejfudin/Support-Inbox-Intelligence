import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/helpers/initials';

export function InternsPlacedModal({ open, onOpenChange, interns = [] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Interns placed</DialogTitle>
          <DialogDescription>
            Everyone currently placed on a project ({interns.length}).
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {interns.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nobody is placed yet.</p>
          )}
          {interns.map((intern) => (
            <div
              key={intern.recommendationId}
              className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2.5 dark:border-emerald-500/15"
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="bg-emerald-500/15 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                  {getInitials(intern.fullname)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{intern.fullname}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {intern.position || 'Unspecified role'} · {intern.projectName}
                </p>
              </div>
              {intern.placedAt && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {format(new Date(intern.placedAt), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
