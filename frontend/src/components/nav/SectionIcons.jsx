/**
 * The section marks on the sidebar's collapsible headers.
 *
 * Azure DevOps' pattern, and the reason it works: a **section** gets a filled,
 * multi-colour mark and a **row inside it** gets a monochrome line icon. The two
 * never compete, so the eye finds the group first and the row second. The nav rows
 * keep their lucide icons (`AppSidebar.jsx`); only headers and rail tiles use these.
 *
 * Hand-authored SVG rather than an icon package because nothing in `lucide-react`
 * is filled or multi-colour — mixing a lucide glyph in here would read as a
 * missing icon rather than as a different one.
 *
 * **The four hues are the logo's.** Blue, purple, amber and red: under Symphony
 * Indigo these marks are the same family as the Task Manager lockup sitting right
 * above them in the rail, which is the whole reason the set is multi-colour at all.
 * Under any other palette they are re-painted in that palette's accent — the deal
 * `[data-brand-mark]` already strikes for the logo itself, so the marks are not the
 * one thing in the sidebar wearing the house brand while everything around them
 * wears the user's accent.
 *
 * **So no literal colours in here.** Every fill is a `--nav-mark-*` token from
 * `index.css`, named for the job it does in the drawing rather than its house hue,
 * because half of them stop being that hue the moment the palette changes. The
 * house values and the flatten rule are both in that file; read them before adding
 * a shape, because a shape has to work in two modes:
 *
 * - `lead` and `warm` are the accent when flattened, `second` and `hot` are the
 *   accent at 58%. Two shapes that must stay apart therefore take one from each
 *   pair — hue separates them under Symphony Indigo, value everywhere else.
 * - `knockout` is white in the house artwork and the sidebar's own ground
 *   elsewhere, so it is only ever a hole in something filled, never a shape drawn
 *   against bare sidebar.
 *
 * The set stays decorative either way: every section has its label beside the mark,
 * and status — the pending dot, the counts — is drawn from the tone tokens on the
 * row. Do not start encoding meaning in these colours.
 *
 * Drawn on a 24 box and rendered at 26px — well above the 16px the nav rows use,
 * because multi-colour detail needs the pixels and because the size gap is itself
 * part of the hierarchy: the mark should out-weigh the line icons below it.
 *
 * The rendered size is set by the `className` the caller passes (Tailwind `h-`/`w-`
 * beat these presentational attributes); the attributes are the floor for anyone
 * who forgets one. Keep the two in step.
 */

const LEAD = 'var(--nav-mark-lead)';
const SECOND = 'var(--nav-mark-second)';
const WARM = 'var(--nav-mark-warm)';
const HOT = 'var(--nav-mark-hot)';
const INLAY = 'var(--nav-mark-inlay)';
const KNOCKOUT = 'var(--nav-mark-knockout)';
const RAIL = 'var(--nav-mark-rail)';
const EMPTY = 'var(--nav-mark-empty)';
const EMPTY_INK = 'var(--nav-mark-empty-ink)';

const SIZE = { width: 26, height: 26, viewBox: '0 0 24 24', 'aria-hidden': 'true' };

/**
 * Access / invitations — an envelope, mid-open, with something waiting on it.
 *
 * The corner blob is ringed in the knockout colour, which is what keeps it from
 * reading as the pending dot the header draws two shapes to its right.
 */
export function AccessIcon({ className }) {
  return (
    <svg {...SIZE} className={className} fill="none">
      <rect x="2.5" y="5.5" width="19" height="14" rx="3" fill={LEAD} />
      <path d="M2.5 8.5 12 14.5l9.5-6" stroke={KNOCKOUT} strokeWidth="2" strokeLinecap="round" />
      <circle cx="18.5" cy="6.5" r="3.6" fill={HOT} stroke={KNOCKOUT} strokeWidth="1.4" />
    </svg>
  );
}

/**
 * Workspace — two stacked sheets, the front one a window with a layout in it.
 *
 * **`hot` behind `lead`**: a red back sheet under a blue front one in the house
 * palette, and full accent over 58% accent in every other. Two shapes of one value
 * is what a drop shadow would have said, and at this size the shadow is invisible
 * while two equal fills read as one muddy shape — the pair has to be a hue apart or
 * a value apart, and this is the token pairing that gives both. There is no outline
 * around the front sheet either; the separation already does that job and the stroke
 * only added a halo.
 *
 * The window is not empty: a rail and two content bars sit inside it, which is what
 * keeps the mark from reading as a plain blue square. The first bar is `inlay` —
 * amber here, because three of the four other marks carry a warm accent and this one
 * looked cold beside them, and a knockout when the accent takes over, since content
 * cannot be painted in the colour of the sheet it is sitting on. The rest are drawn
 * at partial opacity so they read as *contents* of the sheet rather than as holes
 * punched through it — the solid white block this used to hold covered half the
 * sheet and flattened the whole mark.
 */
export function WorkspaceIcon({ className }) {
  return (
    <svg {...SIZE} className={className} fill="none">
      <rect x="8" y="2.5" width="13.5" height="13.5" rx="3.2" fill={HOT} />
      <rect x="2.5" y="7" width="14.5" height="14.5" rx="3.2" fill={LEAD} />
      {/* The window's own rail. */}
      <rect x="4.6" y="9.4" width="3.1" height="9.7" rx="1.1" fill={KNOCKOUT} fillOpacity="0.92" />
      {/* Two rows of content beside it, the first one warm. */}
      <rect x="9.3" y="9.4" width="5.9" height="2.6" rx="1.1" fill={INLAY} />
      <rect x="9.3" y="13.2" width="5.9" height="2.4" rx="1.1" fill={KNOCKOUT} fillOpacity="0.6" />
      <rect x="9.3" y="16.7" width="3.8" height="2.4" rx="1.1" fill={KNOCKOUT} fillOpacity="0.6" />
    </svg>
  );
}

/**
 * Boards — cards in columns, the last slot still empty.
 *
 * **The pale column tiles from the full-size artwork are gone, on purpose.** Three
 * tiles plus six cards plus a dashed slot is ten shapes in a 24 box: every
 * rectangle lands under 4px and the mark reads as speckle rather than as a board.
 * The tiles were also the first thing to disappear — a `#D7E2F4` panel sits almost
 * on top of the sidebar's own value in a light theme, so they cost a third of the
 * shape budget and returned nothing.
 *
 * Six cards, each ~6×8 of the box, carry the same idea with room to be seen. They
 * are laid out so no two cards sharing an edge take tokens from the same half of
 * the pair — otherwise the accent palettes turn a column into one flat bar. The last
 * card is the "add" slot: a solid pale card with a plus on it, rather than the
 * dashed outline the full-size artwork uses — a 1.3px dashed border on a 6px box is
 * a grey blur at this size, while a 2-stroke plus on a filled card holds. Neutral in
 * every palette, because the point of that slot is that nothing is in it yet.
 */
export function BoardsIcon({ className }) {
  return (
    <svg {...SIZE} className={className} fill="none">
      <rect x="1" y="3" width="6" height="8" rx="1.9" fill={LEAD} />
      <rect x="1" y="13" width="6" height="8" rx="1.9" fill={SECOND} />
      <rect x="9" y="3" width="6" height="8" rx="1.9" fill={HOT} />
      <rect x="9" y="13" width="6" height="8" rx="1.9" fill={WARM} />
      <rect x="17" y="3" width="6" height="8" rx="1.9" fill={WARM} />
      <rect x="17" y="13" width="6" height="8" rx="1.9" fill={EMPTY} />
      <path
        d="M20 14.9v4.2M17.9 17h4.2"
        stroke={EMPTY_INK}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Mentoring — a mentor and the person they are bringing along.
 *
 * The near figure is `lead` and the far one `second` — the near one has to be the
 * stronger of the pair, which under the accent palettes means the full-strength
 * token, and the knockout hairline along it separates the two bodies where they
 * overlap. Under Symphony Indigo that puts blue in front of purple; the pair was
 * the other way round when these hues were literals and nothing but the drawing
 * order depended on it.
 */
export function MentoringIcon({ className }) {
  return (
    <svg {...SIZE} className={className} fill="none">
      <circle cx="15.8" cy="7.6" r="3.1" fill={SECOND} />
      <path d="M9.7 21c0-3.4 2.7-6.1 6.1-6.1s6.1 2.7 6.1 6.1H9.7Z" fill={SECOND} />
      <circle cx="7.6" cy="7.2" r="3.7" fill={LEAD} />
      <path
        d="M1.5 21c0-3.4 2.7-6.1 6.1-6.1s6.1 2.7 6.1 6.1H1.5Z"
        fill={LEAD}
        stroke={KNOCKOUT}
        strokeWidth="1.2"
      />
    </svg>
  );
}

/**
 * Internship — the mortarboard.
 *
 * The board is the silhouette, so it takes `warm` — full accent when flattened —
 * and the cap beneath it `second`, which is where it sits anyway, in the board's
 * shadow. The tassel is `hot`: it hangs off the board's right edge into bare
 * sidebar, so it needs to differ from the board rather than from the ground.
 */
export function InternshipIcon({ className }) {
  return (
    <svg {...SIZE} className={className} fill="none">
      <path d="M6.5 11.5h11v5.2c0 1.7-2.5 3-5.5 3s-5.5-1.3-5.5-3v-5.2Z" fill={SECOND} />
      <path d="M12 3.2 23 8.4 12 13.6 1 8.4 12 3.2Z" fill={WARM} />
      <path d="M19.4 9.6v5.6" stroke={HOT} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="19.4" cy="17.1" r="2.1" fill={HOT} />
    </svg>
  );
}

/**
 * Admin — the sliders, which is what the platform-management rows all are.
 *
 * No backing tile: a pale tile behind three thin tracks left the mark reading as a
 * grey smudge on a light theme, where the tile and the sidebar are nearly the same
 * value. The tracks carry it instead, at a weight that survives on both grounds,
 * and the knobs are the colour — alternating across the pair so three circles on
 * three parallel lines do not read as one dotted row once the palette flattens them.
 */
export function AdminIcon({ className }) {
  return (
    <svg {...SIZE} className={className} fill="none">
      <path d="M3 6.5h18M3 12h18M3 17.5h18" stroke={RAIL} strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="8.5" cy="6.5" r="3.3" fill={LEAD} />
      <circle cx="16" cy="12" r="3.3" fill={HOT} />
      <circle cx="7" cy="17.5" r="3.3" fill={WARM} />
    </svg>
  );
}
