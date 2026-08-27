import { NavLink, matchPath, useLocation, useMatch } from 'react-router-dom';
import { isAdmin, isMentor, isIntern } from '@/helpers/roles';
import {
  User,
  Archive,
  ChevronDown,
  FileQuestionMark,
  LayoutDashboard,
  ClipboardList,
  Building2,
  ChartNoAxesCombined,
  Settings,
  Mail,
  Database,
  GraduationCap,
  Send,
  Code2,
  CalendarCheck,
  CalendarDays,
  CalendarClock,
  CalendarOff,
  Target,
  TrendingUp,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsUpDown,
  UserRound,
} from 'lucide-react';
import WorkspaceSwitcher from '@/components/WorkspaceSwitcher';
import { ThemeAppearanceSubmenu } from '@/components/ThemeSwitcher';
import { WhatsNewButton } from '@/components/onboarding/WhatsNewButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLogoutUser } from '@/queries/auth';
import { useMyInvitations } from '@/queries/invitations';
import { useAbsenceRequests } from '@/queries/absenceRequests';
import { useStaffingRequestNews } from '@/queries/staffingRequests';
import { Avatar } from './Avatar';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import { useAuth } from '@/context/AuthContext';
import { useCanManageActiveWorkspace } from '@/hooks/useCanManageActiveWorkspace';
import NavbarNotifications from '@/components/NavbarNotifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Separator } from '@/components/ui/separator';
import { TaskManagerBrand } from '@/components/TaskManagerBrand';
// The Accordion primitives, not `components/ui/accordion.jsx`: that wrapper puts
// `border-b` on every item and sizes its trigger for page content, and it is
// shared with the settings pages — restyling it there to suit a 34px nav row is
// how one screen's tweak becomes another screen's regression.
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import {
  AccessIcon,
  AdminIcon,
  BoardsIcon,
  InternshipIcon,
  MentoringIcon,
  WorkspaceIcon,
} from '@/components/nav/SectionIcons';
import { useTourActive } from '@/components/onboarding/tourPreview';
import {
  readStoredPreference,
  useStoredPreference,
  writeStoredPreference,
} from '@/hooks/useStoredPreference';
import { DEFAULT_NAV_STYLE, NAV_STYLE_STORAGE_KEY, isValidNavStyle } from '@/helpers/uiPreferences';
import {
  NAV_SECTIONS_STORAGE_KEY,
  closedListFor,
  findActiveSectionKey,
  isValidClosedSections,
  resolveOpenSections,
  rollupSignals,
} from '@/helpers/navSections';

// Shared easing for every rail affordance so the width slide, the label
// crossfade, and the row reflow all move on the same curve. easeInOutCubic —
// gentle acceleration and deceleration at both ends so the motion reads as
// smooth rather than snapping away at the start.
const RAIL_EASE = 'ease-[cubic-bezier(0.65,0,0.35,1)]';

// A label that lives inside a rail row. Collapsing the sidebar fades it out AND
// squeezes its width to 0 so the row's icon reflows to center in sync with the
// panel slide — swapping to `display:none` instead would snap the text away at
// frame 0 while the box was still animating.
// `max-w-[12rem]` (not `none`) gives the width transition an explicit start
// length so it animates to `max-w-0` instead of snapping — a length is required
// at both ends. 12rem clears the widest rail label with room to spare.
const collapsibleLabel = `max-w-[12rem] overflow-hidden opacity-100 transition-[max-width,opacity] duration-300 ${RAIL_EASE} group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0`;

// Every icon in the nav sits in a slot of this width — a 26px section mark and a
// 16px row glyph alike — so they line up as one column down the sidebar instead of
// each being centred on its own axis. Without it the two sizes step in and out by
// 3px and the rail reads as ragged.
const ICON_SLOT = 'flex w-[26px] shrink-0 items-center justify-center';

const navTestSlug = (to) =>
  to
    .replace(/^\//, '')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-]/gi, '') || 'home';

/**
 * Collapsed-rail tooltip: wraps a rail control so its label appears to the
 * right. Centralizes the `side="right"` convention every rail affordance shares.
 */
function RailTooltip({ label, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * One nav row. Collapsed (icon rail) it shrinks to a centred icon and the label
 * moves into a tooltip — the label crossfades to zero width (see
 * `collapsibleLabel`) rather than unmounting, so it animates in step with the
 * panel slide instead of snapping away.
 *
 * Active state comes from `useMatch`, NOT NavLink's `className` callback, because
 * in the rail this link is a `TooltipTrigger asChild`: Radix's Slot merges
 * className with `[slot, child].filter(Boolean).join(' ')`, which stringifies a
 * className *function* into its own source code and silently drops every real
 * class. That wiped the layout classes in the collapsed state only.
 */
function NavItem({ item, collapsed, labelled = false }) {
  const Icon = item.icon;
  const isActive = Boolean(useMatch({ path: item.to, end: true }));

  const link = (
    <NavLink
      to={item.to}
      end
      data-test={`sidebar-nav-${navTestSlug(item.to)}-link`}
      // Every nav row is tour-targetable by route, so announcing a feature in
      // `whatsNewSteps.js` needs no change here — point a step at
      // `[data-tour="nav-<slug>"]`. Derived from `to` rather than configured per
      // item so the two can never drift apart.
      data-tour={`nav-${navTestSlug(item.to)}`}
      className={cn(
        `relative flex w-full items-center gap-2.5 text-[12.5px] font-medium transition-all duration-300 ${RAIL_EASE}`,
        // `size-[34px]` lands after the height below and wins, so the rail keeps its
        // 34px square tile whichever shape the expanded panel is using.
        'group-data-[collapsible=icon]:size-[34px] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:rounded-[var(--r-control)] group-data-[collapsible=icon]:px-0',

        // `labelled` is the shape this sidebar had before sections could collapse,
        // and it is kept **byte-for-byte** — 34px row, rounded, 3px inset bar,
        // `/20`–`/25` fill, semibold. Someone who turns collapsing off is asking for
        // the old sidebar back, so the old sidebar is what they get; do not "unify"
        // these two branches, the divergence is the feature.
        labelled && 'h-[34px] rounded-[var(--r-control)] px-2.5',
        // The collapsible shape: square, and full-width so the fill runs edge to edge
        // of the sidebar (the section it sits in is full-bleed — see `NavGroup`).
        // `px-[22px]` keeps the content where `px-3` + `px-2.5` used to put it now
        // that `SidebarContent` no longer pads.
        //
        // 40px tall against the 44px header. The rows carry no gaps between them any
        // more, so their own height is the only thing left setting the nav's density —
        // at 34px a gapless stack read as a cramped list rather than as rows.
        !labelled && 'h-[40px] rounded-none px-[22px]',

        // Three cues, because at 12.5px no single one of them is enough on its own:
        // weight, tint (stronger in dark themes, where the same wash of `--primary`
        // separates far less than it does over near-white), and `.accent-ink` — a
        // lightness-clamped `--primary` that gives the ink real contrast against its
        // own tint (see `index.css`).
        isActive && 'accent-ink',
        // The bar draws in `currentColor` so it tracks that accent rather than the
        // raw token, which in most themes is a light button fill and would leave a
        // 3px sliver you can't see.
        isActive &&
          labelled &&
          'bg-primary/20 font-semibold shadow-[inset_3px_0_0_currentColor] dark:bg-primary/25',
        // Collapsible: no bar (the section band already marks this block's left edge,
        // so a second left-edge marker inside it read as clutter), bold rather than
        // semibold, and a lighter fill because it now sits *inside* that band — two
        // strong washes stacked read as one muddy block. Dark still needs its own
        // step: `/10` over near-black nearly disappears.
        isActive && !labelled && 'bg-primary/10 font-bold dark:bg-primary/20',
        !isActive && 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {/* The 22px slot only in the collapsible shape, where a row's glyph has to
          line up under the section's 22px colour mark. `labelled` has no header
          icon to line up with, so it keeps development's bare 16px icon. */}
      <span className={labelled ? 'contents' : ICON_SLOT}>
        <Icon className={labelled ? 'h-4 w-4 shrink-0' : 'h-4 w-4'} />
      </span>
      {/* No weight of its own — it inherits the row's, so the active row's
          `font-bold` actually reaches the label instead of being overridden. */}
      <span className={cn('min-w-0 flex-1 truncate', collapsibleLabel)}>{item.label}</span>
      {/* "Something here needs you", with no number attached — used where a count
          would be noise (one pending remote-work request is as actionable as four).
          Positioned absolutely rather than in the flow so it survives the rail:
          `collapsibleLabel` crossfades the label to zero width when collapsed, and
          an inline dot would go with it, which is exactly when the dot matters
          most. Amber matches the `warning` badge the same pending state uses on
          the Attendance page, so one signal reads as one thing. */}
      {item.dot ? (
        <span
          // Vertically centred on the row, not pinned to its top edge — the row is
          // a single line of text, so a top-aligned dot reads as misaligned rather
          // than as a badge. In the collapsed rail it moves to the icon's top
          // corner instead, where centring would sit it on top of the glyph.
          className="pointer-events-none absolute right-2 top-1/2 flex h-2 w-2 -translate-y-1/2 group-data-[collapsible=icon]:right-0.5 group-data-[collapsible=icon]:top-0.5 group-data-[collapsible=icon]:translate-y-0"
          aria-hidden="true"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--tone-warning))] opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--tone-warning))]" />
        </span>
      ) : null}
      {item.badge ? (
        <span
          className={cn(
            'ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground group-data-[collapsible=icon]:min-w-0',
            collapsibleLabel
          )}
        >
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      ) : null}
    </NavLink>
  );

  if (!collapsed) return link;

  // The dot is the only cue in the rail, and a dot alone says nothing about what
  // is waiting — so the tooltip is where it gets named.
  const suffix = item.badge
    ? ` (${item.badge})`
    : item.dotLabel && item.dot
      ? ` — ${item.dotLabel}`
      : '';

  return <RailTooltip label={`${item.label}${suffix}`}>{link}</RailTooltip>;
}

/** The rows of one group, shared by both `NavGroup` shapes. */
function NavGroupRows({ items, collapsed, className, labelled = false }) {
  return (
    <SidebarMenu
      className={cn(
        'group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:pl-0 group-data-[collapsible=icon]:pt-0',
        className
      )}
    >
      {items.map((item) => (
        <SidebarMenuItem key={item.to}>
          <NavItem item={item} collapsed={collapsed} labelled={labelled} />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

/**
 * One section in the collapsed icon rail: just its colour mark, with the rows in a
 * flyout to the right — Azure's rail.
 *
 * **This is the one place the rail hides rows**, which is why three things here are
 * not optional. The mark is a link to the section's first row, so the common case is
 * still one click. The pending dot and counts roll up onto the mark, because a row
 * nobody can see cannot carry its own signal. And the flyout opens on focus as well
 * as hover, so the rows are not mouse-only.
 *
 * It has to be a `Popover` rather than an absolutely-positioned panel: the rail sets
 * `overflow-hidden`, so anything drawn inside it is clipped at 34px. Popover portals
 * out to the body, which is the only way past that.
 */
function SectionFlyoutBody({ title, items, showTitle }) {
  return (
    <>
      {/* Only in the rail. There the mark is all you can see, so the panel has to say
          which section it belongs to. In the expanded sidebar the header you are
          hovering already reads "Boards" an inch to the left, and repeating it inside
          the panel is the same word twice for no reader. */}
      {showTitle ? (
        <div className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {title}
        </div>
      ) : null}
      <SidebarMenu className="gap-0">
        {items.map((item) => (
          <SidebarMenuItem key={item.to}>
            {/* `collapsed={false}` and `labelled`: inside the flyout there is room for
                labels, so these are ordinary rows — not rail tiles, and not the
                full-bleed square rows of the panel they are standing in for. */}
            <NavItem item={item} collapsed={false} labelled />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </>
  );
}

function RailSection({ section, active, onOpen, openFlyout, closeFlyout }) {
  const { key, title, items, icon: SectionIcon } = section;
  const visible = items.filter((item) => !item.hidden);

  if (visible.length === 0) return null;

  const signals = rollupSignals(visible);

  return (
    <NavLink
      to={visible[0].to}
      data-test={`sidebar-rail-section-${key}`}
      data-tour={`nav-section-${key}`}
      onClick={() => onOpen?.(key)}
      onMouseEnter={(event) => openFlyout(key, event.currentTarget)}
      onMouseLeave={closeFlyout}
      onFocus={(event) => openFlyout(key, event.currentTarget)}
      onBlur={closeFlyout}
      aria-label={signals.label ? `${title} — ${signals.label}` : title}
      className={cn(
        'relative flex size-[34px] shrink-0 items-center justify-center rounded-[var(--r-control)] transition-colors duration-200',
        active ? 'bg-foreground/10' : 'hover:bg-accent'
      )}
    >
      <SectionIcon className="h-[22px] w-[22px]" />
      {/* Rolled up from rows the rail cannot show. Pinned to the mark's corner
          rather than centred, where it would sit on top of the glyph. */}
      {signals.dot ? (
        <span
          className="pointer-events-none absolute right-0 top-0 flex h-2 w-2"
          aria-hidden="true"
        >
          <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-[hsl(var(--tone-warning))] opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--tone-warning))]" />
        </span>
      ) : null}
      {signals.badge ? (
        <span
          className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground"
          aria-hidden="true"
        >
          {signals.badgeText}
        </span>
      ) : null}
    </NavLink>
  );
}

/**
 * The `labelled` shape: the plain captioned list, every group always open.
 *
 * This is what the sidebar looked like before sections could collapse, kept as a
 * choice rather than replaced — see the `navStyle` preference. It renders no
 * accordion at all, so there is no controlled value and nothing to persist; the
 * caption hides itself in the rail and the leading separator takes over, exactly
 * as it always did.
 */
function NavGroupLabelled({ section, collapsed, showSeparator, className }) {
  const visible = section.items.filter((item) => !item.hidden);
  if (visible.length === 0) return null;

  return (
    <div className={className}>
      {showSeparator && <Separator className="mb-3" />}
      <div className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/75 group-data-[collapsible=icon]:hidden">
        {section.title}
      </div>
      <NavGroupRows items={visible} collapsed={collapsed} labelled />
    </div>
  );
}

/**
 * A collapsible group of nav rows.
 *
 * Two shapes in one component, switched by CSS rather than by a JS branch, so
 * the panel slide keeps its manners: the header is `hidden` in the rail and the
 * separator only appears there. Branching in JS would swap the whole subtree on
 * the frame the sidebar starts moving, which is the snap `collapsibleLabel`
 * exists to avoid (read its comment).
 *
 * - **Expanded**: a header row is the control — section icon, label, chevron —
 *   and there is no separator, because the headers already say where one group
 *   ends and the next begins.
 * - **Rail**: no header (there is nothing for a label to sit next to and no way
 *   to click one), and the leading separator the mockup shows takes its place.
 *   The caller forces every section open in this state; see `allOpen` in
 *   `helpers/navSections.js`.
 */
function NavGroup({
  section,
  collapsed,
  open,
  active,
  showSeparator,
  className,
  onOpen,
  openFlyout,
  closeFlyout,
}) {
  const { key, title, items, icon: SectionIcon } = section;
  const visible = items.filter((item) => !item.hidden);
  if (visible.length === 0) return null;

  // Where the header itself goes: the section's first visible row. Not a route
  // configured per section — the first row *is* the section's landing page, and
  // deriving it means reordering the rows moves the header's destination with them
  // rather than leaving a hardcoded target pointing at the second item.
  const firstTo = visible[0].to;

  // Only when closed. Open, the rows carry their own dot and counts, and showing
  // them twice reads as two separate things needing attention.
  const signals = open ? null : rollupSignals(visible);
  const hasSignal = Boolean(signals?.dot || signals?.badge);

  return (
    <AccordionPrimitive.Item
      value={key}
      className={cn(
        // Azure's shape: the section holding the page you are on is a band across
        // the **whole group**, header and rows together, and the active row then
        // sits inside it with its own fill. Two nested levels of "here", which is
        // what makes a long nav navigable — the band answers "which part of the
        // app" before you have read a single row.
        //
        // **Neutral, not accent-tinted**, and very light. Azure's band is a lighter
        // grey rather than a colour, and the reason holds here: an accent wash
        // behind the accent-tinted active row put two versions of the same hue on
        // top of each other and the row stopped being findable inside its own
        // section. `foreground/5` also needs no dark-mode variant — the token flips,
        // so it is a dark wash on light and a light wash on dark.
        //
        // **A plain rectangle: no radius, no padding.** It hugs the header and rows
        // exactly, so its edges land on the row edges rather than floating a few
        // pixels outside them — a rounded, padded band read as a card wrapped around
        // the group instead of as the group being marked. It also means nothing to
        // suppress when the section is collapsed: with no bottom padding there is no
        // grey sliver left hanging under a closed header.
        //
        // Suppressed in the rail, where there is no header and a tinted column of
        // icons would read as a selection rather than as a group.
        active && 'bg-foreground/5 group-data-[collapsible=icon]:bg-transparent',
        className
      )}
    >
      {showSeparator && <Separator className="mb-3 hidden group-data-[collapsible=icon]:block" />}

      {/* **Two controls, not one — Azure's split header.**
          The label navigates to the section's first row (Workspace → Dashboard,
          Boards → Tickets); the chevron toggles the section. One control doing both
          cannot work: "click to open the group" and "click to collapse the group"
          are the same gesture on the same pixel, so a click would either navigate
          while collapsing the thing you navigated into, or stop collapsing working.

          44px tall against the rows' 34, square and full-bleed like them — the two
          halves each carry one side's padding so the pair still spans both sidebar
          edges. */}
      {/* A **collapsed** section peeks on hover: its rows appear in a flyout to the
          right, so single-open costs nothing — you can read a group you are not in
          without collapsing the one you are. An open section gets no flyout, which
          would only repeat what is already on screen underneath it. The panel itself
          is rendered once by `AppSidebar`; this only reports the intent. */}
      <AccordionPrimitive.Header
        onMouseEnter={(event) => (open ? closeFlyout?.() : openFlyout?.(key, event.currentTarget))}
        onMouseLeave={() => closeFlyout?.()}
        className={cn(
          'flex items-stretch text-[13px] font-semibold transition-colors duration-200 group-data-[collapsible=icon]:hidden',
          // Hover lights the whole header, both halves, so it reads as one row even
          // though it is two hit areas.
          'hover:bg-accent hover:text-foreground',
          // Full-strength ink on the active section's own header, so the band has
          // a head rather than just being a wash behind everything.
          active ? 'text-foreground' : 'text-foreground/80'
        )}
      >
        <NavLink
          to={firstTo}
          data-test={`sidebar-section-${key}-link`}
          data-tour={`nav-section-${key}`}
          data-active={active ? 'true' : undefined}
          // Opens the section as well as navigating into it. Without this, clicking
          // the header of a section you had collapsed *while standing inside it*
          // would move the page but leave the group shut: `activeSectionKey` never
          // changes, so the effect that force-opens on navigation never fires.
          onClick={() => onOpen?.(key)}
          // The dot alone says nothing about what is waiting, and a closed section is
          // exactly where nobody can go and look. So the name carries it, the same
          // way `NavItem` builds its rail tooltip suffix.
          aria-label={hasSignal && signals.label ? `${title} — ${signals.label}` : undefined}
          className="flex h-[44px] min-w-0 flex-1 items-center gap-2.5 rounded-none pl-[22px] pr-2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          {/* 26px against the rows' 16: these are filled, layered accent marks
          that need the pixels, and the size gap is part of the hierarchy — a
          section mark should out-weigh the line icons under it. Same `ICON_SLOT` as a
          row, so the two sizes still share one centre line. See
          `nav/SectionIcons.jsx`. */}
          <span className={ICON_SLOT}>
            <SectionIcon className="h-[26px] w-[26px]" />
          </span>
          <span className="min-w-0 flex-1 truncate text-left">{title}</span>

          {/* Rolled up from the rows this section is hiding. */}
          {signals?.dot ? (
            <span className="pointer-events-none relative flex h-2 w-2 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-[hsl(var(--tone-warning))] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--tone-warning))]" />
            </span>
          ) : null}
          {signals?.badge ? (
            <span
              className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground"
              aria-hidden="true"
            >
              {signals.badgeText}
            </span>
          ) : null}
        </NavLink>

        <AccordionPrimitive.Trigger
          data-test={`sidebar-section-${key}-toggle`}
          // Named, because on its own a chevron says neither what it opens nor which
          // way it is about to go.
          aria-label={`${open ? 'Collapse' : 'Expand'} ${title} section`}
          className="flex h-[44px] shrink-0 items-center rounded-none pl-1 pr-[22px] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          {/* Down when open, right when closed. No `motion-reduce:` needed — the
          `motion: reduced` preference kills every transition through
          `[data-motion='reduced'] *` in `index.css`. */}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
              !open && '-rotate-90'
            )}
            aria-hidden="true"
          />
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>

      <AccordionPrimitive.Content
        // `nav-section-*`, not the settings pages' `accordion-*`: longer travel,
        // easeInOutCubic and an opacity fade. See the keyframes in
        // `tailwind.config.js` for why the two are kept apart.
        className="overflow-hidden data-[state=closed]:animate-nav-section-up data-[state=open]:animate-nav-section-down"
      >
        {/* **No left indent, and this is load-bearing twice over.**
            1. Every row icon then sits directly under the section's own 22px mark —
               one unbroken column of icons down the rail (that is what `ICON_SLOT`
               is for; an indent here shifted the small glyphs 8px off that line).
            2. The row is `w-full` of the section, so an active row's fill runs the
               full width of the band instead of stopping 8px short of its left edge.
            The header's size, weight and colour mark are what say "this is the
            group" — nesting does not need a step in the margin as well. */}
        {/* **No gaps anywhere: not above the first row, not between rows.** The
            collapsible nav is a solid stack of full-bleed rows, so every gap showed
            up as a stripe of bare sidebar cutting through the active section's grey
            band. `gap-0` overrides `SidebarMenu`'s own `gap-1`.

            The rail is the exception and keeps `gap-1`: there the rows are 34px icon
            tiles rather than full-width bars, and tiles that touch read as one column
            of blocks instead of separate buttons. */}
        <NavGroupRows
          items={visible}
          collapsed={collapsed}
          className="gap-0 group-data-[collapsible=icon]:gap-1"
        />
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}

export default function AppSidebar() {
  const { user, isLoginPending } = useAuth();
  const { canManage: canManageActiveWorkspace } = useCanManageActiveWorkspace();
  const { mutate: logout } = useLogoutUser();
  const location = useLocation();
  const { setOpenMobile, isMobile, state, toggleSidebar } = useSidebar();
  const { data: invitations = [] } = useMyInvitations();
  const pendingCount = invitations.length;
  // Admin-only route (`requireRole(ADMIN, LEADERSHIP)`); gate the query so a
  // mentor/intern sidebar never fires a request that would 403.
  const { data: staffingNews } = useStaffingRequestNews({ enabled: isAdmin(user?.role) });
  const staffingRequestsBadge = staffingNews?.count > 0 ? staffingNews.count : undefined;

  // Admin-only: the endpoint is admin-guarded, so asking as anyone else is a
  // guaranteed 403. Shares its query key with the Attendance page's own fetch, so
  // opening that page costs no extra request.
  const { data: absenceRequests } = useAbsenceRequests(
    { status: 'pending' },
    { enabled: isAdmin(user?.role) }
  );
  const pendingRequests = absenceRequests?.pendingCount ?? 0;

  // Tooltips replace labels only in the desktop rail — the mobile sheet always
  // shows the full-width sidebar, so it must keep its labels.
  const collapsed = state === 'collapsed' && !isMobile;

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);

  // Split out of one seven-row `workspaceNav` to match the mockup. The two halves
  // do different jobs — where you *are* in the workspace versus the boards you
  // work on — and the split is also what gives a mentor or an intern more than a
  // single section to collapse.
  const workspaceNav = [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Analytics', to: '/analytics', icon: ChartNoAxesCombined },
    { label: 'Dailies', to: '/dailies', icon: CalendarDays },
    ...(user?.workspaceId && canManageActiveWorkspace
      ? [
          {
            label: 'Workspace Management',
            to: `/admin/workspaces/${user.workspaceId}`,
            icon: Settings,
          },
        ]
      : []),
  ];

  const boardsNav = [
    { label: 'Tickets', to: '/tickets', icon: ClipboardList },
    {
      label: 'Backlog',
      to: '/backlog',
      icon: FileQuestionMark,
      hidden: !(isAdmin(user?.role) || isMentor(user?.role) || isIntern(user?.role)),
    },
    { label: 'Archive', to: '/archive', icon: Archive },
  ];

  const invitationNav =
    pendingCount > 0
      ? [{ label: 'Invitations', to: '/invitations', icon: Mail, badge: pendingCount }]
      : [];

  const mentorNav = isMentor(user?.role)
    ? [
        { label: 'My Interns', to: '/my-interns', icon: GraduationCap },
        { label: 'My Workspaces', to: '/workspaces', icon: Building2 },
      ]
    : [];

  const internNav = isIntern(user?.role)
    ? [
        // First in the group: it is the read-only overview of everything the
        // programme records about them, and the two rows below it are the parts they
        // can act on (declare a technology, check in).
        { label: 'My Progress', to: '/my-progress', icon: TrendingUp },
        { label: 'Position & Technologies', to: '/my-technologies', icon: Code2 },
        { label: 'Attendance', to: '/my-attendance', icon: CalendarCheck },
      ]
    : [];

  const adminNav = isAdmin(user?.role)
    ? [
        {
          label: 'All Users',
          to: '/admin/users',
          icon: User,
        },
        {
          label: 'All Workspaces',
          to: '/admin/workspaces',
          icon: Building2,
        },
        {
          label: 'Attendance',
          to: '/attendance',
          icon: CalendarCheck,
        },
        {
          label: 'Absence Requests',
          to: '/admin/absence-requests',
          icon: CalendarOff,
          // Time-away requests are decided by admins (mentors have no attendance
          // view at all), and a request nobody notices goes stale on the very day
          // it was asked for — so the pending state has to be visible from
          // anywhere in the app, not only once you are already on the page. A sick
          // day makes that sharper still: it is always for today or the last couple
          // of days, so an unanswered one is stale almost immediately.
          dot: pendingRequests > 0,
          dotLabel:
            pendingRequests === 1 ? '1 time-away request' : `${pendingRequests} time-away requests`,
        },
        {
          label: 'Daily Insights',
          to: '/admin/daily-insights',
          icon: CalendarClock,
        },
        {
          label: 'Platform Management',
          to: '/admin/platform-management',
          icon: Database,
        },
        {
          label: 'Recommendations',
          to: '/recommendations',
          icon: Send,
        },
        {
          label: 'Specialization',
          to: '/specialization',
          icon: Target,
        },
        {
          label: 'Requests',
          to: '/admin/staffing-requests',
          icon: ClipboardList,
          badge: staffingRequestsBadge,
        },
      ]
    : [];

  const hasWorkspaceNav = Boolean(user?.workspaceId);
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  /**
   * Every section, in order, with the empty ones dropped.
   *
   * Filtering here rather than inside `NavGroup` is what lets the separator rule
   * be "every section but the first": the five call sites used to each hand-compute
   * a `showSeparator` boolean out of the other groups' lengths, which is the same
   * fact stated five times.
   */
  const sections = [
    // `icon` is the filled accent section mark from `nav/SectionIcons.jsx`, and it
    // is used **only by the collapsible shape**. `labelled` is a plain captioned
    // list by design — an uppercase 10.5px caption with a 18px filled mark beside
    // it reads as a heading that lost its row.
    { key: 'access', title: 'Access', icon: AccessIcon, items: invitationNav },
    ...(hasWorkspaceNav
      ? [
          { key: 'workspace', title: 'Workspace', icon: WorkspaceIcon, items: workspaceNav },
          { key: 'boards', title: 'Boards', icon: BoardsIcon, items: boardsNav },
        ]
      : []),
    { key: 'mentoring', title: 'Mentoring', icon: MentoringIcon, items: mentorNav },
    { key: 'internship', title: 'Internship', icon: InternshipIcon, items: internNav },
    { key: 'admin', title: 'Admin', icon: AdminIcon, items: adminNav },
  ].filter((section) => section.items.some((item) => !item.hidden));

  /**
   * Which sections this person has collapsed. Per device — see the header comment
   * in `helpers/navSections.js`; the row in `ThemeConfigContext`'s table is
   * `PREFERENCE_SCOPE.DEVICE`, so the sync layer declares it and never pushes it.
   *
   * Read in the initialiser, not through `useStoredPreference`, for the reason
   * that hook's own docs give: it reads storage in an effect, so the first paint
   * would show every section open and the stored ones would then animate shut on
   * every single page load.
   */
  const [closedSections, setClosedSectionsState] = useState(() =>
    readStoredPreference(NAV_SECTIONS_STORAGE_KEY, '', isValidClosedSections)
  );

  // Collapsible headers, or the plain captioned list. An account preference, so it
  // travels; `useStoredPreference` is right here (unlike for the closed list) because
  // there is no enter/exit animation to mistime — the two shapes just swap.
  const [navStyle] = useStoredPreference(NAV_STYLE_STORAGE_KEY, DEFAULT_NAV_STYLE, isValidNavStyle);
  const sectionsCollapsible = navStyle !== 'labelled';

  const setClosedSections = useCallback((next) => {
    setClosedSectionsState(next);
    writeStoredPreference(NAV_SECTIONS_STORAGE_KEY, next);
  }, []);

  const activeSectionKey = findActiveSectionKey(sections, (to) =>
    Boolean(matchPath({ path: to, end: true }, location.pathname))
  );

  // Sections opened *for* the person rather than *by* them: the one holding the
  // page they are on. Live state, never written back — persisting it would mean
  // navigating permanently reopens sections they had closed. Replaced rather than
  // accumulated on each move, so walking away closes it again.
  const [forcedOpen, setForcedOpen] = useState(() => (activeSectionKey ? [activeSectionKey] : []));

  useEffect(() => {
    setForcedOpen(activeSectionKey ? [activeSectionKey] : []);
  }, [activeSectionKey]);

  const tourActive = useTourActive();

  const openSections = resolveOpenSections(sections, closedSections, {
    forcedOpen,
    // The rail has no header to click, and the tour points five of its six nav
    // steps inside Admin — `whatsNewSteps.js` never drops a step for a missing
    // target, so a closed section would turn those into centred cards explaining
    // features while pointing at nothing.
    allOpen: collapsed || tourActive,
    // One section open at a time: opening Boards collapses Workspace. The Root
    // stays `type="multiple"` even so, because the rail and the tour need *every*
    // section open at once and `type="single"` cannot express that state.
    singleOpen: true,
  });

  /**
   * A section header was clicked, so it is being navigated into — make it *the* open
   * section. Set through `forcedOpen` rather than by rewriting the stored closed
   * list: it is the same "opened for you, not by you" state as arriving by any other
   * route, so it must not overwrite a deliberate choice to keep a section shut.
   *
   * Replaces rather than appends, or clicking Boards would leave Workspace open too
   * and `singleOpen` would then have to guess between them.
   */
  const openSection = useCallback((key) => {
    setForcedOpen([key]);
  }, []);

  /**
   * Which section's hover flyout is showing, and where to put it — **one piece of
   * state and one panel for the whole sidebar.**
   *
   * This started as a `Popover` per section and that design is unfixable by timing.
   * Two panels could be on screen at once, and hovering quickly along the rail showed
   * the *previous* section's rows or none at all: each section owned its own Radix
   * Popover, so every move was an unmount racing a mount, with two exit animations
   * and two `DismissableLayer`s in between. Verified by driving the rail with real
   * pointer moves — a fast sweep left the panel empty even after settling.
   *
   * One panel positioned from the hovered element's own rect has no handoff to lose:
   * moving between sections is a re-render, not a teardown. `setFlyout` also bails
   * when the key has not changed, so re-entering the same mark cannot restart it.
   */
  const [flyout, setFlyout] = useState(null);
  const flyoutTimer = useRef(null);

  const openFlyout = useCallback((key, anchor) => {
    clearTimeout(flyoutTimer.current);
    const box = anchor?.getBoundingClientRect();
    setFlyout((current) =>
      current?.key === key ? current : { key, top: box?.top ?? 0, left: box?.right ?? 0 }
    );
  }, []);

  const closeFlyout = useCallback(() => {
    clearTimeout(flyoutTimer.current);
    // 50ms. The two things this number has to satisfy used to be in tension — long
    // enough that moving onto the panel does not close it, short enough not to
    // linger — and `sideOffset={0}` is what resolves it: with the panel flush
    // against its anchor there is no dead space to cross, so the grace only has to
    // cover the frame in which `mouseleave` and the panel's `mouseenter` both fire.
    //
    // The gap was the real cause of the flyout intermittently not appearing: the
    // panel also animates in (`slide-in-from-left`), so for the first frames its hit
    // area is still travelling toward where the pointer already is. Offset zero plus
    // `duration-75` removes both halves of that race.
    flyoutTimer.current = setTimeout(() => setFlyout(null), 50);
  }, []);

  // The section the flyout is showing, resolved from the key rather than stored, so a
  // role change or a workspace switch cannot leave a panel describing a section that
  // no longer exists.
  const flyoutSection = flyout ? sections.find((section) => section.key === flyout.key) : null;
  // Enough to clamp against the viewport bottom: title row plus one 34px row each.
  const flyoutHeight = flyoutSection
    ? 40 + flyoutSection.items.filter((item) => !item.hidden).length * 34
    : 0;

  // A pending close must not fire after unmount, and a route change should not leave
  // a panel hanging over the new page.
  useEffect(() => () => clearTimeout(flyoutTimer.current), []);
  useEffect(() => {
    clearTimeout(flyoutTimer.current);
    setFlyout(null);
  }, [location.pathname]);

  /**
   * Radix hands back the whole open list, so the change is read as a diff against
   * what we rendered — exactly one key moves per interaction.
   *
   * `forcedOpen` is cleared either way, and that is the load-bearing part: it holds
   * the section the current *route* is in, and it wins `singleOpen`'s tie-break. Left
   * in place, opening Boards by its chevron would resolve straight back to Workspace
   * and the chevron would look broken.
   */
  const handleOpenChange = useCallback(
    (nextOpen) => {
      const next = new Set(nextOpen);
      const clicked = sections
        .map((section) => section.key)
        .find((key) => openSections.has(key) !== next.has(key));
      if (!clicked) return;

      setForcedOpen([]);
      // Opened → it is the only section left open. Closed → nothing is open; the
      // person shut the group they were standing in, which has to be allowed.
      setClosedSections(closedListFor(sections, next.has(clicked) ? clicked : null));
    },
    [sections, openSections, setClosedSections]
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-card">
      <SidebarHeader className="px-3 pb-2.5 pt-3.5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
          {/* ml-[2px] sets the lockup a touch inside the header's px-3 — the mark is round,
              so sitting it flush with the straight left edges of the workspace card and the
              nav items below reads as crowding the sidebar's edge rather than aligning. */}
          <div className="ml-[5px] min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <TaskManagerBrand size="md" linkTo="/dashboard" />
          </div>
          <div className="hidden group-data-[collapsible=icon]:block">
            <TaskManagerBrand size="sm" showWordmark={false} linkTo="/dashboard" />
          </div>

          {/* The bell's home since the top header bar was dropped — beside the
              wordmark, and still reachable in the collapsed rail. */}
          <div className="shrink-0" data-tour="notifications">
            <NavbarNotifications size="sm" align="start" />
          </div>

          <RailTooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <button
              type="button"
              onClick={toggleSidebar}
              data-test="sidebar-collapse-button"
              data-tour="sidebar-collapse"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-card)] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:inline-flex"
            >
              <ToggleIcon className="h-4 w-4" />
            </button>
          </RailTooltip>
        </div>

        <div data-tour="workspace-switcher">
          <WorkspaceSwitcher
            className={collapsed ? 'mt-2' : 'mt-2 py-1.5'}
            compact
            iconOnly={collapsed}
          />
        </div>
      </SidebarHeader>

      {/* Scrolls on desktop rather than clipping. This used to be `md:overflow-hidden`
          on the assumption that the nav always fits — it does for most roles, but an
          admin has the longest list, and anything that eats vertical slack (a shorter
          viewport, the what's-new button in the footer, one more admin link) pushed the
          last item out of view with no way to reach it. `overflow-y-auto` keeps the
          scrollbar invisible until it is actually needed. */}
      {/* **No horizontal padding here, and the two shapes put it back differently.**
          The collapsible sections need to reach both sidebar edges — the active
          section's grey band is a region of the rail, not a card sitting inside it —
          so they run full width and carry their own `px-[22px]` on each row. The
          labelled shape is development's sidebar unchanged, so it gets the `px-3`
          this container used to apply, restored on its own wrapper. */}
      <SidebarContent className="pb-1 group-data-[collapsible=icon]:px-2 md:overflow-y-auto">
        {collapsed && sectionsCollapsible ? (
          /* **The rail is a different structure, not the same one restyled**, so this
             is a JS branch where the rest of the sidebar uses CSS. One mark per
             section with its rows in a flyout cannot be expressed as CSS over a list
             of rows. The cost is that the content swaps on the frame the panel starts
             sliding instead of crossfading with it; the structural change leaves no
             other option. `labelled` keeps development's rail (every row, flat). */
          <div className="flex flex-col items-center gap-1">
            {sections.map((section) => (
              <RailSection
                key={section.key}
                section={section}
                active={section.key === activeSectionKey}
                onOpen={openSection}
                openFlyout={openFlyout}
                closeFlyout={closeFlyout}
              />
            ))}
          </div>
        ) : sectionsCollapsible ? (
          /* `type="multiple"` because sections are independent — closing Admin must
             not open Boards. The value is fully derived (stored list, the active
             route, the rail, the tour), so this is a controlled accordion and
             `handleOpenChange` reads each interaction as a diff against it. */
          <AccordionPrimitive.Root
            type="multiple"
            value={[...openSections]}
            onValueChange={handleOpenChange}
          >
            {sections.map((section, index) => (
              <NavGroup
                key={section.key}
                section={section}
                collapsed={collapsed}
                open={openSections.has(section.key)}
                active={section.key === activeSectionKey}
                onOpen={openSection}
                openFlyout={openFlyout}
                closeFlyout={closeFlyout}
                // Only in the rail, where there is no header to separate anything.
                showSeparator={index > 0}
                // **No margin between sections — they stack flush.** Azure's rail
                // does the same, and with full-bleed blocks it is the only thing that
                // works: any gap leaves a strip of bare sidebar between the active
                // section's grey and the next header, which reads as a seam in one
                // surface rather than as a break between two groups. The header's own
                // height, weight and colour mark are what open a new section; it does
                // not also need a margin.
                className={undefined}
              />
            ))}
          </AccordionPrimitive.Root>
        ) : (
          <div className="px-3 group-data-[collapsible=icon]:px-0">
            {sections.map((section, index) => (
              <NavGroupLabelled
                key={section.key}
                section={section}
                collapsed={collapsed}
                showSeparator={index > 0}
                className={index < sections.length - 1 ? 'mb-3' : undefined}
              />
            ))}
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2 pt-1.5 group-data-[collapsible=icon]:p-2">
        {/* Peer icons next to the avatar left too little room for the name, which
            truncated it to "Admi…". So profile, appearance and logout fold into
            one menu on the identity row — notifications live next to the logo in
            the sidebar header (see above), not here.

            Padding here is deliberately tight (footer p-2, row p-1, trigger
            px-1.5 py-1) and the avatar is `sm`: every pixel spent on chrome comes
            straight out of the name, and a real full name like
            "Sejfudin Duranović" needs all of it to survive at 17rem.

            The row is also the last thing in a nav an admin has to scroll — the
            longest list in the app — so its height is charged to the nav above
            it. The two lines are set on explicit leading rather than the default
            so the block is exactly as tall as the text in it. */}

        {/* Directly above the account row: the tour explains the shell, so it has
            to be reachable from every page, not just a dashboard. Wrapped with a
            hairline gap rather than a margin on the button itself, so the collapsed
            icon rail does not inherit it. */}
        <div className="mb-1.5 group-data-[collapsible=icon]:mb-1">
          <WhatsNewButton collapsed={collapsed} />
        </div>

        <div className="flex items-center gap-1 rounded-[var(--r-tile)] border border-separator p-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:shadow-none">
          {isLoginPending ? (
            <div className="flex w-full animate-pulse items-center gap-3 p-1">
              <div className="h-7 w-7 shrink-0 rounded-full bg-muted" />
              <div className="space-y-1.5 group-data-[collapsible=icon]:hidden">
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="h-2 w-12 rounded bg-muted" />
              </div>
            </div>
          ) : (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    data-test="sidebar-user-menu-trigger"
                    data-tour="user-menu"
                    className={cn(
                      `flex min-w-0 flex-1 items-center gap-2 rounded-[var(--r-card)] px-1.5 py-1 text-left text-[13px] text-foreground transition-all duration-300 ${RAIL_EASE} hover:bg-sidebar-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`,
                      'group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0'
                    )}
                    aria-label={`Account menu for ${user?.fullname || 'your account'}`}
                  >
                    <Avatar users={[user]} size="sm" />
                    <span className={cn('min-w-0 flex-1', collapsibleLabel)}>
                      <span className="block truncate font-semibold leading-[1.15rem]">
                        {user?.fullname || 'Unknown User'}
                      </span>
                      <span className="block truncate text-[11px] leading-[0.95rem] text-muted-foreground">
                        {capitalizeFirst(user?.role) || 'User'}
                      </span>
                    </span>
                    <ChevronsUpDown
                      className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground', collapsibleLabel)}
                    />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent side="right" align="end" className="w-56">
                  <DropdownMenuLabel className="min-w-0">
                    <span className="block truncate">{user?.fullname || 'Unknown User'}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      {user?.email}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild data-test="sidebar-nav-profile-link">
                    <NavLink to="/profile" end className="flex items-center gap-2.5">
                      <UserRound className="size-4 shrink-0" />
                      Profile
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild data-test="sidebar-nav-settings-link">
                    <NavLink to="/settings" end className="flex items-center gap-2.5">
                      <Settings className="size-4 shrink-0" />
                      Settings
                    </NavLink>
                  </DropdownMenuItem>
                  <ThemeAppearanceSubmenu />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-test="sidebar-logout-button"
                    onSelect={() => logout()}
                    className="flex items-center gap-2.5 text-[hsl(var(--tone-danger-fg))] focus:text-[hsl(var(--tone-danger-fg))]"
                  >
                    <LogOut className="size-4 shrink-0" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </SidebarFooter>

      {/* The one flyout. Rendered here rather than inside a section because the
          sidebar sets `overflow-hidden` in the rail — anything drawn inside it is
          clipped at 34px — and because one panel is what makes the handoff between
          sections a re-render instead of an unmount race (see `openFlyout`).

          `position: fixed` off the anchor's own rect: the sidebar is itself fixed, so
          there is no scrolling container to correct for. The top is clamped so a long
          section opening near the bottom of the screen stays on screen. */}
      {flyoutSection
        ? createPortal(
            <div
              style={{
                top: Math.min(flyout.top, Math.max(8, window.innerHeight - flyoutHeight)),
                left: flyout.left,
              }}
              onMouseEnter={() => openFlyout(flyout.key, null)}
              onMouseLeave={closeFlyout}
              className="fixed z-50 w-56 rounded-[var(--r-card)] border border-border bg-popover p-1.5 text-popover-foreground shadow-elevated"
              role="group"
              aria-label={flyoutSection.title}
            >
              <SectionFlyoutBody
                title={flyoutSection.title}
                items={flyoutSection.items.filter((item) => !item.hidden)}
                showTitle={collapsed}
              />
            </div>,
            document.body
          )
        : null}
    </Sidebar>
  );
}
