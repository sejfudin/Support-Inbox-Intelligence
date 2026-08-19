import { ProfileAvatarField } from '@/components/profile/ProfileAvatarField';
import { useProfileAvatar } from '@/components/profile/useProfileAvatar';
import { RoleBadge } from '@/components/RoleBadge';
import { UserStatusBadge } from '@/components/UserStatusBadge';

/**
 * Who you are, in one band above everything else on the profile page.
 *
 * The chips are the `flat` variant, not the bordered default: at the top of a
 * page whose every other card is a hairline outline, two uppercase filled badges
 * read as a warning rather than as a description of the account.
 *
 * The picture becomes editable only under **Edit profile**, alongside the name — so
 * at rest this card is what its subtitle claims, information you read, and there is
 * no live control sitting on a page nobody meant to change. The camera badge and the
 * overflow menu both appear with the rest of the edit affordances and leave with them.
 *
 * Everything you can do to the picture lives on the picture — one badge in the
 * circle's corner, a camera before there is one and an overflow menu after. This card
 * only decides *whether* that is editable; `ProfileAvatarField` owns what it looks
 * like. The `useProfileAvatar` hook is called here rather than inside the field
 * because the field and its menu have to share one file input, one in-flight state
 * and one preview.
 */
export function ProfileIdentityCard({ user, isEditing = false }) {
  const hubName = user?.hub?.name;
  const avatar = useProfileAvatar(user);

  return (
    <section className="app-card flex flex-col gap-4 px-[18px] py-4 sm:flex-row sm:items-center sm:gap-[14px]">
      <ProfileAvatarField avatar={avatar} isEditing={isEditing} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[17px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          {user?.fullname || '—'}
        </span>
        <span className="truncate text-[12.5px] text-muted-foreground">
          {user?.email || '—'}
          {hubName ? ` · ${hubName} hub` : ''}
        </span>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-[7px]">
        <RoleBadge role={user?.role || 'User'} />
        <UserStatusBadge status={user?.status || 'active'} />
      </div>
    </section>
  );
}
