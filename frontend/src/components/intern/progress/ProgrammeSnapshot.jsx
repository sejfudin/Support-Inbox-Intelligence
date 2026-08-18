import { Link } from 'react-router-dom';
import { CalendarCheck, Code2, Eye, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/helpers/date';
import { ProgressPanel, ProgressPanelBody } from './ProgressPanel';

const ACTION_CLASS = 'h-[34px] rounded-[var(--r-control)] px-3.5 text-[12.5px]';

/**
 * A date for a fact, or `null` so the row's own fallback handles the empty case.
 *
 * Not `formatDate` directly: the shared helper returns a hyphen for a missing date
 * while a fact row falls back to an em dash, which put two different "no value"
 * glyphs in the same grid — "—" under Position and "-" under Expected end.
 * Normalised here rather than in `helpers/date.js`, which other pages rely on as
 * it is.
 */
const factDate = (value) => (value ? formatDate(value) : null);

/** One label/value row. `value` falls back to an em dash so the grid never has holes. */
function Fact({ label, value, hint }) {
  return (
    <div className="border-b border-separator py-[13px]">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="shrink-0 text-[12.5px] leading-[1.45] text-muted-foreground">{label}</dt>
        <dd className="min-w-0 text-right text-[12.5px] font-medium leading-[1.45] text-foreground">
          {value || '—'}
        </dd>
      </div>
      {hint ? (
        <p className="mt-1 text-[11.5px] leading-[1.5] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * "Where I stand" — the programme facts about the intern: lifecycle status, dates,
 * position, mentors, hub.
 *
 * Every field here was already readable by the intern through `GET /api/interns/me`
 * and has simply never been shown as a whole anywhere. The status is the reason the
 * panel exists: an intern could be marked `ready` for placement for weeks with no
 * way to know it.
 */
export function ProgrammeSnapshot({ programme }) {
  if (!programme) return null;

  const specialization = programme.specialization;

  /* Built as a list rather than written out as markup because the grid below flows
     by COLUMN, and column flow needs to know how many rows to break at. Which facts
     exist varies — a specialization adds its mentor, a placement adds its first day
     — so the row count is derived from the list instead of hardcoded. */
  const facts = [
    {
      label: 'Programme',
      value: programme.internshipType,
    },
    {
      label: 'Primary mentor',
      value: programme.primaryMentor,
    },
    {
      label: 'Started',
      value: factDate(programme.startDate),
    },
    {
      label: 'Position',
      value: programme.position ? (
        // A div, not a span: `Badge` renders a div, which is invalid inside inline
        // content. `dd` is a block container, so this nests fine.
        <div className="flex flex-wrap items-center justify-end gap-2">
          {programme.position.name}
          {specialization ? (
            <Badge variant="secondary" className="gap-1 rounded-full px-2 py-0 text-[10.5px]">
              <Lock className="h-3 w-3" />
              Specialization
            </Badge>
          ) : null}
        </div>
      ) : null,
      hint: specialization
        ? `Confirmed as your focus on ${formatDate(specialization.assignedAt)} — you can't change this one yourself.`
        : undefined,
    },
    {
      label: 'Secondary position',
      value: programme.secondaryPosition?.name,
    },
    // Only meaningful when a specialization exists: `secondaryMentor` is the
    // specialization mentor and nothing else since ADR-0002, so labelling it
    // "secondary mentor" would name a relationship that no longer exists.
    specialization && {
      label: 'Specialization mentor',
      value: specialization.mentor,
    },
    {
      label: 'Hub',
      value: programme.hub,
    },
    {
      label: 'Expected end',
      value: factDate(programme.expectedEndDate),
    },
    // Routinely a future date — it is set as soon as a start date is known — so
    // this is printed as a fact and draws no "you are on a project now" conclusion
    // from it.
    programme.placedAt && {
      label: 'First day on project',
      value: factDate(programme.placedAt),
      hint: 'Office attendance is not recorded from this day on.',
    },
  ].filter(Boolean);

  const rows = Math.ceil(facts.length / 2);

  return (
    <ProgressPanel
      id="my-progress-programme"
      title="Programme details"
      description="Dates, position, mentors and hub, as your mentors and admins have them recorded."
      action={
        /* The read-only note reads as state, not as a control, so it is plain muted
           text rather than a badge. It lives on this section, the one that lists
           what is recorded about the intern — the status and its meaning moved up
           to the page header, where they answer the question people arrive with. */
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          Read-only
        </span>
      }
      dataTour="my-progress-programme"
    >
      <ProgressPanelBody className="pt-[15px]">
        {/* Column flow, not row flow: read down one column and then down the next,
            so the facts the programme has actually recorded stay together instead of
            alternating with a column of em dashes across every row. */}
        <dl
          className="grid gap-x-9 sm:auto-cols-fr sm:grid-flow-col"
          style={{ gridTemplateRows: `repeat(${rows}, auto)` }}
        >
          {facts.map((fact) => (
            <Fact key={fact.label} label={fact.label} value={fact.value} hint={fact.hint} />
          ))}
        </dl>

        {/* The two pages the intern can actually change something on. Buttons rather
            than the inline links this used to be: they are the only way off this
            page, and a read-only screen should say where you *can* act. */}
        <div className="mt-[18px] flex flex-wrap gap-2">
          <Button asChild variant="outline" className={ACTION_CLASS}>
            <Link to="/my-attendance">
              <CalendarCheck />
              My attendance
            </Link>
          </Button>
          <Button asChild variant="outline" className={ACTION_CLASS}>
            <Link to="/my-technologies">
              <Code2 />
              Position &amp; technologies
            </Link>
          </Button>
        </div>
      </ProgressPanelBody>
    </ProgressPanel>
  );
}
