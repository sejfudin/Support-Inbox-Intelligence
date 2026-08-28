import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarRange, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCurrentSprint, useSprints } from '@/queries/sprints';
import { CreateSprintModal } from '@/components/sprints/CreateSprintModal';
import EmptyState from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSection, PageShell } from '@/components/PageShell';
import PageHeading from '@/components/PageHeading';
import { Loader, useLoaderHold } from '@/components/ui/loader';

// upcoming/active/past mirror server/helpers/sprintRules.js's SPRINT_STATES —
// duplicated here as display data rather than imported across the client/server
// boundary.
const STATE_BADGE = {
  active: { label: 'Active', tone: 'success' },
  upcoming: { label: 'Upcoming', tone: 'info' },
  past: { label: 'Past', tone: 'muted' },
};

const formatDateRange = (start, end) =>
  `${format(new Date(start), 'MMM d')} – ${format(new Date(end), 'MMM d')}`;

const SprintHeaderBand = ({ sprint, onCreateClick }) => {
  const badge = STATE_BADGE[sprint.state] ?? STATE_BADGE.active;
  const subtitleParts = [formatDateRange(sprint.start, sprint.end), sprint.goal].filter(Boolean);

  return (
    <PageHeading
      crumb="Workspace · Sprints"
      title={sprint.name}
      titleAdornment={
        <Badge tone={badge.tone}>
          {sprint.state === 'upcoming'
            ? `Starts ${format(new Date(sprint.start), 'MMM d')}`
            : badge.label}
        </Badge>
      }
      subtitle={subtitleParts.join(' · ')}
      actions={
        <Button onClick={onCreateClick} data-test="sprint-new-button">
          <Plus className="h-4 w-4" />
          New sprint
        </Button>
      }
    />
  );
};

const SprintsPage = () => {
  const { user } = useAuth();
  const workspaceId = user?.workspaceId;
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: currentResponse, isLoading: isLoadingRaw, isError } = useCurrentSprint(workspaceId);
  const { data: sprintsResponse } = useSprints(workspaceId);
  const isLoading = useLoaderHold(isLoadingRaw, { release: isError });

  const sprint = currentResponse?.data ?? null;
  const nextSprintName = `Sprint ${(sprintsResponse?.data?.length ?? 0) + 1}`;

  return (
    <PageShell>
      <PageSection className="flex flex-col gap-3.5">
        {sprint ? (
          <SprintHeaderBand sprint={sprint} onCreateClick={() => setIsCreateOpen(true)} />
        ) : (
          <PageHeading crumb="Workspace · Sprints" title="Sprints" />
        )}

        {isLoading ? (
          <Loader variant="panel" label="Loading sprint…" />
        ) : !sprint ? (
          <EmptyState
            icon={CalendarRange}
            title="No sprint yet"
            description="Create a sprint to give the team a window of committed work to plan against."
            action={
              <Button onClick={() => setIsCreateOpen(true)} data-test="sprint-empty-create">
                <Plus className="h-4 w-4" />
                Create sprint
              </Button>
            }
          />
        ) : null}
      </PageSection>

      <CreateSprintModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        workspaceId={workspaceId}
        nextSprintName={nextSprintName}
      />
    </PageShell>
  );
};

export default SprintsPage;
