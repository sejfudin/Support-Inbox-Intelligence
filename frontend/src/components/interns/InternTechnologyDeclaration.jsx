import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { InternPanel } from '@/components/interns/InternPanel';
import { ReadinessLevelBadge } from '@/components/interns/ReadinessLevelBadge';
import { useMyInternProfile, useUpdateMyTechnologies, useMyInternReadiness } from '@/queries/interns';
import { useTechnologies } from '@/queries/technologies';
import { toast } from 'sonner';

export function InternTechnologyDeclaration() {
  const { data: intern } = useMyInternProfile();
  const { data: allTechnologies = [] } = useTechnologies();
  const { data: flags = [] } = useMyInternReadiness();
  const { mutate: saveTechnologies, isPending: isSaving } = useUpdateMyTechnologies();

  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const itemRefs = useRef([]);

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

  // Catalog filtered by search text, excluding already-declared ones
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return allTechnologies.filter(
      (t) => !declaredIds.has(t._id) && t.name.toLowerCase().includes(q)
    );
  }, [search, allTechnologies, declaredIds]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchResults]);

  useEffect(() => {
    itemRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  const handleSearchKeyDown = (e) => {
    if (searchResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => (i - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const tech = searchResults[highlightedIndex];
      if (tech && !isSaving) addTechnology(tech);
    }
  };

  const addTechnology = (tech) => {
    const newIds = [...declaredIds, tech._id];
    saveTechnologies(newIds, {
      onSuccess: () => {
        toast.success(`${tech.name} added`);
        setSearch('');
      },
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
        <Popover
          open={search.trim().length > 0}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSearch('');
          }}
        >
          <PopoverAnchor asChild>
            <div className="mt-4">
              <Input
                placeholder="Search technologies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                data-test="technology-search-input"
              />
            </div>
          </PopoverAnchor>
          <PopoverContent
            align="start"
            sideOffset={4}
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="max-h-72 w-[var(--radix-popper-anchor-width)] overflow-y-auto rounded-xl border border-border bg-card p-0 shadow-md"
          >
            {searchResults.length > 0 ? (
              searchResults.map((tech, index) => (
                <div
                  key={tech._id}
                  ref={(el) => (itemRefs.current[index] = el)}
                  role="button"
                  tabIndex={0}
                  onClick={() => !isSaving && addTechnology(tech)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !isSaving) addTechnology(tech);
                  }}
                  className={`cursor-pointer px-4 py-2.5 text-sm first:rounded-t-xl last:rounded-b-xl ${
                    index === highlightedIndex ? 'bg-muted/50' : ''
                  }`}
                  data-test={`technology-add-${tech.slug}-button`}
                >
                  <span className="font-medium">{tech.name}</span>
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-muted-foreground">No technologies found.</div>
            )}
          </PopoverContent>
        </Popover>
      </InternPanel>

      {/* Declared technologies list */}
      <InternPanel className="overflow-hidden p-0">
        <div className="border-b border-border/60 px-5 py-4 md:px-6">
          <h3 className="text-lg font-semibold">My technologies</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Technologies you have declared. Your mentor will assess your readiness for each.
          </p>
        </div>
        {declaredTechnologies.length === 0 ? (
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
                  <span className="font-medium text-sm">{tech.name}</span>
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
