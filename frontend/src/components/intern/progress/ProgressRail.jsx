import { PagePanel } from '@/components/PageShell';
import { getAvatarColor } from '@/helpers/avatarColor';
import { getInitials } from '@/helpers/getInitials';
import { getReadinessLabel } from '@/helpers/internProfile';
import { cn } from '@/lib/utils';

/**
 * What the "Placement readiness" section currently amounts to, in three words.
 *
 * Nothing declared is its own answer and not "0 of 0 ready": the intern has not
 * started the section rather than failed it. A declared position with no
 * technologies falls back to that position's own level, so the row still reports
 * something the mentor recorded.
 */
const readinessSummaryLabel = (readiness) => {
  const summary = readiness?.summary || { total: 0, ready: 0 };
  const position = readiness?.position || null;

  if (summary.total === 0 && !position) return 'Nothing declared';
  if (summary.total > 0) return `${summary.ready} of ${summary.total} ready`;
  return position.level === 'none' ? 'Not assessed' : getReadinessLabel(position.level);
};

const countLabel = (items) => {
  const total = items?.length || 0;
  return total === 0 ? 'None yet' : `${total} recorded`;
};

/** One "On this page" row: where it goes, and what is in it today. */
function RailRow({ href, label, value }) {
  return (
    <li>
      <a
        href={href}
        className="flex items-center justify-between gap-3 border-b border-separator py-[11px] transition-colors last:border-b-0 hover:text-foreground"
      >
        <span className="min-w-0 truncate text-[12.5px] text-muted-foreground">{label}</span>
        <span className="app-chip shrink-0 border border-border bg-muted text-muted-foreground">
          {value}
        </span>
      </a>
    </li>
  );
}

/**
 * The rail beside the four sections — an index of the page and the people behind
 * everything on it.
 *
 * It reads the same payload the sections do rather than querying anything of its
 * own: the counts in the index and the rows they point at come from one object, so
 * the rail cannot claim "None yet" over a section that is showing three.
 *
 * The mentors come from `programme` (plain name strings) and NOT from
 * `useMyInternProfile` the way `InternMentorsCard` does on `/my-technologies`. This
 * page is deliberately one query with one loading state — see `MyProgressPage` —
 * and a second profile fetch just to render two initials would break that.
 */
export function ProgressRail({ programme, readiness, evaluations, recommendations, mentorNotes }) {
  const specialization = programme?.specialization;

  const mentors = [
    programme?.primaryMentor && { name: programme.primaryMentor, role: 'Primary mentor' },
    specialization?.mentor && { name: specialization.mentor, role: 'Specialization mentor' },
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3.5">
      <PagePanel className="px-[18px] pb-[18px] pt-[15px]">
        <h2 className="app-card-title">On this page</h2>
        <p className="mt-0.5 text-[12.5px] leading-[1.45] text-muted-foreground">
          What is recorded so far.
        </p>

        <ul className="mt-2.5">
          <RailRow
            href="#my-progress-readiness"
            label="Placement readiness"
            value={readinessSummaryLabel(readiness)}
          />
          <RailRow
            href="#my-progress-evaluations"
            label="Evaluations"
            value={countLabel(evaluations?.items)}
          />
          <RailRow
            href="#my-progress-recommendations"
            label="Recommendations"
            value={countLabel(recommendations?.items)}
          />
          <RailRow
            href="#my-progress-mentor-notes"
            label="Notes from your mentor"
            value={countLabel(mentorNotes?.items)}
          />
        </ul>
      </PagePanel>

      <PagePanel className="px-[18px] pb-[18px] pt-[15px]">
        {mentors.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {mentors.map(({ name, role }) => (
              <li key={role} className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                    getAvatarColor(name)
                  )}
                  aria-hidden="true"
                >
                  {getInitials(name)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[12.5px] font-medium text-foreground">{name}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{role}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {/* The sentence that used to run on the end of the page subtitle. It belongs
            next to the people it names, not under the H1 — and it is the answer to
            "why is there nothing to click on this page", which is a question about
            the whole page rather than about any one section. */}
        <p
          className={cn(
            'text-[12.5px] leading-[1.5] text-muted-foreground',
            mentors.length > 0 && 'mt-3 border-t border-separator pt-3'
          )}
        >
          Everything here is recorded by your mentors and admins — yours to read, not to edit.
        </p>
      </PagePanel>
    </div>
  );
}
