import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SKILL_BAR_PALETTE } from '@/helpers/projects';

// Clicking a technology here does NOT filter the project grid — it closes
// the modal and scrolls to the technology-demand chart, where a bar click
// is the actual filter affordance.
export function SkillsInSelectionModal({ open, onOpenChange, skills = [], onViewInChart }) {
  const max = Math.max(1, ...skills.map((skill) => skill.internCount));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Skills in selection</DialogTitle>
          <DialogDescription>
            Every technology covered by interns currently in selection.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(var(--app-vh)*0.6)] space-y-1 overflow-y-auto pr-1">
          {skills.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No data yet.</p>
          )}
          {skills.map((skill, index) => {
            const color = SKILL_BAR_PALETTE[index % SKILL_BAR_PALETTE.length];
            return (
              <button
                key={skill.technology._id}
                type="button"
                onClick={onViewInChart}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/40"
              >
                <span className="w-24 shrink-0 truncate text-sm font-medium text-foreground">
                  {skill.technology.name}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.max(6, (skill.internCount / max) * 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </span>
                <span
                  className="w-6 shrink-0 text-right text-xs font-bold tabular-nums"
                  style={{ color }}
                >
                  {skill.internCount}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
