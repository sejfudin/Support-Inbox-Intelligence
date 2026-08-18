import { cn } from '@/lib/utils';

/**
 * The one empty state: a dashed radius-12 box holding an icon tile, a line
 * saying what is missing, one sentence explaining when it fills, and at most one
 * action.
 *
 * Pages used to write their own — a `<p>` here, a dashed box there — which is why
 * the same "nothing here yet" moment looked like three different products.
 *
 * The dashed border is doing work: it says "this container is real and currently
 * empty", where a solid card says "this is a card about nothing".
 *
 * `description` must say **who fills this and when** — "Your mentor adds notes
 * after each check-in" — never just "No data". A reader who lands on an empty
 * screen needs to know whether they are waiting on someone or on themselves.
 */
export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <section
      className={cn(
        'flex flex-col items-center gap-[7px] rounded-[var(--r-card)] border border-dashed border-border px-4 py-[22px] text-center',
        className
      )}
      data-test="empty-state"
    >
      {Icon ? (
        <span className="grid h-[34px] w-[34px] place-items-center rounded-[var(--r-tile)] bg-muted text-muted-foreground/75">
          <Icon className="h-[17px] w-[17px]" strokeWidth={1.7} aria-hidden />
        </span>
      ) : null}
      <span className="text-[length:var(--fs-row-title)] font-semibold text-foreground">
        {title}
      </span>
      {description ? (
        <span className="max-w-[280px] text-pretty text-[12px] leading-[1.45] text-muted-foreground">
          {description}
        </span>
      ) : null}
      {action ? <div className="mt-1.5">{action}</div> : null}
    </section>
  );
}
