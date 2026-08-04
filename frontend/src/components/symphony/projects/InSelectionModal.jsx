import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function SelectionSection({ title, interns }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{interns.length}</span>
      </div>
      {interns.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 py-4 text-center text-xs text-muted-foreground">
          No one {title.toLowerCase()} right now.
        </p>
      ) : (
        <div className="space-y-2">
          {interns.map((intern) => (
            <div
              key={intern.recommendationId}
              className="rounded-lg border border-border/60 px-3 py-2.5"
            >
              <p className="text-sm font-medium text-foreground">{intern.fullname}</p>
              <p className="text-xs text-muted-foreground">
                {intern.position || 'Unspecified role'} · {intern.projectName}
                {intern.projectClient ? ` (${intern.projectClient})` : ''}
              </p>
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>In selection</DialogTitle>
          <DialogDescription>
            Interns currently being pitched — recommended or interviewing.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          <SelectionSection title="Recommended" interns={recommended} />
          <SelectionSection title="Interviewing" interns={interviewing} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
