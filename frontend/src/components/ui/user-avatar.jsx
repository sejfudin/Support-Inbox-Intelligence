import * as React from 'react';

import { cn } from '@/lib/utils';
import { getAvatarColor } from '@/helpers/avatarColor';
import { getInitials, resolveUserAvatarUrl, resolveUserName } from '@/helpers/userIdentity';

/**
 * One person, as a circle: their photo if they have uploaded one, their initials
 * if they have not.
 *
 * **This is the only way to draw a person in this app.** It replaced
 * `ui/initials-avatar.jsx` and twenty-six components that each hand-rolled the
 * same circle from `getAvatarColor` + `getInitials` with their own size classes.
 * That sprawl was survivable while a person was a coloured monogram; it stopped
 * being survivable when they gained a face, because every site that kept its own
 * copy would have kept rendering initials, and the same colleague showing a photo
 * on the board and a monogram in the ticket rail reads as a bug rather than as a
 * missing field.
 *
 * Four sizes and no others — 24 in a table row, 30 in a list or card, 52 on a
 * profile, and `xl` at 80 for the profile page's own header. They are fixed
 * rather than tokenised: an avatar is an identifier, not a control, and shrinking
 * it with the density setting costs recognition without buying back a useful
 * amount of row height.
 *
 * The fallback colour comes from `getAvatarColor`, hashed off the name, so a
 * person without a picture keeps the same colour on every screen. That is the
 * whole value of it — a randomised or index-based colour is just decoration.
 *
 * Pass `user` when you have the object; pass `name` when a component only ever
 * received a string. A bare name renders initials, because there is no picture to
 * look up without the record that carries it. `initials` overrides the monogram
 * with anything — a `<UserRound />` for a row that stands for no known person, for
 * instance — while still taking its colour from the name.
 *
 * For several people overlapped with tooltips and a `+N`, use `components/Avatar.jsx`,
 * which is built out of this.
 */
const SIZES = {
  xs: 'h-6 w-6 text-[9.5px]',
  sm: 'h-6 w-6 text-[9.5px]',
  md: 'h-[30px] w-[30px] text-[10.5px]',
  lg: 'h-[52px] w-[52px] text-[16px]',
  xl: 'h-20 w-20 text-[24px]',
};

const UserAvatar = React.forwardRef(
  (
    {
      user,
      name,
      size = 'md',
      className,
      fallback = '?',
      initials,
      title,
      showTitle = true,
      ...props
    },
    ref
  ) => {
    const displayName = name ?? resolveUserName(user);
    const avatarUrl = resolveUserAvatarUrl(user);
    // From the display name, so an explicit `name` and the monogram beneath it can
    // never disagree.
    const monogram = initials ?? getInitials(displayName, fallback);

    // An object URL that has failed once will fail again on every re-render, so
    // the fallback is state rather than a render-time guess. Keyed on the URL so
    // uploading a new picture clears a previous failure.
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => setFailed(false), [avatarUrl]);

    const showImage = Boolean(avatarUrl) && !failed;

    return (
      <span
        ref={ref}
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold leading-none',
          SIZES[size] ?? SIZES.md,
          // The hashed colour is skipped when a photo covers the circle — it
          // would only ever show through as a rim on a transparent PNG.
          showImage ? 'bg-muted' : getAvatarColor(displayName),
          className
        )}
        title={showTitle ? (title ?? displayName ?? undefined) || undefined : undefined}
        {...props}
      >
        {showImage ? (
          <img
            src={avatarUrl}
            alt=""
            // Decorative: the name is always present as text or a tooltip beside
            // this circle, so announcing it twice adds noise for a screen reader.
            aria-hidden="true"
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          monogram
        )}
      </span>
    );
  }
);
UserAvatar.displayName = 'UserAvatar';

export { UserAvatar, SIZES as USER_AVATAR_SIZES };
