/**
 * The little circle pinned to the corner of the profile avatar.
 *
 * Shared by the camera (add a picture) and the overflow menu (change or remove the
 * one that is there) so the control does not shift or resize when a picture appears
 * — it is one affordance in two states, in one place, and it should look like it.
 *
 * It sits proud of the avatar's edge rather than inside it, and `border-card` cuts
 * it out of whatever the card behind is painted, in either theme.
 */
export const AVATAR_BADGE_CLASS =
  'absolute -bottom-0.5 -right-0.5 grid h-[22px] w-[22px] place-items-center rounded-full ' +
  'border-2 border-card bg-primary text-primary-foreground transition-transform ' +
  // Both, deliberately. The pencil badge *is* the button, so `hover:` is what fires
  // for it. The camera badge is a span inside a button, whose hit target is the whole
  // circle — `group-hover:` is what makes it respond to that, and it is inert on the
  // pencil, which has no `group` ancestor of its own.
  'hover:scale-110 group-hover:scale-110 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-70';
