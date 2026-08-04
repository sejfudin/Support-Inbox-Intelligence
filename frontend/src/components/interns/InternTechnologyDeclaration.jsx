import { useMemo } from 'react';
import { X } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { TechnologyIcon } from '@/helpers/technologyIcons';
import { InternPanel } from '@/components/interns/InternPanel';
import { ReadinessLevelBadge } from '@/components/interns/ReadinessLevelBadge';
import {
  useMyInternProfile,
  useUpdateMyTechnologies,
  useMyInternReadiness,
} from '@/queries/interns';
import { useTechnologies } from '@/queries/technologies';
import { toast } from 'sonner';

export function InternTechnologyDeclaration() {
  const { data: intern } = useMyInternProfile();
  const { data: allTechnologies = [], isPending: isLoadingTechnologies } = useTechnologies();
  const { data: flags = [] } = useMyInternReadiness();
  const { mutate: saveTechnologies, isPending: isSaving } = useUpdateMyTechnologies();

  // Set of declared tech IDs — fast lookup for "already declared?"
  const declaredIds = useMemo(
    () => new Set((intern?.selfTechnologies || []).map((t) => t._id || t)),
    [intern]
  );

  // { techId → flag } — used to look up readiness level per tech
  const flagMap = useMemo(
    () => Object.fromEntries(flags.map((f) => [f.technology?._id || f.technology, f])),
    [flags]
  );

  // Only the techs the intern has declared, in catalog order
  const declaredTechnologies = useMemo(
    () => allTechnologies.filter((t) => declaredIds.has(t._id)),
    [allTechnologies, declaredIds]
  );

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
    <div className="space-y-6">
      {/* Search + add section */}
      <InternPanel className="px-5 py-6 md:px-6">
        <h3 className="text-base font-semibold text-foreground">Add a technology</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Search the catalog and add the technologies you are working toward.
        </p>
        <div className="mt-4">
          {isLoadingTechnologies ? (
            <p className="text-sm text-muted-foreground">Loading technologies...</p>
          ) : (
            <SearchableSelect
              items={allTechnologies}
              onSelect={addTechnology}
              filter={(tech, q) =>
                !declaredIds.has(tech._id) && tech.name.toLowerCase().includes(q)
              }
              renderItem={(tech) => (
                <span className="flex items-center gap-2 font-medium">
                  <TechnologyIcon technology={tech} size={16} className="shrink-0" />
                  {tech.name}
                </span>
              )}
              getItemDataTest={(tech) => `technology-add-${tech.slug}-button`}
              placeholder={isSaving ? 'Saving...' : 'Search technologies...'}
              emptyMessage="No technologies found."
              busy={isSaving}
              disabled={isSaving}
              dataTest="technology-search-input"
            />
          )}
        </div>
      </InternPanel>

      {/* Declared technologies list */}
      <InternPanel className="overflow-hidden p-0">
        <div className="border-b border-border/60 px-5 py-4 md:px-6">
          <h3 className="text-lg font-semibold">My technologies</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Technologies you have declared. Your mentor will assess your readiness for each.
          </p>
        </div>
        {isLoadingTechnologies ? (
          <p className="px-5 py-6 text-sm text-muted-foreground md:px-6">Loading technologies...</p>
        ) : declaredTechnologies.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground md:px-6">
            No technologies declared yet. Use the search above to add some.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {declaredTechnologies.map((tech) => {
              const level = flagMap[tech._id]?.level || 'none';
              return (
                <li
                  key={tech._id}
                  className="flex items-center justify-between gap-4 px-5 py-3 md:px-6"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <TechnologyIcon technology={tech} size={16} className="shrink-0" />
                    {tech.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <ReadinessLevelBadge level={level} />
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => removeTechnology(tech)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      aria-label={`Remove ${tech.name}`}
                      data-test={`technology-remove-${tech.slug}-button`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </InternPanel>
    </div>
  );
}
