import { Search, X } from 'lucide-react';
import { PagePanel } from '@/components/PageShell';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { TechnologyIcon } from '@/helpers/technologyIcons';
import { ReadinessLevelBadge } from '@/components/interns/ReadinessLevelBadge';
import { useMyDeclaredTechnologies } from '@/hooks/useMyDeclaredTechnologies';
import { useUpdateMyTechnologies } from '@/queries/interns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
      onSuccess: () => toast.success(`${tech.name} removed`),
      onError: (err) => toast.error(err?.response?.data?.message || 'Failed to remove technology'),
    });
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
            filter={(tech, q) => !declaredIds.has(tech._id) && tech.name.toLowerCase().includes(q)}
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
        <p className={BODY_MESSAGE_CLASS}>Loading technologies…</p>
      ) : declaredTechnologies.length === 0 ? (
        <p className={BODY_MESSAGE_CLASS}>
          No technologies yet. Search above to add the ones you are working toward.
        </p>
      ) : (
        <ul>
          {declaredTechnologies.map((tech) => {
            const level = flagMap[tech._id]?.level || 'none';
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
                  onClick={() => removeTechnology(tech)}
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
    </PagePanel>
  );
}
