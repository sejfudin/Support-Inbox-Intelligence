import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InternCommentsPanel } from '@/components/interns/InternCommentsPanel';
import { InternEvaluationsPanel } from '@/components/interns/InternEvaluationsPanel';
import { InternRecommendationsPanel } from '@/components/interns/InternRecommendationsPanel';
import { InternReadinessPanel } from '@/components/interns/InternReadinessPanel';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { SymphonyPageHeader } from '@/components/symphony/SymphonyPageHeader';
import { SymphonyStatusBadge } from '@/components/symphony/SymphonyStatusBadge';
import { useIntern } from '@/queries/interns';
import { cn } from '@/lib/utils';

function StatTile({ label, value }) {
  return (
    <SymphonyCard className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </SymphonyCard>
  );
}

export default function LeadershipCandidatePage() {
  const { userId } = useParams();
  const { data: intern, isPending, isError } = useIntern(userId);

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading candidate profile...</p>;
  }

  if (isError || !intern) {
    return (
      <SymphonyCard className="space-y-4">
        <p className="text-sm text-destructive">Unable to load this candidate.</p>
        <Link to="/interns" className="text-sm font-medium text-primary hover:underline">
          Back to directory
        </Link>
      </SymphonyCard>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <div className="symphony-rail hidden shrink-0 self-stretch sm:block" />
        <div className="min-w-0 flex-1 space-y-6">
          <Link
            to="/interns"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            data-test="leadership-candidate-back-link"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to candidates
          </Link>

          <SymphonyPageHeader
            kicker="Candidate profile"
            title={intern.user?.fullname}
            subtitle={intern.user?.email}
            actions={
              <div className="flex flex-wrap gap-2">
                <SymphonyStatusBadge status={intern.status} />
                {intern.readyForPlacement && (
                  <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Ready for placement
                  </span>
                )}
              </div>
            }
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Hub" value={intern.user?.hub?.name || '—'} />
            <StatTile label="Programme" value={intern.internshipType?.name || '—'} />
            <StatTile
              label="Start date"
              value={intern.startDate ? format(new Date(intern.startDate), 'MMM d, yyyy') : '—'}
            />
            <StatTile label="Primary mentor" value={intern.primaryMentor?.fullname || '—'} />
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="symphony-tabs-list" data-test="leadership-candidate-tabs">
          <TabsTrigger value="overview" className="symphony-tab-trigger">
            Overview
          </TabsTrigger>
          <TabsTrigger value="technologies" className="symphony-tab-trigger">
            Technologies
          </TabsTrigger>
          <TabsTrigger value="evaluations" className="symphony-tab-trigger">
            Evaluations
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="symphony-tab-trigger">
            Recommendations
          </TabsTrigger>
          <TabsTrigger value="notes" className="symphony-tab-trigger">
            Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <SymphonyCard>
              <h3 className="text-base font-semibold">Programme details</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Secondary mentor</dt>
                  <dd className="font-medium">{intern.secondaryMentor?.fullname || '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Expected end</dt>
                  <dd className="font-medium">
                    {intern.expectedEndDate
                      ? format(new Date(intern.expectedEndDate), 'MMM d, yyyy')
                      : '—'}
                  </dd>
                </div>
              </dl>
            </SymphonyCard>
            <SymphonyCard>
              <h3 className="text-base font-semibold">Declared technologies</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {(intern.selfTechnologies || []).length === 0 && (
                  <p className="text-sm text-muted-foreground">None declared yet.</p>
                )}
                {(intern.selfTechnologies || []).map((tech) => (
                  <span
                    key={tech._id}
                    className={cn(
                      'rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-sm'
                    )}
                  >
                    {tech.name}
                  </span>
                ))}
              </div>
              {intern.cvUrl && (
                <a
                  href={intern.cvUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
                  data-test="leadership-candidate-cv-link"
                >
                  View CV
                </a>
              )}
            </SymphonyCard>
          </div>
        </TabsContent>

        <TabsContent value="technologies">
          <SymphonyCard>
            <InternReadinessPanel
              userId={userId}
              declaredTechnologies={intern.selfTechnologies || []}
              readOnly
            />
          </SymphonyCard>
        </TabsContent>

        <TabsContent value="evaluations">
          <SymphonyCard>
            <InternEvaluationsPanel userId={userId} readOnly />
          </SymphonyCard>
        </TabsContent>

        <TabsContent value="recommendations">
          <SymphonyCard>
            <InternRecommendationsPanel userId={userId} readOnly />
          </SymphonyCard>
        </TabsContent>

        <TabsContent value="notes">
          <SymphonyCard>
            <InternCommentsPanel userId={userId} readOnly />
          </SymphonyCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
