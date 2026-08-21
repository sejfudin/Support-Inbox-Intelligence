import { TableCell, TableRow } from '@/components/ui/table';
import TableRowsSkeleton from '@/components/Skeletons/TableRowsSkeleton';
import { Loader } from '@/components/ui/loader';
import { cn } from '@/lib/utils';

/**
 * The chrome every Platform-management tab shares, from the overhaul mockup's
 * "Platform management" screen.
 *
 * One flat card per tab: a hairline-closed head band carrying the sentence that
 * says what the list is for and the single action that adds to it, then the list
 * itself flush to the card's edges. The description used to sit above the card as
 * loose page copy and the button beside it — which read as page-level furniture
 * even though both belong to the one table underneath.
 */
export function ReferenceDataPanel({
  description,
  action,
  children,
  className,
  loading = false,
  // Every other surface names what it is fetching; the five tabs share one component, so the
  // name has to come in from the tab rather than being hard-coded to a bare "Loading".
  loadingLabel = 'Loading',
}) {
  return (
    <section className={cn('app-card relative overflow-hidden', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator px-[18px] pb-3 pt-[13px]">
        <p className="text-[12.5px] leading-[1.45] text-muted-foreground">{description}</p>
        {action}
      </div>
      {children}
      {/* Over the whole card, head band included, so the mark is centred on the panel rather than
          on the rows — the band is chrome that is already there and has nothing to wait for. */}
      {loading && <Loader variant="overlay" size="sm" label={loadingLabel} />}
    </section>
  );
}

/**
 * The loading body for a tab's table: skeleton rows in the `tbody`, and the mark over the panel.
 *
 * The mark can't go inside the table (a `div` is illegal in a `tbody`), so `ReferenceDataPanel`
 * marks itself `relative` and the overlay is rendered as a sibling of the table by the panel — see
 * `loading` below. This keeps all five tabs on one implementation rather than five copies of a
 * "Loading positions…" row.
 */
export function ReferenceDataTableLoading({ colSpan, rows = 5 }) {
  return <TableRowsSkeleton rows={rows} columns={colSpan} cellClassName="px-4 py-2.5" />;
}

/**
 * The head band's add button. Nothing but a shrink guard: it is the card-header
 * action, which the library already defines as a 32px radius-8 button.
 *
 * It used to carry `h-8 rounded-lg px-3`. `rounded-lg` is the trap — this repo
 * remaps it onto `--radius` (1rem) in `tailwind.config.js`, so it is **16px**
 * here, not Tailwind's usual 8px. On a 32px control that is a full pill, which is
 * why this button read as a different species from every other button on the
 * page. Reach for `--r-control`, never `rounded-lg`, on anything control-shaped.
 */
export const referenceDataActionClass = 'shrink-0';

/**
 * Per-row edit affordance — a 28px outlined square rather than a bare ghost icon.
 * At this row height an unbordered icon reads as decoration; the outline is what
 * makes the column look clickable without adding a word to every row.
 */
export const referenceDataRowActionClass =
  'h-[var(--h-sm)] w-[var(--h-sm)] rounded-[var(--r-control)] border border-separator text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:size-3.5';

/** Slug chips, shared by the three tabs whose records carry a generated slug. */
export function ReferenceDataSlugBadge({ children }) {
  return (
    <span className="inline-flex rounded-[var(--r-badge)] bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

/** Loading / empty copy, as a single full-width row inside a tab's table. */
export function ReferenceDataTableMessage({ colSpan, children }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="h-auto py-10 text-center text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}
