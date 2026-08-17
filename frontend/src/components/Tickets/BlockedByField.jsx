import { CircleSlash, ExternalLink, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { extractStatusMeta } from '@/helpers/normalizeTicket';
import {
  BLOCKER_NOTE_MAX_LENGTH,
  blockerTicketId,
  emptyBlocker,
  ticketRefLabel,
} from '@/helpers/ticketBlocker';
import { BlockingTicketPicker } from './BlockingTicketPicker';

/**
 * The blocker panel a ticket shows while it sits in the Blocked status — pick the
 * ticket this one waits on, and/or write down why when no ticket is the reason.
 *
 * Both halves are optional: an unknown blocker is a normal state and the panel
 * says so rather than demanding an answer. Callers mount it only when Blocked is
 * the selected status, so its presence *is* the explanation for why it appeared.
 *
 * `onOpenTicket` turns the linked ticket into a clickable reference. Without it
 * (the create modal, where there is nothing to navigate from) the same row renders
 * as plain text.
 */
export function BlockedByField({
  value,
  onChange,
  workspaceId,
  currentTicketId = null,
  disabled = false,
  onOpenTicket = null,
  idPrefix = 'blocker',
}) {
  const blocker = value || emptyBlocker();
  const linked = typeof blocker.ticket === 'object' ? blocker.ticket : null;
  const linkedId = blockerTicketId(blocker.ticket);
  const note = String(blocker.note || '');
  const linkedStatus = extractStatusMeta(linked?.status);

  const setTicket = (ticket) => onChange({ ...blocker, ticket });
  const setNote = (nextNote) => onChange({ ...blocker, note: nextNote });

  const openLinked = () => {
    if (!onOpenTicket || !linkedId) return;
    onOpenTicket(linkedId);
  };

  return (
    <div
      className="overflow-hidden rounded-2xl border border-red-500/30 bg-card shadow-md dark:border-red-500/35"
      data-test="ticket-blocker-panel"
    >
      <div className="flex items-center justify-between gap-2 border-b border-red-500/25 bg-red-500/10 px-4 py-3 dark:bg-red-500/15">
        <div className="flex items-center gap-2">
          <CircleSlash className="h-3.5 w-3.5 text-red-700 dark:text-red-300" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-red-800 dark:text-red-300">
            Blocked by
          </span>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Optional
        </span>
      </div>

      <div className="space-y-4 px-4 pb-5 pt-4">
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Blocking ticket
          </span>

          {linkedId ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
              {/* The number carries the link: it is the part people scan for, and
                  it stays a stable handle even if the subject is later edited. */}
              <ReferenceBody
                linked={linked}
                linkedStatus={linkedStatus}
                onOpen={onOpenTicket ? openLinked : null}
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => setTicket(null)}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Remove blocking ticket"
                  data-test="ticket-blocker-unlink-button"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : disabled ? (
            <p className="text-sm text-muted-foreground">No blocking ticket linked.</p>
          ) : (
            <BlockingTicketPicker
              workspaceId={workspaceId}
              excludeTicketIds={[currentTicketId]}
              onSelect={setTicket}
              dataTest="ticket-blocker-search-input"
            />
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={`${idPrefix}-note`}
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
            >
              Why it's blocked
            </label>
            {!disabled && (
              <span
                className={cn(
                  'text-[10px] font-semibold tabular-nums',
                  note.length > BLOCKER_NOTE_MAX_LENGTH
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                )}
              >
                {note.length}/{BLOCKER_NOTE_MAX_LENGTH}
              </span>
            )}
          </div>

          {disabled ? (
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {note || <span className="text-muted-foreground">No reason recorded.</span>}
            </p>
          ) : (
            <Textarea
              id={`${idPrefix}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={BLOCKER_NOTE_MAX_LENGTH}
              placeholder="e.g. waiting on the client's SSO certificate"
              className="min-h-[72px] resize-y bg-muted/50 text-sm"
              data-test="ticket-blocker-note-input"
            />
          )}
        </div>

        {!disabled && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Leave both empty if the reason isn't known yet. Cleared automatically when this ticket
            leaves Blocked.
          </p>
        )}
      </div>
    </div>
  );
}

function ReferenceBody({ linked, linkedStatus, onOpen }) {
  const content = (
    <>
      <span className="shrink-0 font-bold tabular-nums">{ticketRefLabel(linked)}</span>
      {linked?.subject && (
        <span className="min-w-0 truncate font-medium text-foreground">{linked.subject}</span>
      )}
      {onOpen && <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />}
    </>
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 items-center gap-2 rounded text-left text-sm text-primary outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          data-test="ticket-blocker-open-button"
        >
          {content}
        </button>
      ) : (
        <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">{content}</span>
      )}

      {linkedStatus?.label && (
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: linkedStatus.color || 'currentColor' }}
            aria-hidden="true"
          />
          {linkedStatus.label}
          {linked?.isArchived && ' · Archived'}
        </span>
      )}
    </div>
  );
}

export default BlockedByField;
