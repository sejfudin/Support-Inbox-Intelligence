import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { ticketsPathForStatus } from './workloadLink';

/**
 * Slice order around the ring, by slug.
 *
 * Not the canonical workflow order the bar uses, and deliberately so. The slice
 * colours are the workspace's own `TicketStatus` colours — the same ones the
 * badges and the bar carry, which is not negotiable: recolouring a status inside
 * one chart would make two views of the same data disagree. But the platform
 * defaults put blue "In progress" next to violet "On staging", and as adjacent
 * arcs those two are ΔE 1.3 apart under deuteranopia and 12.0 for normal vision
 * — a hard fail on the dataviz separation checks, i.e. genuinely one arc to many
 * readers.
 *
 * Since those checks measure *adjacent* pairs, seating the colliding pair across
 * the ring from each other fixes it without touching a single colour: reordered
 * this way the worst adjacent pair is ΔE 16.3 normal / 16.8 protan, which passes.
 * A workspace that has recoloured its statuses gets whatever separation those
 * colours have; the legend below carries the label either way.
 *
 * (The slate "To do" step is below the validator's chroma floor — it reads as
 * grey. That is accepted rather than fixed: it is the status's colour across the
 * whole app, and a neutral "not started" is the right semantics.)
 */
const RING_ORDER = ['in progress', 'to do', 'on staging', 'blocked'];

const pctOf = (value, total) => (total > 0 ? Math.round((value / total) * 100) : 0);

/**
 * The same four workload numbers as the bar, as part-to-whole.
 *
 * Empty segments are dropped from the ring but kept in the legend, so the reader
 * can see that a status exists and is at zero — a legend that grows and shrinks
 * makes two visits hard to compare.
 */
export function WorkloadDonut({ buckets = [] }) {
  const [active, setActive] = useState(null);
  const navigate = useNavigate();

  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const ordered = RING_ORDER.map((slug) => buckets.find((bucket) => bucket.slug === slug)).filter(
    Boolean
  );
  const slices = ordered.filter((bucket) => bucket.count > 0);

  const activeBucket = active ? buckets.find((bucket) => bucket.slug === active) : null;

  return (
    // `relative z-10` lifts the ring and the legend above `MyWorkloadCard`'s
    // stretched card link. Both are now click targets of their own — a slice or a
    // legend row opens that one status — and under the overlay they were
    // unreachable, every click landing on the card-wide "all my tickets" link.
    <div className="relative z-10 flex flex-1 flex-col">
      {/* The ring centres in the space above the legend and the legend sits on
          the card's bottom edge, so both views of this card put the status list
          in the same place — switching between them shouldn't move the rows. */}
      {/* `min-h` as well as `h`: with only `h-[8.5rem] flex-1` the box was allowed to
          shrink below its own basis — it came out at 113px — and since the ring scales
          to the box, the ring shrank with it. Flooring the height is what makes the
          ring render at its intended size. */}
      <div className="relative h-[9.5rem] min-h-[9.5rem] w-full flex-1">
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[1.625rem] font-bold leading-none tabular-nums text-foreground">
            {activeBucket ? activeBucket.count : total}
          </span>
          <span className="mt-1 max-w-[6rem] text-[10px] font-medium uppercase leading-tight tracking-[0.08em] text-muted-foreground">
            {activeBucket ? activeBucket.label : 'open'}
          </span>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="count"
              nameKey="label"
              // Percentages, NOT pixels. As fixed px (44/62) the ring needed
              // 2 × (62 + strokeWidth/2) = 127px of height, but this box is
              // `flex-1`, so whenever the card gave it less — 113px at this
              // breakpoint — the top and bottom of the ring were cropped by the
              // SVG's own `overflow: hidden`, and the "circle" rendered with two
              // flat edges. Recharts resolves a percentage against
              // min(width, height) / 2, so the ring now scales to whatever box it
              // gets and can never overflow it. At the designed height these
              // resolve to ~62 / ~44, so the tuned ring thickness is preserved.
              // 96% rather than 100%: the stroke is drawn centred on the edge, so
              // half of `strokeWidth` sits outside `outerRadius` and would clip again.
              innerRadius="68%"
              outerRadius="96%"
              paddingAngle={2}
              cornerRadius={4}
              // Surface-coloured stroke: the 2px gap the mark spec asks for
              // between adjacent fills, so two similar hues never read as one arc.
              stroke="hsl(var(--card))"
              strokeWidth={3}
              onMouseEnter={(datum) => setActive(datum?.payload?.slug ?? null)}
              onMouseLeave={() => setActive(null)}
              // Clicking a slice goes where its legend row goes. The legend is the
              // keyboard-accessible path to the same destination, so the slices stay
              // a mouse affordance rather than becoming twelve more tab stops.
              onClick={(datum) => {
                const slug = datum?.payload?.slug;
                if (slug) navigate(ticketsPathForStatus(slug));
              }}
              isAnimationActive={false}
              className="cursor-pointer [&_.recharts-sector]:outline-none"
            >
              {slices.map((bucket) => (
                <Cell
                  key={bucket.slug}
                  fill={bucket.color}
                  className="transition-opacity duration-150"
                  style={{ opacity: active === null || active === bucket.slug ? 1 : 0.3 }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Always present: it is what identifies each slice without relying on
          colour, and it keeps the workflow order the bar view uses even though
          the ring does not. */}
      <ul className="mt-auto space-y-1 pt-3">
        {buckets.map((bucket) => (
          <li key={bucket.slug}>
            {/* A real link, not a row with an onClick: this is navigation, so it has
                to be keyboard-reachable and openable in a new tab. An empty segment
                still links — "show me the none I have" is a valid thing to check,
                and a row that silently stops working at zero is worse than one that
                lands on an empty list. */}
            <Link
              to={ticketsPathForStatus(bucket.slug)}
              onMouseEnter={() => bucket.count > 0 && setActive(bucket.slug)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => bucket.count > 0 && setActive(bucket.slug)}
              onBlur={() => setActive(null)}
              aria-label={`${bucket.count} ${bucket.label} — open in my tickets`}
              className={cn(
                'flex items-center gap-2 rounded-md px-1.5 py-0.5 text-[13px] transition-colors',
                'hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                active === bucket.slug && 'bg-muted/60',
                bucket.count === 0 && 'opacity-45'
              )}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: bucket.color }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{bucket.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                {bucket.count}
              </span>
              <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                {pctOf(bucket.count, total)}%
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
