import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { CalendarRange, Sparkles } from 'lucide-react';
import { useSprintSummary, useGenerateSprintSummary } from '@/queries/sprintSummaries';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Switcher } from '@/components/ui/switcher';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader, useLoaderHold } from '@/components/ui/loader';
import { UserAvatar } from '@/components/ui/user-avatar';

// How many carry-over titles to spell out before collapsing the rest into a
// count — the list is a nudge, not the backlog.
const CARRY_OVER_VISIBLE = 8;

const VIEWS = [
  { value: 'team', label: 'Whole team', dataTest: 'sprint-summary-view-team' },
  { value: 'per-person', label: 'Per person', dataTest: 'sprint-summary-view-per-person' },
];

const plural = (count, singular, pluralForm = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

const ErrorBox = ({ children }) => (
  <div className="rounded-[var(--r-tile)] border border-destructive/20 bg-destructive/10 px-4 py-3 text-[12.5px] text-[hsl(var(--tone-danger-fg))]">
    {children}
  </div>
);

const Section = ({ title, children }) => (
  <div className="flex flex-col gap-2">
    <span className="app-crumb">{title}</span>
    {children}
  </div>
);

// A theme is one line the model returns as "Headline - what changed, what
// changed". Split on the first " - " so the headline can carry the emphasis and
// the detail reads as a caption; a line without the separator renders whole.
const ThemeLine = ({ text }) => {
  const at = text.indexOf(' - ');
  if (at === -1) return <span className="text-foreground">{text}</span>;
  return (
    <>
      <span className="font-semibold text-foreground">{text.slice(0, at)}</span>
      <span className="text-muted-foreground"> — {text.slice(at + 3)}</span>
    </>
  );
};

const ThemeList = ({ items }) => (
  <ul className="list-disc space-y-1 pl-4 text-[12.5px] leading-[1.6] text-foreground">
    {items.map((theme, index) => (
      <li key={`${theme}-${index}`}>
        <ThemeLine text={theme} />
      </li>
    ))}
  </ul>
);

const EmptyHint = ({ children }) => (
  <span className="text-[12px] leading-[1.5] text-muted-foreground/75">{children}</span>
);

const TeamView = ({ data }) => {
  const { team, hasSummary } = data;
  const carryOverShown = team.carryOver.slice(0, CARRY_OVER_VISIBLE);
  const carryOverRest = team.carryOver.length - carryOverShown.length;

  return (
    <div className="app-card flex flex-col gap-4 px-[18px] py-4">
      <Section title="Shipped">
        {hasSummary && team.themes.length ? (
          <ThemeList items={team.themes} />
        ) : (
          <EmptyHint>
            {hasSummary
              ? 'Nothing was finished in this sprint.'
              : 'Generate a summary to group the finished work into themes.'}
          </EmptyHint>
        )}
      </Section>

      {team.carryOver.length ? (
        <Section title={`Carry-over · ${team.carryOver.length}`}>
          <ul className="list-disc space-y-1 pl-4 text-[12.5px] leading-[1.6] text-muted-foreground">
            {carryOverShown.map((subject, index) => (
              <li key={`${subject}-${index}`}>{subject}</li>
            ))}
          </ul>
          {carryOverRest > 0 ? (
            <EmptyHint>+ {plural(carryOverRest, 'more ticket', 'more tickets')}</EmptyHint>
          ) : null}
        </Section>
      ) : null}
    </div>
  );
};

const PerPersonView = ({ rows, hasSummary }) => {
  if (!rows.length) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="No one is on this sprint yet"
        description="A person shows up here once they are assigned a ticket that is in the sprint."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2" data-test="sprint-summary-per-person-list">
      {rows.map((row) => (
        <div key={row.user._id} className="app-card flex gap-3.5 px-[18px] py-[15px]">
          <UserAvatar user={row.user} size="md" className="mt-0.5 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="text-[length:var(--fs-row-title)] font-semibold text-foreground">
                {row.user.fullname}
              </span>
              <span className="text-[length:var(--fs-hint)] text-muted-foreground">
                {row.points.done} pts done · {row.points.inProgress} in progress
              </span>
            </div>
            {hasSummary && row.themes.length ? (
              <ThemeList items={row.themes} />
            ) : (
              <EmptyHint>
                {hasSummary
                  ? 'Nothing finished this sprint.'
                  : 'Generate a summary for the per-person breakdown.'}
              </EmptyHint>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const SummaryFooter = ({ data }) => {
  if (!data.hasSummary) return null;

  const parts = ['Drafted by AI · check before sharing'];
  if (data.generatedAt) {
    const who = data.generatedBy?.fullname ? ` by ${data.generatedBy.fullname}` : '';
    parts.push(`generated ${format(new Date(data.generatedAt), 'MMM d, HH:mm')}${who}`);
  }
  if (data.stale) parts.push('sprint changed since — regenerate for the latest');

  return <p className="text-[11px] text-muted-foreground/75">{parts.join(' · ')}</p>;
};

/**
 * The Sprints → Summary tab: an AI recap of one sprint, for the whole team or
 * per person — the finished work grouped into a few short themes, plus a
 * carry-over list. Sprints are listed most-recently-finished first; a finished
 * sprint's recap is generated automatically the first time its tab is opened and
 * then cached, while the active sprint sits last as a manual live preview. The
 * numbers live on the Sprint tab's progress strip, not here.
 */
const SprintSummaryTab = ({ workspaceId, pastSprints = [], currentSprint = null }) => {
  const [view, setView] = useState('team');
  const [selectedId, setSelectedId] = useState(null);

  // Finished sprints first, most recently finished at the top (the parent sorts
  // `pastSprints` newest-first). The running sprint sits last as a manual
  // preview; an upcoming sprint has no work in it and is left out.
  const options = useMemo(() => {
    const list = pastSprints.map((sprint) => ({ value: sprint._id, label: sprint.name }));
    if (currentSprint && currentSprint.state === 'active') {
      list.push({ value: currentSprint._id, label: `${currentSprint.name} · active` });
    }
    return list;
  }, [currentSprint, pastSprints]);

  const selectedIsPast = useMemo(
    () => pastSprints.some((sprint) => sprint._id === selectedId),
    [pastSprints, selectedId]
  );

  // Keep the selection valid as sprints load in / change underneath it. Default
  // lands on `options[0]` — the most recently finished sprint.
  useEffect(() => {
    if (options.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!options.some((option) => option.value === selectedId)) {
      setSelectedId(options[0].value);
    }
  }, [options, selectedId]);

  const {
    data: response,
    isLoading: isLoadingRaw,
    isError,
  } = useSprintSummary(workspaceId, selectedId);
  const isLoading = useLoaderHold(isLoadingRaw, { release: isError });
  const {
    mutate: runGenerate,
    reset: resetGenerate,
    isPending: isGenerating,
    isError: generateFailed,
    error: generateErrorObj,
  } = useGenerateSprintSummary(workspaceId);
  const data = response?.data ?? null;

  // The generate mutation is shared across every sprint in the picker, so its
  // error/pending state has to be cleared when the selection changes — otherwise
  // one sprint's failed auto-generate suppresses auto-generate for the next
  // sprint picked, and leaves its error banner showing above unrelated numbers.
  useEffect(() => {
    resetGenerate();
  }, [selectedId, resetGenerate]);

  // Auto-generate the first time a FINISHED sprint's recap is viewed and none
  // exists yet — opening its tab is the "ask" (ADR 0013). Fires once per sprint
  // per mount; a failure is left visible and retried only on a manual click or a
  // re-select. The active-sprint preview stays manual: it changes daily, so
  // firing it on every visit would burn AI calls.
  const autoGenFiredFor = useRef(null);
  useEffect(() => {
    if (!selectedIsPast || !data || data.hasSummary) return;
    if (data.team.tickets.total === 0) return;
    if (isGenerating || generateFailed) return;
    if (autoGenFiredFor.current === selectedId) return;
    autoGenFiredFor.current = selectedId;
    runGenerate({ sprintId: selectedId });
  }, [selectedIsPast, data, selectedId, isGenerating, generateFailed, runGenerate]);

  if (options.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="No sprint to summarise yet"
        description="A sprint can be summarised once it is running or has finished."
      />
    );
  }

  const generateError =
    generateErrorObj?.response?.data?.message ||
    generateErrorObj?.message ||
    'Failed to generate summary.';

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={selectedId || undefined} onValueChange={setSelectedId}>
          <SelectTrigger
            className="w-auto min-w-[190px] gap-2 rounded-[var(--r-control)] border-separator bg-transparent px-[11px] text-[12.5px] font-normal text-foreground"
            data-test="sprint-summary-picker"
          >
            <SelectValue placeholder="Select a sprint" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2.5">
          <Switcher items={VIEWS} value={view} onChange={setView} label="Summary view" />
          <Button
            onClick={() => selectedId && runGenerate({ sprintId: selectedId })}
            disabled={isGenerating || !selectedId}
            data-test="sprint-summary-generate-button"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isGenerating ? 'Generating…' : data?.hasSummary ? 'Regenerate' : 'Generate summary'}
          </Button>
        </div>
      </div>

      {generateFailed ? <ErrorBox>{generateError}</ErrorBox> : null}

      {isLoading ? (
        <Loader variant="panel" label="Loading summary…" />
      ) : isError ? (
        <ErrorBox>Failed to load the sprint summary. Please try again.</ErrorBox>
      ) : !data ? null : data.team.tickets.total === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No tickets in this sprint"
          description="Add tickets to the sprint on the Sprint tab, then generate a summary here."
        />
      ) : isGenerating && !data.hasSummary ? (
        <Loader variant="panel" label="Generating summary…" />
      ) : (
        <div className="flex flex-col gap-3.5">
          {view === 'team' ? (
            <TeamView data={data} />
          ) : (
            <PerPersonView rows={data.perUser} hasSummary={data.hasSummary} />
          )}
          <SummaryFooter data={data} />
        </div>
      )}
    </section>
  );
};

export default SprintSummaryTab;
