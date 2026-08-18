import { CircleSlash, X } from 'lucide-react';

import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { extractStatusMeta } from '@/helpers/normalizeTicket';
import {
  BLOCKER_NOTE_MAX_LENGTH,
  blockerTicketId,
  emptyBlocker,
  ticketRefLabel,
} from '@/helpers/ticketBlocker';
import { cn } from '@/lib/utils';

import { BlockingTicketPicker } from './BlockingTicketPicker';

/**
 * The blocker section a ticket shows while it sits in the Blocked status — pick
 * the ticket this one waits on, and/or write down why when no ticket is the
 * reason.
 *
 * Both halves are optional: an unknown blocker is a normal state and the section
 * says so rather than demanding an answer. Callers mount it only when Blocked is
 * the selected status, so its presence *is* the explanation for why it appeared.
 *
 * It has no card of its own. It used to be a red-bordered panel with a header
 * band, which was the old modal's idiom — inside the redesign it would be a third
 * outline in a surface that already has one. Instead it takes the shape of
 * whichever column it is dropped into:
 *
 * - `variant="rail"` — the lead section of the details modal's meta rail: the
 *   rail's own 10.5px captions, controls on `bg-card` because the rail itself is
 *   tinted, and a rule under it separating it from the standard rows.
 * - `variant="form"` — `Field` rows, like every other control in the create
 *   modal's aside.
 *
 * The danger tone is carried by the caption's icon alone. The status it belongs
 * to is already called Blocked and already wears the colour; repeating it as a
 * tinted panel says the same thing three times.
 *
 * `onOpenTicket` turns the linked ticket into a clickable reference. Without it
 * (the create modal, where there is nothing to navigate from) the same row
 * renders as plain text.
 */
export function BlockedByField({
  value,
  onChange,
  workspaceId,
  currentTicketId = null,
  disabled = false,
  onOpenTicket = null,
  idPrefix = 'blocker',
  variant = 'form',
}) {
  const blocker = value || emptyBlocker();
  const linked = typeof blocker.ticket === 'object' ? blocker.ticket : null;
  const linkedId = blockerTicketId(blocker.ticket);
  const note = String(blocker.note || '');
  const linkedStatus = extractStatusMeta(linked?.status);
  const isRail = variant === 'rail';

  const setTicket = (ticket) => onChange({ ...blocker, ticket });
  const setNote = (nextNote) => onChange({ ...blocker, note: nextNote });

  const noteId = `${idPrefix}-note`;
  const counter = !disabled ? (
    <span
      className={cn(
        'text-[10.5px] font-semibold tabular-nums',
        note.length > BLOCKER_NOTE_MAX_LENGTH
          ? 'text-[hsl(var(--tone-danger-fg))]'
          : 'text-muted-foreground/75'
      )}
    >
      {note.length}/{BLOCKER_NOTE_MAX_LENGTH}
    </span>
  ) : null;

  const ticketControl = linkedId ? (
    <LinkedTicket
      linked={linked}
      linkedStatus={linkedStatus}
      onOpen={onOpenTicket && linkedId ? () => onOpenTicket(linkedId) : null}
      onRemove={disabled ? null : () => setTicket(null)}
    />
  ) : disabled ? (
    <p className="text-[12.5px] text-muted-foreground">No blocking ticket linked.</p>
  ) : (
    <BlockingTicketPicker
      workspaceId={workspaceId}
      excludeTicketIds={[currentTicketId]}
      onSelect={setTicket}
      dataTest="ticket-blocker-search-input"
    />
  );

  const noteControl = disabled ? (
    <p className="whitespace-pre-wrap text-[12.5px] text-foreground">
      {note || <span className="text-muted-foreground">No reason recorded.</span>}
    </p>
  ) : (
    <Textarea
      id={noteId}
      value={note}
      onChange={(e) => setNote(e.target.value)}
      maxLength={BLOCKER_NOTE_MAX_LENGTH}
      placeholder="e.g. waiting on the client's SSO certificate"
      className="min-h-[64px] resize-y rounded-[var(--r-control)] bg-card text-[12.5px]"
      data-test="ticket-blocker-note-input"
    />
  );

  const hint = disabled
    ? null
    : 'Both parts are optional. Cleared automatically when this ticket leaves Blocked.';

  if (isRail) {
    return (
      <section
        className="flex flex-col gap-2.5 border-b border-separator pb-3.5"
        data-test="ticket-blocker-panel"
      >
        <RailCaption icon>BLOCKED BY</RailCaption>
        {ticketControl}

        <div className="flex flex-col gap-[5px]">
          <div className="flex items-center justify-between gap-2">
            <RailCaption htmlFor={noteId}>REASON</RailCaption>
            {counter}
          </div>
          {noteControl}
        </div>

        {hint ? <p className="text-[11px] leading-snug text-muted-foreground/75">{hint}</p> : null}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3" data-test="ticket-blocker-panel">
      <Field label={<CaptionWithIcon>Blocking ticket</CaptionWithIcon>}>{ticketControl}</Field>

      <Field
        label={
          <span className="flex items-center justify-between gap-2">
            Why it&apos;s blocked
            {counter}
          </span>
        }
        htmlFor={noteId}
        hint={hint}
      >
        {noteControl}
      </Field>
    </section>
  );
}

/** The rail's caption type, so this section lines up with ASSIGNEE / PRIORITY / …  */
function RailCaption({ children, htmlFor, icon = false }) {
  const Tag = htmlFor ? 'label' : 'span';
  return (
    <Tag
      htmlFor={htmlFor}
      className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.07em] text-muted-foreground/75"
    >
      {icon ? (
        <CircleSlash
          className="h-3 w-3 shrink-0 text-[hsl(var(--tone-danger))]"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </Tag>
  );
}

function CaptionWithIcon({ children }) {
  return (
    <span className="flex items-center gap-1.5">
      <CircleSlash
        className="h-3 w-3 shrink-0 text-[hsl(var(--tone-danger))]"
        strokeWidth={1.8}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

/**
 * The linked ticket, as a tile: `#12` then the subject, with the status underneath.
 * Same shape as a row in the picker below it, so picking one and seeing it stick
 * reads as the same object.
 */
function LinkedTicket({ linked, linkedStatus, onOpen, onRemove }) {
  const label = ticketRefLabel(linked);
  const number = linked?.taskNumber ? `#${linked.taskNumber}` : '—';

  const body = (
    <>
      <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-muted-foreground">
        {number}
      </span>
      <span className="min-w-0 truncate text-[12.5px] font-medium text-foreground">
        {linked?.subject || label}
      </span>
    </>
  );

  return (
    <div
      className="flex items-center gap-2 rounded-[var(--r-tile)] border border-separator bg-card px-2.5 py-2"
      data-test="ticket-blocker-linked"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            title={`${label} — open it`}
            className="ui-focus-ring flex min-w-0 items-center gap-2 rounded-[var(--r-badge)] text-left transition-colors hover:[&>span:last-child]:underline"
            data-test="ticket-blocker-open-button"
          >
            {body}
          </button>
        ) : (
          <span className="flex min-w-0 items-center gap-2">{body}</span>
        )}

        {linkedStatus?.label ? (
          <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-muted-foreground/75">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: linkedStatus.color || 'currentColor' }}
              aria-hidden="true"
            />
            {linkedStatus.label}
            {linked?.isArchived ? ' · Archived' : ''}
          </span>
        ) : null}
      </div>

      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="ui-focus-ring grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[var(--r-badge)] text-muted-foreground/75 transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Remove blocking ticket"
          data-test="ticket-blocker-unlink-button"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export default BlockedByField;
