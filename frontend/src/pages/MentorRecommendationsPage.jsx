import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from 'use-debounce';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import PageHeading from '@/components/PageHeading';
import { PageShell, PageSection } from '@/components/PageShell';
import TableSkeleton from '@/components/Skeletons/TableSkeleton';
import FilterSelect from '@/components/FilterSelect';
import RecommendationTechnologies from '@/components/interns/recommendations/RecommendationTechnologies';
import { CHIP, badgeTone } from '@/helpers/badgeTones';
import {
  getRecommendationResultLabel,
  getRecommendationResultTone,
  getRecommendationStatusLabel,
  getRecommendationStatusTone,
  RECOMMENDATION_RESULTS,
  RECOMMENDATION_STATUSES,
  recommendationProjectLabel,
} from '@/helpers/recommendations';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/helpers/roles';
import { useHubs } from '@/queries/hubs';
import { useRecommendations } from '@/queries/recommendations';
import { useTechnologies } from '@/queries/technologies';
import { formatDate } from '@/helpers/date';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/user-avatar';
import { LoadingOverlay, useLoaderHold } from '@/components/ui/loader';

// The three pipeline stages, in order — the columns that used to carry a date
// each and now live in the status chip's tooltip.
const STAGES = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'interviewing', label: 'Interviewing' },
  { key: 'resulted', label: 'Resulted' },
];

/** Per-stage dates, shown on hover over the status chip. */
function StatusChip({ recommendation }) {
  const dates = recommendation.statusDates || {};

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            CHIP,
            'cursor-default border',
            badgeTone(getRecommendationStatusTone(recommendation.status))
          )}
        >
          {getRecommendationStatusLabel(recommendation.status)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="px-3 py-2">
        <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-[12px]">
          {STAGES.map((stage) => (
            <Fragment key={stage.key}>
              <span className="text-muted-foreground">{stage.label}</span>
              <span
                className={cn(
                  'text-right tabular-nums',
                  dates[stage.key] ? 'font-medium text-foreground' : 'text-muted-foreground/70'
                )}
              >
                {dates[stage.key] ? formatDate(dates[stage.key]) : '—'}
              </span>
            </Fragment>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default function MentorRecommendationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [result, setResult] = useState('');
  const [technologyId, setTechnologyId] = useState('');
  const [hubId, setHubId] = useState('');
  const [debouncedSearch] = useDebounce(search, 400);

  const { data: hubs = [] } = useHubs();
  const { data: technologies = [] } = useTechnologies();
  const {
    data,
    isPending: isPendingRaw,
    isError,
  } = useRecommendations({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: status || undefined,
    result: result || undefined,
    technologyId: technologyId || undefined,
    hubId: hubId || undefined,
  });
  // Global hold: keeps the mark up for MIN_VISIBLE_MS once it appears, and until the data is in.
  const isPending = useLoaderHold(isPendingRaw, { release: isError });

  const recommendations = data?.recommendations ?? [];
  const pagination = data?.pagination;
  const totalMatching = pagination?.total ?? 0;
  const hasFilters = Boolean(search || status || result || technologyId || hubId);

  // Straight to the intern's Recommendations tab, not their Overview. A row here
  // IS a recommendation, so the question the click asks is "what else has been
  // tried for this person" — and landing on Overview made the reader find the tab
  // themselves every time.
  const profilePathFor = (userId) =>
    `${user?.role === ROLES.ADMIN ? `/user/${userId}` : `/my-interns/${userId}`}?tab=recommendations`;

  // Every filter change resets to page 1 — page 3 of the old result set is a
  // different, usually empty, page of the new one.
  const onFilterChange = (setter) => (value) => {
    setter(value === 'all' ? '' : value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setResult('');
    setTechnologyId('');
    setHubId('');
    setPage(1);
  };

  return (
    <PageShell>
      <PageSection className="space-y-4">
        <PageHeading
          crumb="Admin"
          title="Recommendations"
          subtitle="Recommendation attempts and placement results."
          actions={
            <div className="relative w-full md:w-[240px]">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70"
                aria-hidden="true"
              />
              <Input
                className="pl-[30px] text-[12.5px] md:text-[12.5px]"
                placeholder="Search interns..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                aria-label="Search intern name or email"
                data-test="recommendations-search-input"
              />
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={hubId}
            allLabel="All hubs"
            options={hubs.map((hub) => ({ value: hub._id, label: hub.name }))}
            onChange={onFilterChange(setHubId)}
            dataTest="recommendations-hub-filter"
          />
          <FilterSelect
            value={status}
            allLabel="All statuses"
            options={RECOMMENDATION_STATUSES}
            onChange={onFilterChange(setStatus)}
            dataTest="recommendations-status-filter"
          />
          <FilterSelect
            value={result}
            allLabel="All results"
            options={RECOMMENDATION_RESULTS}
            onChange={onFilterChange(setResult)}
            dataTest="recommendations-result-filter"
          />
          <FilterSelect
            value={technologyId}
            allLabel="All technologies"
            options={technologies.map((technology) => ({
              value: technology._id,
              label: technology.name,
            }))}
            onChange={onFilterChange(setTechnologyId)}
            dataTest="recommendations-technology-filter"
          />
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--r-control)] px-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              data-test="recommendations-clear-filters"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>
          )}

          <span className="flex-1" />

          <span className="text-[12px] text-muted-foreground/75" data-test="recommendations-count">
            {isPending ? '—' : `${totalMatching} recommendation${totalMatching === 1 ? '' : 's'}`}
          </span>
        </div>

        <div className="app-card overflow-hidden">
          {isError && (
            <p
              className="p-6 text-[12.5px] text-[hsl(var(--tone-danger-fg))]"
              data-test="recommendations-error"
            >
              Failed to load recommendations.
            </p>
          )}
          {isPending && (
            <LoadingOverlay label="Loading recommendations">
              <TableSkeleton columns={8} rows={8} minWidthClassName="min-w-[1080px]" />
            </LoadingOverlay>
          )}
          {!isPending && !isError && (
            <TooltipProvider delayDuration={150}>
              <Table className="min-w-[1120px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Intern</TableHead>
                    <TableHead className="w-[110px]">Hub</TableHead>
                    <TableHead className="w-[140px]">Position</TableHead>
                    <TableHead className="w-[160px]">Project</TableHead>
                    {/* The widest of the fixed columns: two chips plus the +N pill
                        only stay on one line if the whole trio fits, and a
                        technology name like "Data Engineering" is 130px of it. */}
                    <TableHead className="w-[320px]">Technologies</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[120px]">Result</TableHead>
                    <TableHead className="w-[110px] text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recommendations.length === 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={8}
                        className="h-auto py-12 text-center text-[12.5px] text-muted-foreground"
                      >
                        No recommendations match your filters.
                        {hasFilters && (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="ml-1.5 font-medium text-primary underline-offset-2 hover:underline"
                          >
                            Clear them
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {recommendations.map((recommendation) => {
                    const intern = recommendation.internProfile;
                    const userId = intern?.user?._id;
                    const fullname = intern?.user?.fullname || 'Unknown';
                    const outcome = recommendation.result?.outcome;

                    return (
                      <TableRow
                        key={recommendation._id}
                        className="cursor-pointer"
                        onClick={() => userId && navigate(profilePathFor(userId))}
                        data-test={`recommendation-row-${recommendation._id}`}
                      >
                        {/* Avatar + email under the name: the same intern cell as the
                            attendance roster, so a person reads identically wherever
                            they are listed. */}
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-2.5">
                            <UserAvatar
                              user={intern?.user}
                              name={fullname}
                              size="md"
                              showTitle={false}
                            />
                            <div className="min-w-0 leading-[1.35]">
                              <p className="truncate text-[13px] font-medium text-foreground">
                                {fullname}
                              </p>
                              <p className="truncate text-[11.5px] text-muted-foreground/75">
                                {intern?.user?.email || '—'}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {intern?.user?.hub?.name || '—'}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {recommendation.position?.name || (
                            <span className="text-muted-foreground/75">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <span className="line-clamp-2 [overflow-wrap:anywhere]">
                            {recommendationProjectLabel(recommendation)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <RecommendationTechnologies
                            technologies={recommendation.technologies}
                            intern={intern?.user}
                            internName={fullname}
                            subtitle={recommendation.position?.name}
                          />
                        </TableCell>
                        <TableCell>
                          <StatusChip recommendation={recommendation} />
                        </TableCell>
                        <TableCell>
                          {outcome ? (
                            <span
                              className={cn(
                                CHIP,
                                'border',
                                badgeTone(getRecommendationResultTone(outcome))
                              )}
                            >
                              {getRecommendationResultLabel(outcome)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/75">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                          {formatDate(recommendation.updatedAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-separator px-[18px] py-3">
              <p className="text-[12px] text-muted-foreground/75">
                Page {pagination.page} of {pagination.pages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={page <= 1}
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                  data-test="recommendations-prev-page-button"
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                  data-test="recommendations-next-page-button"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </PageSection>
    </PageShell>
  );
}
