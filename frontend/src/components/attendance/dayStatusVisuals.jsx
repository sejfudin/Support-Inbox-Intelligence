import { House, TreePalm, Star, Thermometer, Briefcase } from 'lucide-react';
import { DAY_STATUS } from '@/helpers/attendance';
import { cn } from '@/lib/utils';

/**
 * How every attendance day state is drawn. One source, so the calendar, the two
 * admin tables and the dashboard week strip cannot disagree about what a day looks
 * like.
 *
 * ── Why colour alone stopped working ─────────────────────────────────────────
 *
 * There are eleven day states and eleven shipped themes, and `--primary` moves across
 * all of them: `styles/themes.css` sets it to hue 239 (indigo), 262 (violet),
 * 293 (fuchsia), **346 (crimson)**, **6 (coral)**, **24 (orange)**, 173 (teal), 199 (sky) and
 * 222 (navy), plus two neutrals — warm near-black in `ash`, achromatic in `mono`.
 * Orange is what a sick day asks for and red is what a missed one asks for, so in
 * the `sunset`, `ruby` and `rose` themes any status hue is somebody's primary.
 * There is no safe band left to claim.
 *
 * So the system stops trying:
 *
 * - **Fill says what happened.** A fixed hue per status, never `--primary`.
 * - **Ring says when.** "Today" is a temporal fact, not a status — it is drawn as a
 *   ring over whatever the day actually is, so it survives the intern checking in
 *   and cannot be confused with a status colour in any theme.
 * - **Glyph says which.** Every away-from-the-office state carries a mark. Present
 *   and Absent carry none, which keeps an ordinary month quiet and makes the
 *   exceptions the thing the eye finds.
 *
 * The glyph is what actually separates the four away states. Their hues are as far
 * apart as a wheel with six occupants allows, but blue-vacation sits 27° from
 * violet-religious and orange-sick sits 30° from red-absent, and no amount of
 * shuffling fixes that. Encoding the difference in shape as well as hue is also the
 * only version that works for a colour-blind viewer, which the old palette did not.
 *
 * ── The five families ────────────────────────────────────────────────────────
 *
 * | Family           | States                                    | Reads as          |
 * | ---------------- | ----------------------------------------- | ----------------- |
 * | Attended         | PRESENT, REMOTE                           | counted           |
 * | Approved absence | VACATION, RELIGIOUS, SICK                 | away, and allowed |
 * | Not owed         | WEEKEND, NON_WORKING, BEFORE_START, EXEMPT| nobody's day      |
 * | Missed           | ABSENT                                    | the one alarm     |
 * | Now              | today (a ring, over any of the above)     | you are here      |
 */

// Every fill is the same recipe: the 500 tint at 15% over the page, a 30% inset
// ring, and a 700/300 foreground. That pairing is what the rest of the app already
// uses and it clears 4.5:1 in both light and dark — don't lighten the text "for
// elegance", which is the usual way this kind of palette goes unreadable.
//
// Written out per status rather than generated from a hue name: Tailwind scans
// source for whole class names, so anything built by template literal is purged
// from the production build and the cell ships unstyled.
const STATUS_STYLES = {
  // ── Attended ──
  [DAY_STATUS.PRESENT]:
    'bg-[hsl(var(--tone-success)/0.15)] text-[hsl(var(--tone-success-fg))] ring-1 ring-inset ring-[hsl(var(--tone-success)/0.3)]',
  // Cyan by requirement: remote work counts as attendance, but must read
  // differently from an office check-in.
  [DAY_STATUS.REMOTE]:
    'bg-[hsl(var(--tone-cyan)/0.15)] text-[hsl(var(--tone-cyan-fg))] ring-1 ring-inset ring-[hsl(var(--tone-cyan)/0.3)]',

  // ── Approved absence ──
  // Blue for vacation and orange for sick were both asked for by name. They are
  // kept, and the glyphs are what stop them colliding with their neighbours.
  [DAY_STATUS.VACATION]:
    'bg-[hsl(var(--tone-info)/0.15)] text-[hsl(var(--tone-info-fg))] ring-1 ring-inset ring-[hsl(var(--tone-info)/0.3)]',
  [DAY_STATUS.RELIGIOUS]:
    'bg-[hsl(var(--tone-violet)/0.15)] text-[hsl(var(--tone-violet-fg))] ring-1 ring-inset ring-[hsl(var(--tone-violet)/0.3)]',
  [DAY_STATUS.SICK]:
    'bg-[hsl(var(--tone-orange)/0.15)] text-[hsl(var(--tone-orange-fg))] ring-1 ring-inset ring-[hsl(var(--tone-orange)/0.3)]',

  // ── Missed ──
  [DAY_STATUS.ABSENT]:
    'bg-[hsl(var(--tone-danger)/0.12)] text-[hsl(var(--tone-danger-fg))] ring-1 ring-inset ring-[hsl(var(--tone-danger)/0.3)]',

  // ── Not owed ──
  // All four recede together, because they are the same fact: nobody owed this day.
  // On-project used to be amber, which claimed a hue for a state that means "no
  // obligation" and left nothing for sick. It keeps its distinctness through the
  // briefcase glyph instead, so a placed intern's month still reads as accounted
  // for rather than blank.
  [DAY_STATUS.WEEKEND]: 'bg-muted/30 text-muted-foreground/40',
  [DAY_STATUS.NON_WORKING]: 'bg-muted/30 text-muted-foreground/40',
  [DAY_STATUS.EXEMPT]: 'bg-muted/50 text-muted-foreground/70',
  // Before the intern joined: faintest of all, and deliberately not a filled cell —
  // these days are not part of their record at all.
  [DAY_STATUS.BEFORE_START]: 'text-muted-foreground/30',

  // ── Now, and not yet anything ──
  // A working today with no check-in yet. Neutral rather than tinted: nothing has
  // happened, and the ring below is what marks it as today.
  [DAY_STATUS.TODAY_PENDING]: 'bg-muted/40 text-foreground font-semibold',
  [DAY_STATUS.FUTURE]: 'text-muted-foreground/40',
};

/**
 * The "this is today" ring, laid over whatever the day already is.
 *
 * Deliberately drawn in `--foreground` rather than `--primary`. Foreground is the
 * one token guaranteed to contrast with the page in every theme, where primary is
 * the very thing that collides with the status hues. Using a ring rather than a
 * fill also means today stays visible after the intern checks in — the old
 * treatment lost the marker the moment PRESENT won the ladder.
 */
const TODAY_RING = 'ring-2 ring-foreground/50 ring-offset-1 ring-offset-background';

const STATUS_DOT = {
  [DAY_STATUS.PRESENT]: 'bg-[hsl(var(--tone-success))]',
  [DAY_STATUS.REMOTE]: 'bg-[hsl(var(--tone-cyan))]',
  [DAY_STATUS.VACATION]: 'bg-[hsl(var(--tone-info))]',
  [DAY_STATUS.RELIGIOUS]: 'bg-[hsl(var(--tone-violet))]',
  [DAY_STATUS.SICK]: 'bg-[hsl(var(--tone-orange))]',
  [DAY_STATUS.ABSENT]: 'bg-[hsl(var(--tone-danger))]',
  [DAY_STATUS.EXEMPT]: 'bg-muted-foreground/50',
  [DAY_STATUS.WEEKEND]: 'bg-muted-foreground/40',
  [DAY_STATUS.NON_WORKING]: 'bg-muted-foreground/40',
};

/**
 * The mark that identifies a state independently of its colour.
 *
 * Religious holiday gets a plain `Star`, and it is the same star every tradition
 * gets in the observance notice — the calendar draws no distinction between faiths
 * anywhere. Two reasons it stays that way: the request itself never records which
 * faith it is for (`AbsenceRequest` holds a type and some dates, nothing else),
 * and where the tradition *is* known the label already names the holiday, so a
 * per-faith symbol would only rank traditions by which ones have an icon available.
 * The star means "religious observance", nothing narrower.
 */
const STATUS_GLYPH = {
  [DAY_STATUS.REMOTE]: House,
  [DAY_STATUS.VACATION]: TreePalm,
  [DAY_STATUS.RELIGIOUS]: Star,
  [DAY_STATUS.SICK]: Thermometer,
  [DAY_STATUS.EXEMPT]: Briefcase,
};

/** Tailwind classes for a day cell in `status`, with the today ring when asked. */
export const dayStatusClass = (status, { isToday = false } = {}) =>
  cn(STATUS_STYLES[status], isToday && TODAY_RING);

/** The legend/table dot colour for a status, or null if it has no swatch. */
export const dayStatusDot = (status) => STATUS_DOT[status] || null;

/**
 * The glyph for a status, rendered small enough to sit inside a calendar cell
 * without competing with the date number. Returns null for the states that
 * deliberately have none.
 */
export function DayStatusGlyph({ status, className }) {
  const Icon = STATUS_GLYPH[status];
  if (!Icon) return null;
  return <Icon aria-hidden="true" className={cn('h-3 w-3 shrink-0 opacity-80', className)} />;
}

/** Whether this status is drawn with a glyph — for legends and table cells. */
export const hasGlyph = (status) => Boolean(STATUS_GLYPH[status]);

/**
 * The mark on an observance in the calendar's advance notice.
 *
 * **One star for every tradition, deliberately.** The row's own label already names
 * the holiday, so a per-faith symbol would add no information the reader does not
 * already have — and it would mean ranking traditions by whichever ones happen to
 * have an icon available, which is not a judgement this calendar should make. The
 * star means "religious observance", nothing narrower.
 *
 * `Observance.tradition` is still stored; it is simply not what draws this.
 */
export function ObservanceGlyph({ className }) {
  return <Star aria-hidden="true" className={cn('h-3 w-3 shrink-0', className)} />;
}

export { STATUS_STYLES, STATUS_DOT, STATUS_GLYPH, TODAY_RING };
