/**
 * A stable background/ink pair for a person, picked by hashing their name so the
 * same person is the same colour on every screen they appear on.
 *
 * The pairs run through the `--tone-*` tokens rather than literal Tailwind steps
 * (`bg-blue-100 text-blue-700`), for the same reason `helpers/badgeTones.js`
 * does: Settings → Accessibility → Colour-blind safe repaints the app by
 * redefining those eight variables, and an avatar painted in `blue-100` sits
 * that change out. It is also what keeps an avatar and the status badge beside
 * it drawn from one palette instead of two.
 *
 * Six hues, deliberately spread around the wheel — with fewer, two people in a
 * five-row table collide often enough to stop being a recognition cue.
 *
 * Every class string is written out in full. Tailwind's JIT finds classes by
 * scanning source text, so a name assembled at runtime generates no CSS at all
 * and the avatars render unstyled. Do not refactor these into a template.
 */
const AVATAR_TONES = [
  'bg-[hsl(var(--tone-info)/0.15)] text-[hsl(var(--tone-info-fg))] dark:bg-[hsl(var(--tone-info)/0.2)]',
  'bg-[hsl(var(--tone-success)/0.15)] text-[hsl(var(--tone-success-fg))] dark:bg-[hsl(var(--tone-success)/0.2)]',
  'bg-[hsl(var(--tone-violet)/0.15)] text-[hsl(var(--tone-violet-fg))] dark:bg-[hsl(var(--tone-violet)/0.2)]',
  'bg-[hsl(var(--tone-warning)/0.15)] text-[hsl(var(--tone-warning-fg))] dark:bg-[hsl(var(--tone-warning)/0.2)]',
  'bg-[hsl(var(--tone-danger)/0.15)] text-[hsl(var(--tone-danger-fg))] dark:bg-[hsl(var(--tone-danger)/0.2)]',
  'bg-[hsl(var(--tone-cyan)/0.15)] text-[hsl(var(--tone-cyan-fg))] dark:bg-[hsl(var(--tone-cyan)/0.2)]',
];

export const getAvatarColor = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
};
