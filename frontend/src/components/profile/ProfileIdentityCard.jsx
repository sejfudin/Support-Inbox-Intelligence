import { Avatar } from '@/components/Avatar';
import { RoleBadge } from '@/components/RoleBadge';
import { UserStatusBadge } from '@/components/UserStatusBadge';

/**
 * Who you are, in one band above everything else on the profile page.
 *
 * The chips are the `flat` variant, not the bordered default: at the top of a
 * page whose every other card is a hairline outline, two uppercase filled badges
 * read as a warning rather than as a description of the account.
 */
export function ProfileIdentityCard({ user }) {
  const hubName = user?.hub?.name;

  return (
    <section className="app-card flex flex-col gap-4 px-[18px] py-4 sm:flex-row sm:items-center sm:gap-[14px]">
      <div className="shrink-0">
        <Avatar users={[user]} size="lg" />
      </div>

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
