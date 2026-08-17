import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { useTickets } from '@/queries/tickets';
import { extractStatusMeta } from '@/helpers/normalizeTicket';

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
 * Archived tickets are left out: they are a read-only record and nothing is
 * waiting on one. An already-linked archived ticket still renders in the field.
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
    () => (query.data?.data || []).filter((ticket) => !excluded.has(String(ticket._id))),
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
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowDown') return;
              e.preventDefault();
              listRef.current?.querySelector('[data-ticket-id]')?.focus();
            }}
            disabled={disabled}
            placeholder={placeholder}
            className="h-9 pl-8 text-sm"
            data-test={dataTest}
          />
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="z-[210] max-h-72 w-[var(--radix-popper-anchor-width)] overflow-y-auto rounded-xl border border-border bg-card p-0 shadow-md"
      >
        {isLoading && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching…
          </div>
        )}

        {!isLoading && results.length === 0 && (
          <div className="px-4 py-3 text-sm text-muted-foreground">No matching ticket.</div>
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
                  className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm outline-none first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50 focus:bg-muted/50"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: status?.color || 'currentColor' }}
                    aria-hidden="true"
                  />
                  <span className="shrink-0 font-bold tabular-nums text-muted-foreground">
                    {ticket.taskNumber ? `#${ticket.taskNumber}` : '—'}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {ticket.subject}
                  </span>
                  {status?.label && (
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
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
