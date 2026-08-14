import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { dayStatusLabel, formatRequestDates, officeDateKey } from '@/helpers/attendance';
import { DayStatusGlyph } from '@/components/attendance/dayStatusVisuals';

// The intern-facing word for each request status. `pending` reads as "Waiting"
// rather than "Pending" because it is waiting on somebody else, which is the part
// the intern can do nothing about; `rejected` reads as "Declined" because a person
// declined it, not a system.
const STATUS_BADGE = {
  pending: { variant: 'warning', label: 'Waiting' },
  approved: { variant: 'success', label: 'Approved' },
  rejected: { variant: 'destructive', label: 'Declined' },
  cancelled: { variant: 'outline', label: 'Withdrawn' },
  revoked: { variant: 'destructive', label: 'Revoked' },
};

// How many rows show before the list is folded. Enough that a normal year fits
// without a click, few enough that the table cannot push the calendar off screen.
const COLLAPSED_ROWS = 6;

/**
 * Every request this intern has made, decided or not, as a full-width table under
 * the calendar.
 *
 * Split from the "Time away" card on purpose: that card answers "what is happening
 * to me soon", and stays a short list of live requests. This answers "what have I
 * asked for", which is a different question, asked less often, and needs columns —
 * who decided it, and how many days it cost — that would not fit beside a calendar.
 *
 * Scoped to the current calendar year because the budgets are: "Vacation 2/5 left"
 * is a statement about this year, and a history that silently spanned several would
 * not add up against it.
 *
 * It is also the **only** place a pending request can be withdrawn, now that the
 * balance card shows totals rather than a list — so the action lives on the row
 * rather than being reachable only from a card that no longer enumerates them.
 */
export default function AttendanceRequestHistory({
  requests = [],
  onWithdraw,
  isWithdrawing = false,
}) {
  const [expanded, setExpanded] = useState(false);

  const thisYear = officeDateKey().slice(0, 4);

  const rows = useMemo(
    () =>
      requests
        .filter((request) => (request.dates || []).some((d) => d.startsWith(thisYear)))
        // Newest first: the most recent thing you asked for is the one you are most
        // likely looking for. The "Time away" card above is ordered by when the days
        // fall, because there the question is what is coming.
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    [requests, thisYear]
  );

  const visible = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);
  const hidden = rows.length - visible.length;

  return (
    <div
      className="-mx-6 overflow-hidden border-y border-border/60"
      data-test="attendance-request-history"
    >
      <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-2.5">
        <span className="text-xs text-muted-foreground">
          This year · {rows.length} {rows.length === 1 ? 'request' : 'requests'}
        </span>
      </div>

      {rows.length === 0 ? (
        <p
          className="px-5 pb-5 text-sm text-muted-foreground"
          data-test="attendance-request-history-empty"
        >
          You have not asked for any days off this year.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-y border-border/60 bg-muted/40">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2.5 font-semibold">Type</th>
                <th className="px-5 py-2.5 font-semibold">Dates</th>
                <th className="px-5 py-2.5 text-right font-semibold">Days</th>
                <th className="px-5 py-2.5 font-semibold">Decided by</th>
                <th className="px-5 py-2.5 text-right font-semibold">Status</th>
                {onWithdraw && <th className="px-5 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {visible.map((request) => {
                const badge = STATUS_BADGE[request.status] || {
                  variant: 'secondary',
                  label: request.status,
                };
                return (
                  <tr
                    key={request.id}
                    className="border-t border-border/60"
                    data-test={`attendance-request-history-row-${request.id}`}
                  >
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                        <DayStatusGlyph status={request.type} />
                        {dayStatusLabel(request.type)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {formatRequestDates(request.dates)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                      {request.dates?.length || 0}
                    </td>
                    {/* An em dash, not a blank: a request nobody has answered yet has
                        no decider, and an empty cell reads as missing data. */}
                    <td className="px-5 py-3 text-muted-foreground">{request.decidedBy || '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </td>
                    {onWithdraw && (
                      <td className="px-5 py-3 text-right">
                        {request.status === 'pending' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={isWithdrawing}
                            onClick={() => onWithdraw(request.id)}
                            data-test={`attendance-request-withdraw-${request.id}`}
                          >
                            Withdraw
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hidden > 0 && (
        <div className="border-t border-border/60 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setExpanded(true)}
            data-test="attendance-request-history-expand"
          >
            Show all {rows.length} requests
          </Button>
        </div>
      )}
      {expanded && rows.length > COLLAPSED_ROWS && (
        <div className="border-t border-border/60 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setExpanded(false)}
            data-test="attendance-request-history-collapse"
          >
            Show fewer
          </Button>
        </div>
      )}
    </div>
  );
}
