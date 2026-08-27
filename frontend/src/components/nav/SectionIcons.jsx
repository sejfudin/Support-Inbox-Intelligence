/**
 * The colourful glyphs on the sidebar's section headers.
 *
 * Azure DevOps' pattern, and the reason it works: a **section** gets a filled,
 * multi-colour mark and a **row inside it** gets a monochrome line icon. The two
 * never compete, so the eye finds the group first and the row second. The nav rows
 * keep their lucide icons (`AppSidebar.jsx`); only headers use these.
 *
 * Hand-authored SVG rather than an icon package because nothing in `lucide-react`
 * is filled or multi-colour — mixing a lucide glyph in here would read as a
 * missing icon rather than as a different one.
 *
 * **The colours are decorative and deliberately fixed.** They are not tokens:
 * these are product marks, the same in every theme, exactly as Azure's are. That
 * is a real trade — `data-colorblind` replaces the app palette for accessibility
 * and these do not follow it — and it is only acceptable because no icon here is
 * the sole carrier of anything. Every section has its label beside the mark, and
 * status (the pending dot, the counts) is drawn from the tone tokens elsewhere on
 * the row. Do not start encoding meaning in these hues.
 *
 * Drawn on a 24 box and rendered at 26px — well above the 16px the nav rows
 * use, because multi-colour detail needs the pixels and because the size gap is
 * itself part of the hierarchy: the mark should out-weigh the line icons below it.
 *
 * The rendered size is set by the `className` the caller passes (Tailwind `h-`/`w-`
 * beat these presentational attributes); the attributes are the floor for anyone
 * who forgets one. Keep the two in step.
 */

const SIZE = { width: 26, height: 26, viewBox: '0 0 24 24', 'aria-hidden': 'true' };

/** Access / invitations — an envelope, mid-open. */
export function AccessIcon({ className }) {
  return (
    <svg {...SIZE} className={className} fill="none">
      <rect x="2.5" y="5.5" width="19" height="14" rx="3" fill="#3B82F6" />
      <path d="M2.5 8.5 12 14.5l9.5-6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18.5" cy="6.5" r="3.6" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.4" />
    </svg>
  );
}

/**
 * Workspace — two stacked sheets, the front one a window with a layout in it.
 *
 * **Red back sheet against a blue front sheet.** Two values of one hue is what a
 * drop shadow would have said, and at this size the shadow is invisible while two
 * blues read as one muddy shape; a hue change separates the sheets outright. There
 * is no white outline around the front sheet either — the hue change already does
 * that job, and the stroke only added a halo.
 *
 * The window is not empty: a rail and two content bars sit inside it, which is what
 * keeps the mark from reading as a plain blue square. One bar is yellow rather than
 * white, because three of the four other marks in the set carry a warm accent and
 * this one looked cold beside them. They are drawn at partial opacity so they read
 * as *contents* of the blue rather than as holes punched through it — the solid
 * white block this used to hold covered half the sheet and flattened the whole mark.
 */
export function WorkspaceIcon({ className }) {
  return (
    <svg {...SIZE} className={className} fill="none">
      <rect x="8" y="2.5" width="13.5" height="13.5" rx="3.2" fill="#EF3B3B" />
      <rect x="2.5" y="7" width="14.5" height="14.5" rx="3.2" fill="#3B82F6" />
      {/* The window's own rail. */}
      <rect x="4.6" y="9.4" width="3.1" height="9.7" rx="1.1" fill="#FFFFFF" fillOpacity="0.92" />
      {/* Two rows of content beside it, the first one warm. */}
      <rect x="9.3" y="9.4" width="5.9" height="2.6" rx="1.1" fill="#FBC02D" />
      <rect x="9.3" y="13.2" width="5.9" height="2.4" rx="1.1" fill="#FFFFFF" fillOpacity="0.6" />
      <rect x="9.3" y="16.7" width="3.8" height="2.4" rx="1.1" fill="#FFFFFF" fillOpacity="0.6" />
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
 * Six cards, each ~6×8 of the box, carry the same idea with room to be seen. The
 * last one is the "add" slot: a solid pale card with a plus on it, rather than the
 * dashed outline the full-size artwork uses — a 1.3px dashed border on a 6px box
 * is a grey blur at this size, while a 2-stroke plus on a filled card holds.
 */
export function BoardsIcon({ className }) {
  return (
    <svg {...SIZE} className={className} fill="none">
      <rect x="1" y="3" width="6" height="8" rx="1.9" fill="#3B9BF6" />
      <rect x="1" y="13" width="6" height="8" rx="1.9" fill="#7C4DEB" />
      <rect x="9" y="3" width="6" height="8" rx="1.9" fill="#EF3B3B" />
      <rect x="9" y="13" width="6" height="8" rx="1.9" fill="#FBC02D" />
      <rect x="17" y="3" width="6" height="8" rx="1.9" fill="#FBC02D" />
      <rect x="17" y="13" width="6" height="8" rx="1.9" fill="#C3D2EA" />
      <path d="M20 14.9v4.2M17.9 17h4.2" stroke="#5B6B85" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Mentoring — a mentor and the person they are bringing along. */
export function MentoringIcon({ className }) {
  return (
    <svg {...SIZE} className={className} fill="none">
      <circle cx="15.8" cy="7.6" r="3.1" fill="#3B82F6" />
      <path d="M9.7 21c0-3.4 2.7-6.1 6.1-6.1s6.1 2.7 6.1 6.1H9.7Z" fill="#3B82F6" />
      <circle cx="7.6" cy="7.2" r="3.7" fill="#7C4DEB" />
      <path
        d="M1.5 21c0-3.4 2.7-6.1 6.1-6.1s6.1 2.7 6.1 6.1H1.5Z"
        fill="#7C4DEB"
        stroke="#FFFFFF"
        strokeWidth="1.2"
      />
    </svg>
  );
}

/** Internship — the mortarboard. */
export function InternshipIcon({ className }) {
  return (
    <svg {...SIZE} className={className} fill="none">
      <path d="M6.5 11.5h11v5.2c0 1.7-2.5 3-5.5 3s-5.5-1.3-5.5-3v-5.2Z" fill="#7C4DEB" />
      <path d="M12 3.2 23 8.4 12 13.6 1 8.4 12 3.2Z" fill="#FBC02D" />
      <path d="M12 3.2 23 8.4 12 13.6 1 8.4 12 3.2Z" fill="#FDD34F" fillOpacity="0.55" />
      <path d="M19.4 9.6v5.6" stroke="#EF3B3B" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="19.4" cy="17.1" r="2.1" fill="#EF3B3B" />
    </svg>
  );
}

/**
 * Admin — the sliders, which is what the platform-management rows all are.
 *
 * No backing tile: a pale tile behind three thin tracks left the mark reading as a
 * grey smudge on a light theme, where the tile and the sidebar are nearly the same
 * value. The tracks carry it instead, at a weight that survives on both grounds,
 * and the knobs are the colour.
 */
export function AdminIcon({ className }) {
  return (
    <svg {...SIZE} className={className} fill="none">
      <path
        d="M3 6.5h18M3 12h18M3 17.5h18"
        stroke="#93A5C4"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <circle cx="8.5" cy="6.5" r="3.3" fill="#3B9BF6" />
      <circle cx="16" cy="12" r="3.3" fill="#EF3B3B" />
      <circle cx="7" cy="17.5" r="3.3" fill="#FBC02D" />
    </svg>
  );
}
