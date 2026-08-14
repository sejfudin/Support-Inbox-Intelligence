import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/helpers/date';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import { ProgressPanel, ProgressPanelBody } from './ProgressPanel';
import { statusBadgeVariant, statusMeaning } from './programmeStatus';

/**
 * A date for a `Fact`, or `null` so the `Fact` fallback handles the empty case.
 *
 * Not `formatDate` directly: the shared helper returns a hyphen for a missing date
 * while `Fact` falls back to an em dash, which put two different "no value" glyphs
 * in the same grid — "—" under Position and "-" under Expected end. Normalised here
 * rather than in `helpers/date.js`, which other pages rely on as it is.
 */
const factDate = (value) => (value ? formatDate(value) : null);

/** One labelled fact. `value` falls back to an em dash so the grid never has holes. */
function Fact({ label, value, hint }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium leading-6 text-foreground">{value || '—'}</dd>
      {hint ? <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
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

  return (
    <ProgressPanel
      title="Where I stand"
      description="Your place in the programme, as your mentors and admins have it recorded."
      action={
        <Badge variant={statusBadgeVariant(programme.status)} className="text-xs">
          {capitalizeFirst(programme.status)}
        </Badge>
      }
      dataTour="my-progress-programme"
    >
      <ProgressPanelBody className="space-y-5">
        {/* The status word on its own tells an intern nothing — `ready` in particular
            is a placement milestone, not a mood. The stored value stays the label; this
            is the sentence next to it. */}
        <p className="text-sm leading-6 text-foreground">{statusMeaning(programme.status)}</p>

        <dl className="grid gap-x-6 gap-y-4 [grid-template-columns:repeat(auto-fill,minmax(13rem,1fr))]">
          <Fact
            label="Position"
            value={
              programme.position ? (
                // A div, not a span: `Badge` renders a div, which is invalid inside
                // inline content. `dd` is a block container, so this nests fine.
                <div className="flex flex-wrap items-center gap-2">
                  {programme.position.name}
                  {specialization ? (
                    <Badge variant="secondary" className="gap-1 font-semibold">
                      <Lock className="h-3 w-3" />
                      Specialization
                    </Badge>
                  ) : null}
                </div>
              ) : null
            }
            hint={
              specialization
                ? `Confirmed as your focus on ${formatDate(specialization.assignedAt)} — you can't change this one yourself.`
                : undefined
            }
          />
          <Fact label="Secondary position" value={programme.secondaryPosition?.name} />
          <Fact label="Programme" value={programme.internshipType} />
          <Fact label="Hub" value={programme.hub} />
          <Fact label="Primary mentor" value={programme.primaryMentor} />
          {/* Only meaningful when a specialization exists: `secondaryMentor` is the
              specialization mentor and nothing else since ADR-0002, so labelling it
              "secondary mentor" would name a relationship that no longer exists. */}
          {specialization ? (
            <Fact label="Specialization mentor" value={specialization.mentor} />
          ) : null}
          <Fact label="Started" value={factDate(programme.startDate)} />
          <Fact label="Expected end" value={factDate(programme.expectedEndDate)} />
          {/* Routinely a future date — it is set as soon as a start date is known — so
              this is printed as a fact and draws no "you are on a project now"
              conclusion from it. */}
          {programme.placedAt ? (
            <Fact
              label="First day on project"
              value={factDate(programme.placedAt)}
              hint="Office attendance is not recorded from this day on."
            />
          ) : null}
        </dl>

        <p className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <Link
            to="/my-attendance"
            className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            My attendance
          </Link>
          <Link
            to="/my-technologies"
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            Position &amp; technologies
            <ArrowRight className="h-3 w-3" />
          </Link>
        </p>
      </ProgressPanelBody>
    </ProgressPanel>
  );
}
