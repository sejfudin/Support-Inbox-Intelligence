import { Link } from 'react-router-dom';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { cn } from '@/lib/utils';

const INTERVIEWING_COLOR = '#E0A93B';

function initialsOf(fullname = '') {
  const parts = fullname.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function StatusPill({ status }) {
  const isInterviewing = status === 'interviewing';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-[11px] py-[5px] text-[11.5px] font-semibold',
        isInterviewing
          ? 'bg-[#FBF1DC] text-[#9A6B12] dark:bg-[#2C2415] dark:text-[#E4B65E]'
          : 'bg-[hsl(var(--symphony-brand)/0.1)] text-[hsl(var(--symphony-brand-ink))]'
      )}
    >
      {isInterviewing ? 'Interviewing' : 'Recommended'}
    </span>
  );
}

function PersonRow({ person }) {
  const meta = [person.hub?.name, person.programme?.name].filter(Boolean).join(' · ');
  const techs = person.technologies?.slice(0, 3) ?? [];
  return (
    <Link
      to={`/interns/${person.userId}?tab=recommendations`}
      className="flex items-start gap-3 border-b border-[hsl(var(--symphony-border)/0.6)] px-4 py-4 transition-colors last:border-b-0 hover:bg-[hsl(var(--symphony-brand)/0.04)] lg:items-center lg:gap-4 lg:px-[26px]"
    >
      <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[hsl(var(--symphony-brand)/0.1)] text-sm font-semibold text-[hsl(var(--symphony-brand-strong))]">
        {initialsOf(person.fullname)}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
        <div className="min-w-0 lg:min-w-[160px] lg:flex-[1.1]">
          <p className="text-[14.5px] font-semibold text-foreground">{person.fullname}</p>
          {meta && <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>}
        </div>

        {techs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 lg:flex-[1.3]">
            {techs.map((tech) => (
              <span
                key={tech._id}
                className="rounded-[7px] border border-[hsl(var(--symphony-border))] bg-[hsl(var(--symphony-surface))] px-[9px] py-1 text-[11.5px] font-medium text-foreground/80"
              >
                {tech.name}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 lg:contents">
          <div className="lg:w-[118px] lg:shrink-0">
            <StatusPill status={person.status} />
          </div>

          <div className="text-right lg:w-[150px] lg:shrink-0">
            <p className="text-[13px] font-medium text-foreground">
              {person.latestCompany || '—'}
            </p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              {person.latestRole || 'Awaiting match'}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function PersonCard({ person }) {
  const meta = [person.hub?.name, person.programme?.name].filter(Boolean).join(' · ');
  const techs = person.technologies?.slice(0, 6) ?? [];
  const matched = Boolean(person.latestCompany);
  return (
    <Link
      to={`/interns/${person.userId}?tab=recommendations`}
      className="flex flex-col overflow-hidden rounded-2xl border border-[hsl(var(--symphony-border))] bg-[hsl(var(--symphony-surface-elevated))] shadow-[0_1px_2px_hsl(220_20%_10%/0.04)] transition-colors active:bg-[hsl(var(--symphony-brand)/0.04)]"
    >
      <div className="flex flex-col gap-3 p-3.5">
        <div className="flex items-start gap-3">
          <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[hsl(var(--symphony-brand)/0.1)] text-sm font-semibold text-[hsl(var(--symphony-brand-strong))]">
            {initialsOf(person.fullname)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">{person.fullname}</p>
            {meta && (
              <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{meta}</p>
            )}
          </div>
          <StatusPill status={person.status} />
        </div>

        {techs.length > 0 && (
          <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {techs.map((tech) => (
              <span
                key={tech._id}
                className="shrink-0 whitespace-nowrap rounded-full border border-[hsl(var(--symphony-border))] bg-[hsl(var(--symphony-surface))] px-2.5 py-1 text-[11.5px] font-medium text-foreground/80"
              >
                {tech.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[hsl(var(--symphony-border)/0.6)] bg-[hsl(var(--symphony-surface))] px-3.5 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {matched ? 'Placement' : 'Status'}
        </span>
        {matched ? (
          <span className="min-w-0 truncate text-right text-[13px]">
            <span className="font-semibold text-foreground">{person.latestCompany}</span>
            {person.latestRole && (
              <span className="text-muted-foreground"> {person.latestRole}</span>
            )}
          </span>
        ) : (
          <span className="text-[13px] text-muted-foreground">Awaiting match</span>
        )}
      </div>
    </Link>
  );
}

function LegendDot({ color, label, count }) {
  return (
    <span className="flex items-center gap-2 text-[12.5px] font-medium text-foreground/80">
      <span className="h-[9px] w-[9px] rounded-[3px]" style={{ backgroundColor: color }} />
      {label ? (
        <>
          {label} <span className="text-muted-foreground">· {count}</span>
        </>
      ) : (
        count
      )}
    </span>
  );
}

export function PipelineCard({
  isPending,
  activePipeline = [],
  recommendationOutcomes = {},
  showSummary = true,
}) {
  const recommendedCount = activePipeline.filter((p) => p.status === 'recommended').length;
  const interviewingCount = activePipeline.filter((p) => p.status === 'interviewing').length;
  const inFlight = activePipeline.length;

  const placed = recommendationOutcomes.placed || 0;
  const notPlaced = recommendationOutcomes.not_placed || 0;
  const hasOutcomes = placed + notPlaced > 0;

  return (
    <SymphonyCard className="overflow-hidden p-0">
      <div className="border-b border-[hsl(var(--symphony-border)/0.6)] px-[26px] pb-5 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-semibold text-foreground">Pipeline</h2>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              Candidates being recommended or interviewing with clients.
            </p>
          </div>
          <Link
            to="/interns?status=active"
            className="whitespace-nowrap text-[13px] font-semibold text-[hsl(var(--symphony-brand-strong))] hover:underline dark:text-[hsl(var(--symphony-brand))]"
          >
            View all →
          </Link>
        </div>
        {showSummary && !isPending && inFlight > 0 && (
          <div className="mt-5">
            <p className="mb-3 text-[13.5px] font-semibold text-foreground">
              {inFlight} candidate{inFlight === 1 ? '' : 's'} in flight
            </p>
            <div className="flex h-3.5 gap-[3px] overflow-hidden rounded-full">
              {recommendedCount > 0 && (
                <div
                  className="bg-[hsl(var(--symphony-brand))]"
                  style={{ flexGrow: recommendedCount }}
                />
              )}
              {interviewingCount > 0 && (
                <div style={{ flexGrow: interviewingCount, backgroundColor: INTERVIEWING_COLOR }} />
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              <LegendDot
                color="hsl(var(--symphony-brand))"
                label="Recommended"
                count={recommendedCount}
              />
              <LegendDot
                color={INTERVIEWING_COLOR}
                label="Interviewing"
                count={interviewingCount}
              />
            </div>
          </div>
        )}
      </div>
      <div>
        {isPending && (
          <p className="px-4 py-6 text-sm text-muted-foreground sm:px-[26px]">Loading pipeline…</p>
        )}
        {!isPending && activePipeline.length === 0 && (
          <p className="px-4 py-8 text-sm text-muted-foreground sm:px-[26px]">
            No active placement attempts. Ready candidates are waiting to be recommended.
          </p>
        )}
        {!isPending && activePipeline.length > 0 && (
          <div className="flex flex-col gap-2.5 p-4 sm:hidden">
            {activePipeline.map((person) => (
              <PersonCard key={person.userId} person={person} />
            ))}
          </div>
        )}
        {!isPending && activePipeline.length > 0 && (
          <div className="hidden sm:block">
            {activePipeline.map((person) => (
              <PersonRow key={person.userId} person={person} />
            ))}
          </div>
        )}
      </div>
      {!isPending && (hasOutcomes || activePipeline.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2 border-t border-[hsl(var(--symphony-border)/0.6)] bg-[hsl(var(--symphony-surface))] px-[26px] py-[15px]">
          <span className="text-[11px] font-semibold tracking-[0.12em] text-[hsl(var(--symphony-gold))]">
            RECENT OUTCOMES
          </span>
          <LegendDot color="#2F9C86" label="" count={`${placed} placed`} />
          <LegendDot color="#D1567C" label="" count={`${notPlaced} not placed`} />
          <span className="flex-1" />
          <Link
            to="/interns?status=placed"
            className="text-[12.5px] font-semibold text-[hsl(var(--symphony-brand-strong))] hover:underline dark:text-[hsl(var(--symphony-brand))]"
          >
            See history →
          </Link>
        </div>
      )}
    </SymphonyCard>
  );
}
