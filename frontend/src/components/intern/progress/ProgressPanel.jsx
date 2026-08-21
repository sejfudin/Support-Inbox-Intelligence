import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

/**
 * The section shell most blocks on "My progress" sit in — a flat card whose
 * header band opens and closes it.
 *
 * Two things carry the page's length, and they are not the same thing:
 *
 * - **Between sections**, the disclosure. Only the first is open on arrival, so
 *   the page opens as a summary and the rest is there when it is wanted.
 * - **Inside a section**, condensing. The newest evaluation and the newest
 *   recommendation render in full and everything older is one line — because a
 *   section you opened should not then be six screens of history.
 *
 * Collapsed, each band still states its own summary through `action` (the count,
 * the score delta, the readiness split), so a closed page is still readable.
 *
 * The band is a row, not a button: `action` can hold links and buttons (the
 * programme card's are real navigation), and nesting those inside the trigger
 * would be invalid. The trigger takes the title block and the chevron; the action
 * sits beside it, clickable in its own right.
 *
 * `.app-card` + `.app-card-head` are the shared surface the rest of the migrated
 * app uses (see the "Flat shell" block in `index.css`).
 *
 * `id` doubles as the accordion item's value, so the summary header's tiles name
 * sections by the same id an anchor link would use.
 *
 * **`collapsible={false}`** renders the same header/body shape as a plain static
 * card instead — no `AccordionItem`, no trigger, content always open. For a
 * section that already lives behind its own tab (Evaluations, Recommendations):
 * the tab itself is the disclosure, so wrapping the content in a second one
 * (click to expand a thing you just clicked a tab to see) would be redundant.
 */
export function ProgressPanel({
  id,
  title,
  description,
  action,
  children,
  className,
  dataTour,
  collapsible = true,
}) {
  const header = (
    <div className="min-w-0">
      <span className="app-card-title block transition-colors group-hover:text-foreground">
        {title}
      </span>
      {description ? (
        <p className="mt-1 max-w-[42rem] text-[12.5px] leading-[1.45] text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );

  if (!collapsible) {
    return (
      <section
        id={id}
        data-tour={dataTour}
        className={cn('app-card flex scroll-mt-4 flex-col overflow-hidden', className)}
      >
        <div className="app-card-head flex-wrap items-start justify-between gap-3">
          {header}
          {action ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
          ) : null}
        </div>
        <div className="flex flex-col text-[unset]">{children}</div>
      </section>
    );
  }

  return (
    <AccordionItem
      value={id}
      id={id}
      data-tour={dataTour}
      className={cn('app-card flex scroll-mt-4 flex-col overflow-hidden border-b-0', className)}
    >
      <div className="app-card-head flex-wrap items-start justify-between gap-3">
        <AccordionTrigger
          className={cn(
            'group min-w-0 flex-1 justify-start gap-2 py-0 text-left',
            // The band's own vertical rhythm already spaces the row, and a
            // description under the title makes this two lines — so the chevron
            // aligns to the title rather than to the middle of the block.
            'items-start [&>svg]:mt-[3px]'
          )}
        >
          {header}
        </AccordionTrigger>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      <AccordionContent className="flex flex-col text-[unset]">{children}</AccordionContent>
    </AccordionItem>
  );
}

/** Standard body padding, for sections that aren't a full-bleed list. */
export function ProgressPanelBody({ children, className }) {
  return <div className={cn('p-[18px]', className)}>{children}</div>;
}

/**
 * The lead-in sentence for the sections whose band carries a status instead of a
 * description.
 *
 * A `description` on the band competes with `action` for the same row, and for
 * these sections the count *is* the useful thing to see while they are closed —
 * so the sentence saying what the section holds is the first thing in the body,
 * where it is read on the way in rather than skimmed on the way past.
 */
export function ProgressPanelLead({ children }) {
  return (
    <p className="px-[18px] pt-[18px] text-[12.5px] leading-[1.55] text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * What a section will hold once the programme records something: the fields it is
 * made of as chips, then the sentence saying who fills them in.
 *
 * The chips are the point of the empty state. "No evaluation recorded yet" alone
 * describes an absence; the four criteria beside it describe what is coming, which
 * is the only thing an intern can do anything with here.
 */
export function ProgressPanelEmpty({ fields, children }) {
  return (
    <div className="flex flex-1 flex-col gap-3.5 px-[18px] pb-[18px] pt-3.5">
      {fields?.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {fields.map((field) => (
            <li
              key={field}
              className="app-chip border border-border bg-muted text-muted-foreground"
            >
              {field}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-[12.5px] leading-[1.55] text-muted-foreground">{children}</p>
    </div>
  );
}

/**
 * A group caption inside a section body — "POSITION", "TECHNOLOGIES", "EARLIER".
 *
 * This is what replaced the inset `bg-muted/30` boxes those groups used to sit in.
 * A box inside a card inside a page is three frames for one list; a caption on a
 * divider says the same thing and keeps every row on the same plane.
 */
export function ProgressGroupLabel({ children, className }) {
  return (
    <p
      className={cn(
        'border-b border-separator bg-muted/40 px-[18px] py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/75',
        className
      )}
    >
      {children}
    </p>
  );
}
