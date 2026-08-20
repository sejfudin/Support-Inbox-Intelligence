import { Avatar } from '@/components/Avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const EMPTY_AVATAR_SIZES = {
  // Matches the 22px assigned avatar, so an unassigned card is not 10px taller
  // than an assigned one.
  xs: { container: 'h-[22px] w-[22px] text-[9.5px]', icon: 'h-3 w-3' },
  sm: { container: 'h-[22px] w-[22px] text-[9.5px]', icon: 'h-3 w-3' },
  md: { container: 'h-8 w-8 text-[12px]', icon: 'h-4 w-4' },
  lg: { container: 'h-12 w-12 text-[16px]', icon: 'h-6 w-6' },
};

/**
 * The mockup's unassigned avatar: a filled `bg-sunken` circle with a `?`, the
 * same size and weight as a real one. It was a dashed outline with a person
 * glyph, which drew more attention than the assigned rows it sits between.
 */
function UnassignedAvatar({ emptyLabel, size = 'md' }) {
  const sizeClasses = EMPTY_AVATAR_SIZES[size] ?? EMPTY_AVATAR_SIZES.md;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`inline-flex flex-none items-center justify-center rounded-full bg-muted font-bold text-muted-foreground/75 ${sizeClasses.container}`}
            aria-label={emptyLabel}
          >
            ?
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{emptyLabel}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * `withName` is the ticket list's shape from the mockup: one 22px avatar with the
 * assignee's name beside it, ellipsised. Everywhere else this stays the stacked
 * avatar group it has always been.
 */
export default function AssigneesAvatar({
  users,
  emptyLabel = 'Unassigned',
  size,
  emptyDisplay = 'text',
  withName = false,
}) {
  if (!users || (Array.isArray(users) && users.length === 0)) {
    // `withName` is the list's cell, and the mockup keeps the avatar column
    // aligned by giving an unassigned row the same 22px circle as any other.
    if (emptyDisplay === 'avatar' || withName) {
      const empty = <UnassignedAvatar emptyLabel={emptyLabel} size={size ?? 'xs'} />;
      if (!withName) return empty;

      return (
        <span className="flex min-w-0 items-center gap-2">
          {empty}
          <span className="min-w-0 truncate text-[12.5px] text-muted-foreground">{emptyLabel}</span>
        </span>
      );
    }
    return <span className="text-[12.5px] text-muted-foreground/75">{emptyLabel}</span>;
  }

  if (withName) {
    const list = Array.isArray(users) ? users : [users];
    const [first] = list;
    const name = first?.fullname || first?.name || first?.email || emptyLabel;
    const extra = list.length - 1;

    return (
      <span className="flex min-w-0 items-center gap-2">
        <Avatar users={[first]} size={size ?? 'xs'} />
        <span className="min-w-0 truncate text-[12.5px] text-muted-foreground" title={name}>
          {name}
        </span>
        {extra > 0 ? (
          <span className="shrink-0 text-[11px] text-muted-foreground/75">+{extra}</span>
        ) : null}
      </span>
    );
  }

  return <Avatar users={users} size={size} />;
}
