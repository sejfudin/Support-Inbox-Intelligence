import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from 'use-debounce';
import { HelpCircle, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import CardGridSkeleton from '@/components/Skeletons/CardGridSkeleton';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { SymphonyPageHeader } from '@/components/symphony/SymphonyPageHeader';
import { TechnologyDemandChart } from '@/components/symphony/dashboard/TechnologyDemandChart';
import { ProjectsKpiRow } from '@/components/symphony/projects/ProjectsKpiRow';
import { ProjectCard } from '@/components/symphony/projects/ProjectCard';
import { PROJECT_STATUSES, getProjectStatusLabel } from '@/helpers/projects';
import { useProjectsOverview } from '@/queries/projects';
import { cn } from '@/lib/utils';
import { LoadingOverlay, useLoaderHold } from '@/components/ui/loader';

const STATUS_FILTER_OPTIONS = [{ value: '', label: 'All' }, ...PROJECT_STATUSES];
// A project nobody is placed on or in selection for isn't interesting to
// leadership yet, so the page opens on "With interns". It's a view filter, not
// a data one — the payload (and every KPI) still covers every project, and
// "All projects" brings the empty ones straight back.
const STAFFING_FILTER_OPTIONS = [
  { value: 'withInterns', label: 'With interns' },
  { value: 'all', label: 'All projects' },
];
const DEFAULT_STAFFING_FILTER = 'withInterns';
const hasInterns = (project) => project.placedCount + project.inSelectionCount > 0;
const PAGE_SIZE = 9;

export default function LeadershipProjectsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState('');
  const [staffingFilter, setStaffingFilter] = useState(DEFAULT_STAFFING_FILTER);
  const [technologyFilter, setTechnologyFilter] = useState(null); // { id, name } | null
  const [sortBy, setSortBy] = useState('mostPlaced'); // 'mostPlaced' | 'fewestPlaced'
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const gridRef = useRef(null);
  const chartRef = useRef(null);

  const { data, isPending: isPendingRaw, isError } = useProjectsOverview();
  // Global hold: keeps the mark up for MIN_VISIBLE_MS once it appears, and until the data is in.
  const isPending = useLoaderHold(isPendingRaw, { release: isError });
  const projects = data?.projects ?? [];
  const kpis = data?.kpis;
  const unknownProjectBucket = data?.unknownProjectBucket;
  const hasUnknownProjectWork =
    !isPending &&
    ((unknownProjectBucket?.placedCount ?? 0) > 0 ||
      (unknownProjectBucket?.inSelectionCount ?? 0) > 0);

  // A new filter/search always starts back at the first page of results.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [statusFilter, staffingFilter, technologyFilter, debouncedSearch]);

  const filteredProjects = useMemo(() => {
    let list = projects;
    if (staffingFilter === 'withInterns') list = list.filter(hasInterns);
    if (statusFilter) list = list.filter((project) => project.status === statusFilter);
    if (technologyFilter) {
      list = list.filter((project) =>
        (project.technologies || []).some((tech) => tech._id === technologyFilter.id)
      );
    }
    const query = debouncedSearch.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (project) =>
          project.name.toLowerCase().includes(query) ||
          (project.client || '').toLowerCase().includes(query) ||
          (project.technologies || []).some((tech) => tech.name.toLowerCase().includes(query))
      );
    }
    return [...list].sort((a, b) =>
      sortBy === 'fewestPlaced' ? a.placedCount - b.placedCount : b.placedCount - a.placedCount
    );
  }, [projects, statusFilter, staffingFilter, technologyFilter, debouncedSearch, sortBy]);

  const visibleProjects = filteredProjects.slice(0, visibleCount);
  const hasMore = filteredProjects.length > visibleProjects.length;

  const scrollToGrid = () =>
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const scrollToChart = () =>
    chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleSelectTechnologyFromChart = (techId) => {
    const row = kpis?.technologyDemand?.find((entry) => entry.technology._id === techId);
    if (!row) return;
    setTechnologyFilter({ id: row.technology._id, name: row.technology.name });
    scrollToGrid();
  };

  // Only worth surfacing as a chip when it's actually holding something back —
  // on a programme where every project is staffed the default hides nothing.
  const staffingFilterHidesProjects =
    staffingFilter === 'withInterns' && projects.some((project) => !hasInterns(project));

  const activeFilters = [
    staffingFilterHidesProjects && {
      key: 'staffing',
      label: 'With interns only',
      onClear: () => setStaffingFilter('all'),
    },
    statusFilter && {
      key: 'status',
      label: getProjectStatusLabel(statusFilter),
      onClear: () => setStatusFilter(''),
    },
    technologyFilter && {
      key: 'technology',
      label: technologyFilter.name,
      onClear: () => setTechnologyFilter(null),
    },
    debouncedSearch.trim() && {
      key: 'search',
      label: `"${debouncedSearch.trim()}"`,
      onClear: () => setSearch(''),
    },
  ].filter(Boolean);

  const clearAllFilters = () => {
    setStaffingFilter('all');
    setStatusFilter('');
    setTechnologyFilter(null);
    setSearch('');
  };

  return (
    <div className="space-y-6">
      <SymphonyPageHeader
        kicker="Future Experts Programme"
        title="Projects"
        subtitle="Every client engagement, who is on it, and who is next in line."
      />

      {isError && (
        <SymphonyCard>
          <p className="text-sm text-[hsl(var(--tone-danger-fg))]">Failed to load projects.</p>
        </SymphonyCard>
      )}

      <ProjectsKpiRow
        isPending={isPending}
        kpis={kpis}
        statusFilter={statusFilter}
        onFilterStatus={setStatusFilter}
        onShowAllProjects={() => setStaffingFilter('all')}
        scrollToGrid={scrollToGrid}
        scrollToChart={scrollToChart}
      />

      <SymphonyCard className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="symphony-input min-w-[220px] flex-1"
            placeholder="Search project, client or technology..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            data-test="projects-search-input"
          />
          <div
            className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1"
            role="group"
            aria-label="Filter by status"
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <Button
                key={option.value || 'all'}
                type="button"
                size="sm"
                variant={statusFilter === option.value ? 'default' : 'ghost'}
                onClick={() => setStatusFilter(option.value)}
                data-test={`projects-status-filter-${option.value || 'all'}`}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div
            className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1"
            role="group"
            aria-label="Filter by interns on the project"
          >
            {STAFFING_FILTER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={staffingFilter === option.value ? 'default' : 'ghost'}
                onClick={() => setStaffingFilter(option.value)}
                data-test={`projects-staffing-filter-${option.value}`}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger
              className="symphony-input w-auto gap-1.5"
              data-test="projects-sort-select"
            >
              <span className="text-muted-foreground">Sort:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mostPlaced">Most placed</SelectItem>
              <SelectItem value="fewestPlaced">Fewest placed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <span className="text-xs font-medium text-muted-foreground">Filtered by:</span>
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={filter.onClear}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
              >
                {filter.label}
                <X className="h-3 w-3" />
              </button>
            ))}
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-semibold text-[hsl(var(--symphony-brand-strong))] hover:underline dark:text-[hsl(var(--symphony-brand))]"
              data-test="projects-clear-filters"
            >
              Clear all
            </button>
          </div>
        )}
      </SymphonyCard>

      {hasUnknownProjectWork && (
        <SymphonyCard
          className="flex flex-wrap items-center gap-4"
          data-test="projects-unknown-project-bucket"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <HelpCircle className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Project not known yet</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Recommendations still waiting on a project. Not a project — nothing to open here.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-lg font-bold leading-none text-foreground">
                {unknownProjectBucket.placedCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">placed</p>
            </div>
            <div>
              <p className="text-lg font-bold leading-none text-[hsl(var(--symphony-brand-strong))] dark:text-[hsl(var(--symphony-brand))]">
                {unknownProjectBucket.inSelectionCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">in selection</p>
            </div>
          </div>
        </SymphonyCard>
      )}

      <div ref={gridRef} className="scroll-mt-20">
        {/* The same three-column grid the cards land in — `ProjectsKpiRow` and the demand
            chart above already draw their own pending states, so a line of copy here left a
            gap between two occupied bands. */}
        {isPending && (
          <LoadingOverlay label="Loading projects">
            <CardGridSkeleton cards={6} />
          </LoadingOverlay>
        )}
        {!isPending && filteredProjects.length === 0 && (
          <SymphonyCard className="py-12 text-center text-sm text-muted-foreground">
            {staffingFilterHidesProjects ? (
              <div className="flex flex-col items-center gap-3">
                <p>No projects with interns match your filters.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStaffingFilter('all')}
                  data-test="projects-show-all-empty-state"
                >
                  Show all projects
                </Button>
              </div>
            ) : (
              'No projects match your filters.'
            )}
          </SymphonyCard>
        )}
        {!isPending && filteredProjects.length > 0 && (
          <>
            <div className={cn('grid gap-4', 'sm:grid-cols-2 lg:grid-cols-3')}>
              {visibleProjects.map((project) => (
                <ProjectCard key={project._id} project={project} />
              ))}
            </div>
            <div className="mt-5 flex flex-col items-center gap-2">
              {hasMore && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  data-test="projects-view-more"
                >
                  View more projects
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Showing {visibleProjects.length} of {filteredProjects.length} projects
              </p>
            </div>
          </>
        )}
      </div>

      <div ref={chartRef} className="scroll-mt-20">
        <SymphonyCard>
          <h2 className="text-lg font-semibold text-foreground">Technology demand</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Projects asking for each technology, and how many interns are placed on them. Click a
            column to filter.
          </p>
          <div className="mt-4">
            <TechnologyDemandChart
              isPending={isPending}
              data={kpis?.technologyDemand ?? []}
              selectedTechnologyId={technologyFilter?.id ?? null}
              onSelectTechnology={handleSelectTechnologyFromChart}
            />
          </div>
        </SymphonyCard>
      </div>
    </div>
  );
}
