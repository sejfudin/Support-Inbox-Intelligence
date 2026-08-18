import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { SearchField } from '@/components/ui/search-field';
import { useTickets } from '@/queries/tickets';
import { extractStatusMeta } from '@/helpers/normalizeTicket';
import { isDoneBlockerCandidate } from '@/helpers/ticketBlocker';

const SEARCH_DEBOUNCE_MS = 300;
const RESULT_LIMIT = 8;

/**
 * Search-and-pick one ticket from the same workspace.
 *
 * Searching runs on the server rather than filtering a preloaded list, because
 * `GET /tickets?search=` already matches the task NUMBER as well as the subject —
 * and "the one I'm blocked by" is a thing people know by number. A workspace with
 * a few thousand tickets would also make a preloaded list a bad trade.
 *
 * Archived tickets are left out of the query: they are a read-only record and
 * nothing is waiting on one. An already-linked archived ticket still renders in
 * the field.
 *
 * Finished tickets are dropped from the results for the same reason — nothing is
 * waiting on a done ticket, and the server refuses the link anyway
 * (`blockerIsDone`). They are filtered here rather than in the query because
 * "done" is a per-workspace status flag, not something `GET /tickets` can filter
 * on; the trade is that a page of results can come back short.
 */
export function BlockingTicketPicker({
  workspaceId,
  excludeTicketIds = [],
  onSelect,
  disabled = false,
  placeholder = 'Search by ticket number or subject…',
  dataTest,
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const query = useTickets(
    {
      workspaceId,
      search: debouncedSearch,
      archived: false,
      limit: RESULT_LIMIT,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    },
    { enabled: Boolean(workspaceId) && debouncedSearch.length > 0 }
  );

  const excluded = useMemo(
    () => new Set(excludeTicketIds.filter(Boolean).map(String)),
    [excludeTicketIds]
  );

  const results = useMemo(
    () =>
      (query.data?.data || []).filter(
        (ticket) => !excluded.has(String(ticket._id)) && !isDoneBlockerCandidate(ticket)
      ),
    [query.data, excluded]
  );

  const isTyping = search.trim() !== debouncedSearch;
  const isLoading = debouncedSearch.length > 0 && (isTyping || query.isFetching);

  const pick = (ticket) => {
    onSelect?.(ticket);
    setSearch('');
    setDebouncedSearch('');
  };

  const handleListKeyDown = (e) => {
    const row = e.target.closest('[data-ticket-id]');
    if (!row) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      row.nextElementSibling?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      row.previousElementSibling?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const ticket = results.find((t) => String(t._id) === row.dataset.ticketId);
      if (ticket) pick(ticket);
    }
  };

  return (
    <Popover
      open={search.trim().length > 0}
      onOpenChange={(open) => {
        if (!open) setSearch('');
      }}
    >
      <PopoverAnchor asChild>
        <div>
          <SearchField
            value={search}
            onChange={setSearch}
            width="block"
            clearable={false}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowDown') return;
              e.preventDefault();
              listRef.current?.querySelector('[data-ticket-id]')?.focus();
            }}
            disabled={disabled}
            placeholder={placeholder}
            data-test={dataTest}
          />
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="z-[210] max-h-72 w-[var(--radix-popper-anchor-width)] overflow-y-auto rounded-[var(--r-card)] border border-separator bg-card p-0 shadow-elevated-sm"
      >
        {isLoading && (
          <div className="flex items-center gap-2 px-3 py-2.5 text-[12.5px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching…
          </div>
        )}

        {!isLoading && results.length === 0 && (
          <div className="px-3 py-2.5 text-[12.5px] text-muted-foreground">No matching ticket.</div>
        )}

        {!isLoading && results.length > 0 && (
          <div ref={listRef} onKeyDown={handleListKeyDown}>
            {results.map((ticket) => {
              const status = extractStatusMeta(ticket.status);
              return (
                <div
                  key={ticket._id}
                  role="button"
                  tabIndex={0}
                  data-ticket-id={String(ticket._id)}
                  data-test={`blocker-option-${ticket._id}`}
                  onClick={() => pick(ticket)}
                  className="flex cursor-pointer items-center gap-2 border-b border-separator px-3 py-2 outline-none transition-colors last:border-b-0 hover:bg-accent/60 focus:bg-accent/60"
                >
                  <span
                    className="h-[7px] w-[7px] shrink-0 rounded-full"
                    style={{ backgroundColor: status?.color || 'currentColor' }}
                    aria-hidden="true"
                  />
                  <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-muted-foreground">
                    {ticket.taskNumber ? `#${ticket.taskNumber}` : '—'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground">
                    {ticket.subject}
                  </span>
                  {status?.label && (
                    <span className="shrink-0 text-[10.5px] font-medium text-muted-foreground/75">
                      {status.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default BlockingTicketPicker;
