import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InternCommentsPanel } from '@/components/interns/InternCommentsPanel';
import { InternEvaluationsPanel } from '@/components/interns/InternEvaluationsPanel';
import { InternRecommendationsPanel } from '@/components/interns/InternRecommendationsPanel';
import { InternReadinessPanel } from '@/components/interns/InternReadinessPanel';
import { InternCandidateOverview } from '@/components/interns/InternCandidateOverview';
import { ReadinessLevelBadge } from '@/components/interns/ReadinessLevelBadge';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { SymphonyPageHeader } from '@/components/symphony/SymphonyPageHeader';
import { SymphonyStatusBadge } from '@/components/symphony/SymphonyStatusBadge';
import { useIntern, useInternReadiness } from '@/queries/interns';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuth } from '@/context/AuthContext';
import { canManageInternDocumentationLinks } from '@/helpers/roles';

function StatTile({ label, value, badge = null }) {
  return (
    <SymphonyCard className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{value}</p>
        {badge}
      </div>
    </SymphonyCard>
  );
}

const CANDIDATE_TABS = ['overview', 'technologies', 'evaluations', 'recommendations', 'notes'];

export default function LeadershipCandidatePage() {
  const { user } = useAuth();
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    CANDIDATE_TABS.includes(tabParam) ? tabParam : 'overview'
  );
  const { data: intern, isPending, isError } = useIntern(userId);
  useDocumentTitle(intern?.user?.fullname);
  const canEditDocumentation = canManageInternDocumentationLinks(user, intern);
  const declaredPosition = intern?.declaredPosition;
  const { data: readinessFlags = [] } = useInternReadiness(userId, {
    enabled: Boolean(userId && declaredPosition),
  });
  // Only the flag assessed for the currently declared role counts — a flag
  // left over from a previous role reads as "Not assessed".
  const positionFlag = readinessFlags.find(
    (f) => f.position && (f.position?._id || f.position) === declaredPosition?._id
  );

  useEffect(() => {
    if (CANDIDATE_TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading candidate profile...</p>;
  }

  if (isError || !intern) {
    return (
      <SymphonyCard className="space-y-4">
        <p className="text-sm text-[hsl(var(--tone-danger-fg))]">Unable to load this candidate.</p>
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
              <div className="flex flex-wrap items-center gap-2">
                <SymphonyStatusBadge status={intern.status} />
              </div>
            }
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatTile label="Hub" value={intern.user?.hub?.name || '—'} />
            <StatTile label="Programme" value={intern.internshipType?.name || '—'} />
            <StatTile
              label="Start date"
              value={intern.startDate ? format(new Date(intern.startDate), 'MMM d, yyyy') : '—'}
            />
            <StatTile label="Primary mentor" value={intern.primaryMentor?.fullname || '—'} />
            <StatTile label="Secondary mentor" value={intern.secondaryMentor?.fullname || '—'} />
            <StatTile
              label="Declared position"
              value={intern.declaredPosition?.name || '—'}
              badge={
                declaredPosition ? (
                  <ReadinessLevelBadge level={positionFlag?.level || 'none'} />
                ) : null
              }
            />
            <StatTile
              label="Expected end"
              value={
                intern.expectedEndDate
                  ? format(new Date(intern.expectedEndDate), 'MMM d, yyyy')
                  : '—'
              }
            />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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

        <TabsContent value="overview">
          <SymphonyCard className="p-6 md:p-8">
            <InternCandidateOverview
              intern={intern}
              userId={userId}
              canEditDocumentation={canEditDocumentation}
              canEditInternalCv={false}
              canGenerateCvSummary={false}
            />
          </SymphonyCard>
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
