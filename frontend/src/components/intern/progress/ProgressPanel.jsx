import { cn } from '@/lib/utils';

/**
 * The section shell every block on "My progress" sits in — a flat card with a
 * header band, then the body.
 *
 * The overhaul's card, not the old rounded `InternPanel`: `.app-card` +
 * `.app-card-head` are the shared surface the rest of the migrated app already
 * uses (see the "Flat shell" block in `index.css`), so these sections match the
 * panels on `/my-technologies` sitting one nav row away.
 *
 * `items-start` and `justify-between` are utilities on purpose — they override
 * `.app-card-head`'s own `items-center`, because a header with a description
 * under the title must align to the top of the band rather than to its middle.
 *
 * `id` anchors the section for the rail's "On this page" list.
 */
export function ProgressPanel({ id, title, description, action, children, className, dataTour }) {
  return (
    <section
      id={id}
      data-tour={dataTour}
      className={cn('app-card flex scroll-mt-4 flex-col overflow-hidden', className)}
    >
      <div className="app-card-head flex-wrap items-start justify-between">
        <div className="min-w-0">
          <h2 className="app-card-title">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-[42rem] text-[12.5px] leading-[1.45] text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Standard body padding, for sections that aren't a full-bleed list. */
export function ProgressPanelBody({ children, className }) {
  return <div className={cn('p-[18px]', className)}>{children}</div>;
}

/**
 * The lead-in sentence for the two narrow cards at the foot of the page.
 *
 * Their header band is title + status only — at half the content column a
 * description on the band pushes the title onto two lines — so the sentence that
 * says what the section holds is the first thing in the body instead.
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
