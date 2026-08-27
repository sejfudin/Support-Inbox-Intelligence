import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { PagePanel } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { TechnologyIcon } from '@/helpers/technologyIcons';
import { ReadinessLevelBadge } from '@/components/interns/ReadinessLevelBadge';
import { getReadinessLabel, isAssessedLevel, UNASSESSED_LEVEL } from '@/helpers/internProfile';
import { useMyDeclaredTechnologies } from '@/hooks/useMyDeclaredTechnologies';
import { useUpdateMyTechnologies } from '@/queries/interns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import PanelBodySkeleton from '@/components/Skeletons/PanelBodySkeleton';
import { LoadingOverlay } from '@/components/ui/loader';

// The chip column is fixed rather than auto so every level reads down one edge —
// "Not assessed" is the widest label and would otherwise drag the chips of the
// rows around it out of alignment. Below `sm` the rail is too narrow for that, so
// the chip collapses to its own width against the remove button.
// The name track carries a 180px floor from `sm` up, where the assessment column
// is a fixed 150px: without it the two fixed tracks can starve the label to zero
// on a narrow rail and the technology name runs under its own chip. Below `sm`
// the chip is `auto` and yields first, so the floor would only force a scrollbar.
const ROW_CLASS =
  'grid grid-cols-[minmax(0,1fr)_auto_26px] items-center gap-3 border-b border-separator p-[var(--row-pad)] transition-colors last:border-b-0 hover:bg-accent/60 sm:grid-cols-[minmax(180px,1fr)_150px_26px]';

const BODY_MESSAGE_CLASS = 'px-[18px] py-[15px] text-[12.5px] text-muted-foreground';

export function InternTechnologyDeclaration({ className }) {
  const { allTechnologies, declaredIds, declaredTechnologies, flagMap, isLoadingTechnologies } =
    useMyDeclaredTechnologies();
  const { mutate: saveTechnologies, isPending: isSaving } = useUpdateMyTechnologies();

  // `{ tech, level }` for the row the ✕ was pressed on, held until the intern
  // confirms — see `requestRemoval` for which rows get that far. The level rides
  // along because the dialog names it, and re-reading `flagMap` while the dialog is
  // open would let the sentence change under a refetch.
  const [pendingRemoval, setPendingRemoval] = useState(null);

  const addTechnology = (tech) => {
    const newIds = [...declaredIds, tech._id];
    saveTechnologies(newIds, {
      onSuccess: () => toast.success(`${tech.name} added`),
      onError: (err) => toast.error(err?.response?.data?.message || 'Failed to add technology'),
    });
  };

  const removeTechnology = (tech) => {
    const newIds = [...declaredIds].filter((id) => id !== tech._id);
    saveTechnologies(newIds, {
      onSuccess: () => {
        setPendingRemoval(null);
        toast.success(`${tech.name} removed`);
      },
      onError: (err) => toast.error(err?.response?.data?.message || 'Failed to remove technology'),
    });
  };

  /**
   * Confirmation is for the rows where removal actually costs something — one a
   * mentor has already assessed (Learning or Ready). An unassessed row is the
   * intern's own note-to-self and nothing else, so it goes straight out: making
   * them confirm all thirty of those is how a dialog becomes a keystroke people
   * learn to click through, which is exactly how it stops protecting the few rows
   * that matter.
   */
  const requestRemoval = (tech, level) => {
    if (isAssessedLevel(level)) {
      setPendingRemoval({ tech, level });
      return;
    }
    removeTechnology(tech);
  };

  return (
    <PagePanel className={className}>
      {/* Adding a technology is the same act as maintaining the list, so the search
          sits in this card's header band instead of in a panel of its own above it —
          that second panel is what the redesign removed. */}
      <div className="flex flex-col gap-3 border-b border-separator px-[18px] pb-[13px] pt-[14px] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="app-card-title">My technologies</h2>
          <p className="mt-0.5 text-[12.5px] leading-[1.45] text-muted-foreground">
            Your mentor assesses your readiness for each.
          </p>
        </div>

        <div className="relative w-full shrink-0 sm:w-[250px]">
          <Search
            className="pointer-events-none absolute left-[11px] top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/75"
            aria-hidden="true"
          />
          <SearchableSelect
            items={allTechnologies}
            onSelect={addTechnology}
            filter={(tech, q) => tech.name.toLowerCase().includes(q)}
            isSelected={(tech) => declaredIds.has(tech._id)}
            keepOpenOnSelect
            openOnFocus
            renderItem={(tech) => (
              <span className="flex items-center gap-2 font-medium">
                <TechnologyIcon technology={tech} size={16} className="shrink-0" />
                {tech.name}
              </span>
            )}
            getItemDataTest={(tech) => `technology-add-${tech.slug}-button`}
            placeholder={isSaving ? 'Saving…' : 'Add a technology…'}
            emptyMessage="No technologies found."
            busy={isSaving}
            disabled={isSaving || isLoadingTechnologies}
            dataTest="technology-search-input"
            inputClassName="h-[34px] rounded-[var(--r-control)] pl-[34px] text-[12.5px]"
          />
        </div>
      </div>

      {isLoadingTechnologies ? (
        <LoadingOverlay size="sm" label="Loading technologies">
          <PanelBodySkeleton rows={3} className="px-[18px] pb-5" />
        </LoadingOverlay>
      ) : declaredTechnologies.length === 0 ? (
        <p className={BODY_MESSAGE_CLASS}>
          No technologies yet. Search above to add the ones you are working toward.
        </p>
      ) : (
        <ul>
          {declaredTechnologies.map((tech) => {
            const level = flagMap[tech._id]?.level || UNASSESSED_LEVEL;
            return (
              <li key={tech._id} className={ROW_CLASS}>
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[var(--r-tile)] bg-muted">
                    <TechnologyIcon technology={tech} size={13} />
                  </span>
                  <span className="truncate text-[13px] font-medium text-foreground">
                    {tech.name}
                  </span>
                </span>
                <ReadinessLevelBadge
                  level={level}
                  className="justify-self-end rounded-full border-transparent px-[9px] py-[3px] text-[11px] sm:justify-self-start"
                />
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => requestRemoval(tech, level)}
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-[var(--r-badge)] text-muted-foreground/75 transition-colors hover:bg-accent hover:text-[hsl(var(--tone-danger-fg))] disabled:pointer-events-none disabled:opacity-50"
                  aria-label={`Remove ${tech.name}`}
                  data-test={`technology-remove-${tech.slug}-button`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Kept mounted with the panel rather than per row, so the list does not
          carry a dialog per technology. `pendingRemoval` is both the open flag and
          the subject, which is what stops the two disagreeing. The failure toast
          stays up and the dialog stays open on an error — closing it would leave
          the intern looking at a row that is still there with no idea why. */}
      <Dialog
        open={Boolean(pendingRemoval)}
        onOpenChange={(open) => {
          if (!open && !isSaving) setPendingRemoval(null);
        }}
      >
        <DialogContent data-test="technology-remove-dialog">
          <DialogHeader>
            <DialogTitle>Remove {pendingRemoval?.tech.name}?</DialogTitle>
            {/* Leads with the assessment, because that is the whole reason this
                dialog opened at all — an unassessed row never gets here.
                Then the reassuring half, which is true: `ReadinessFlag` rows are
                keyed by intern + technology and are NOT deleted when a declaration
                is dropped (`readinessFlagService`), so re-declaring brings the
                mentor's level back with it. Claiming the assessment is lost would
                be the easier sentence to write and would be untrue. */}
            <DialogDescription>
              Your mentor has assessed you as{' '}
              <span className="font-semibold text-foreground">
                {getReadinessLabel(pendingRemoval?.level)}
              </span>{' '}
              for {pendingRemoval?.tech.name}. Removing it takes the technology off the ones you are
              working toward, so it stops counting toward your readiness. The assessment itself is
              kept — declare it again and the level comes back.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => setPendingRemoval(null)}
              data-test="technology-remove-dialog-cancel-button"
            >
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isSaving}
              onClick={() => removeTechnology(pendingRemoval.tech)}
              data-test="technology-remove-dialog-confirm-button"
            >
              {isSaving ? 'Removing…' : 'Remove technology'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PagePanel>
  );
}
