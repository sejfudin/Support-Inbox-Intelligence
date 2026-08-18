import { PagePanel } from '@/components/PageShell';
import { getAvatarColor } from '@/helpers/avatarColor';
import { getInitials } from '@/helpers/getInitials';
import { useMyInternProfile } from '@/queries/interns';
import { cn } from '@/lib/utils';

/**
 * Who assesses the technologies in the list beside this card.
 *
 * The secondary mentor only exists once a specialization is assigned, so the card
 * is one row for most interns and two for a specialized one. It renders nothing
 * without a primary mentor — the profile requires one, so that only happens while
 * the profile query is still in flight.
 */
export function InternMentorsCard() {
  const { data: intern } = useMyInternProfile();

  const mentors = [
    intern?.primaryMentor && { user: intern.primaryMentor, role: 'Primary mentor' },
    intern?.secondaryMentor && { user: intern.secondaryMentor, role: 'Secondary mentor' },
  ].filter(Boolean);

  if (mentors.length === 0) return null;

  return (
    <PagePanel className="px-[18px] pb-[18px] pt-[15px]">
      <h2 className="app-card-title">Your mentors</h2>
      <p className="mt-0.5 text-[12.5px] leading-[1.45] text-muted-foreground">
        They record every assessment above.
      </p>

      <ul className="mt-3 flex flex-col gap-2.5">
        {mentors.map(({ user, role }) => (
          <li key={user._id || role} className="flex items-center gap-2.5">
            <span
              className={cn(
                'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                getAvatarColor(user.fullname || '')
              )}
              aria-hidden="true"
            >
              {getInitials(user.fullname || '')}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[12.5px] font-medium text-foreground">
                {user.fullname || 'Unassigned'}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">{role}</span>
            </span>
          </li>
        ))}
      </ul>
    </PagePanel>
  );
}
