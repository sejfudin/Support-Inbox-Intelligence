import * as React from 'react';

import { cn } from '@/lib/utils';
import { getAvatarColor } from '@/helpers/avatarColor';
import { getInitials } from '@/helpers/getInitials';

/**
 * One person, as a circle of initials.
 *
 * Three sizes and no others — 24 in a table row, 30 in a list or card, 52 on a
 * profile. They are fixed rather than tokenised: an avatar is an identifier, not
 * a control, and shrinking it with the density setting costs recognition without
 * buying back a useful amount of row height.
 *
 * The colour comes from `getAvatarColor`, hashed off the name, so a person keeps
 * their colour across every screen. That is the whole value of the thing — a
 * randomised or index-based colour is just decoration.
 *
 * For a stack of several people with tooltips, use `components/Avatar.jsx`.
 */
const SIZES = {
  sm: 'h-6 w-6 text-[9.5px]',
  md: 'h-[30px] w-[30px] text-[10.5px]',
  lg: 'h-[52px] w-[52px] text-[16px]',
};

const InitialsAvatar = React.forwardRef(({ name = '', size = 'md', className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      'inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none',
      SIZES[size] ?? SIZES.md,
      getAvatarColor(name),
      className
    )}
    title={name || undefined}
    {...props}
  >
    {getInitials(name) || '?'}
  </span>
));
InitialsAvatar.displayName = 'InitialsAvatar';

export { InitialsAvatar };
