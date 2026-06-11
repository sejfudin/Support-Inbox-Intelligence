import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useDebounce } from 'use-debounce';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import PageHeading from '@/components/PageHeading';
import { PageShell, PageSection } from '@/components/PageShell';
import {
  getRecommendationResultLabel,
  getRecommendationResultVariant,
  getRecommendationStatusLabel,
  getRecommendationStatusVariant,
  RECOMMENDATION_RESULTS,
  RECOMMENDATION_STATUSES,
} from '@/helpers/recommendations';
import { useHubs } from '@/queries/hubs';
import { useRecommendations } from '@/queries/recommendations';
import { useTechnologies } from '@/queries/technologies';

const formatDate = (date) => {
  if (!date) return '-';
  return format(new Date(date), 'MMM d, yyyy');
};

export default function MentorRecommendationsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [result, setResult] = useState('');
  const [technologyId, setTechnologyId] = useState('');
  const [hubId, setHubId] = useState('');
  const [debouncedSearch] = useDebounce(search, 400);

  const { data: hubs = [] } = useHubs();
  const { data: technologies = [] } = useTechnologies();
  const { data, isPending, isError } = useRecommendations({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: status || undefined,
    result: result || undefined,
    technologyId: technologyId || undefined,
    hubId: hubId || undefined,
  });

  const recommendations = data?.recommendations ?? [];
  const pagination = data?.pagination;
  const totalMatching = pagination?.total ?? 0;

  return (
    <PageShell>
      <PageSection className="space-y-6">
        <PageHeading
          kicker="Placement flow"
          title="Recommendations"
          subtitle="Manage recommendation attempts and placement results."
        />

        <div className="app-panel space-y-4 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {isPending
                ? 'Loading recommendations...'
                : `${totalMatching} recommendation${totalMatching === 1 ? '' : 's'}`}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Input
              placeholder="Search intern name or email..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              data-test="recommendations-search-input"
            />
            <Select
              value={hubId || 'all'}
              onValueChange={(value) => {
                setHubId(value === 'all' ? '' : value);
                setPage(1);
              }}
            >
              <SelectTrigger data-test="recommendations-hub-filter">
                <SelectValue placeholder="All hubs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All hubs</SelectItem>
                {hubs.map((hub) => (
                  <SelectItem key={hub._id} value={hub._id}>
                    {hub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status || 'all'}
              onValueChange={(value) => {
                setStatus(value === 'all' ? '' : value);
                setPage(1);
              }}
            >
              <SelectTrigger data-test="recommendations-status-filter">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {RECOMMENDATION_STATUSES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={result || 'all'}
              onValueChange={(value) => {
                setResult(value === 'all' ? '' : value);
                setPage(1);
              }}
            >
              <SelectTrigger data-test="recommendations-result-filter">
                <SelectValue placeholder="All results" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All results</SelectItem>
                {RECOMMENDATION_RESULTS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={technologyId || 'all'}
              onValueChange={(value) => {
                setTechnologyId(value === 'all' ? '' : value);
                setPage(1);
              }}
            >
              <SelectTrigger data-test="recommendations-technology-filter">
                <SelectValue placeholder="All technologies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All technologies</SelectItem>
                {technologies.map((technology) => (
                  <SelectItem key={technology._id} value={technology._id}>
                    {technology.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="app-panel overflow-hidden">
          {isError && (
            <p className="p-6 text-sm text-destructive" data-test="recommendations-error">
              Failed to load recommendations.
            </p>
          )}
          {isPending && (
            <p className="p-6 text-sm text-muted-foreground">Loading recommendations...</p>
          )}
          {!isPending && !isError && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-border/60 bg-muted/40">
                  <tr>
                    <th className="px-5 py-3 font-semibold text-foreground">Intern</th>
                    <th className="px-5 py-3 font-semibold text-foreground">Hub</th>
                    <th className="px-5 py-3 font-semibold text-foreground">Technologies</th>
                    <th className="px-5 py-3 font-semibold text-foreground">Status</th>
                    <th className="px-5 py-3 font-semibold text-foreground">Result</th>
                    <th className="px-5 py-3 font-semibold text-foreground">Updated</th>
                    <th className="px-5 py-3 font-semibold text-foreground" />
                  </tr>
                </thead>
                <tbody>
                  {recommendations.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                        No recommendations match your filters.
                      </td>
                    </tr>
                  )}
                  {recommendations.map((recommendation) => {
                    const intern = recommendation.internProfile;
                    const userId = intern?.user?._id;

                    return (
                      <tr
                        key={recommendation._id}
                        className="cursor-pointer border-t border-border/60 hover:bg-muted/30"
                        onClick={() => userId && navigate(`/my-interns/${userId}`)}
                        data-test={`recommendation-row-${recommendation._id}`}
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-foreground">
                            {intern?.user?.fullname || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {intern?.user?.email || '-'}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {intern?.user?.hub?.name || '-'}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {(recommendation.technologies || []).length === 0 && (
                              <span className="text-muted-foreground">-</span>
                            )}
                            {(recommendation.technologies || []).slice(0, 3).map((technology) => (
                              <Badge key={technology._id} variant="outline">
                                {technology.name}
                              </Badge>
                            ))}
                            {(recommendation.technologies || []).length > 3 && (
                              <Badge variant="outline">
                                +{recommendation.technologies.length - 3}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={getRecommendationStatusVariant(recommendation.status)}>
                            {getRecommendationStatusLabel(recommendation.status)}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          {recommendation.result?.outcome ? (
                            <Badge
                              variant={getRecommendationResultVariant(
                                recommendation.result.outcome
                              )}
                            >
                              {getRecommendationResultLabel(recommendation.result.outcome)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {formatDate(recommendation.updatedAt)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (userId) navigate(`/my-interns/${userId}`);
                            }}
                          >
                            View profile
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-border/60 px-5 py-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
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
