import { Ban, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLES } from '@/helpers/roles';
import { formatDay } from '@/components/symphony/requests/requestPresentation';
import { UserAvatar } from '@/components/ui/user-avatar';

const Avatar = ({ user }) => (
  <UserAvatar user={user} className="h-7 w-7 text-[10.5px]" showTitle={false} />
);

/**
 * The admin's one remark on a request, for anything leadership should know that
 * the suggested candidates don't say.
 *
 * Read-only everywhere, by design and not by omission: the note is written once,
 * by the admin who answers the request, as the reason they fulfilled or declined
 * it. There is no route to revise it afterwards — a closed request is a fixed
 * record (ADR 0005) — and it is one note, never a thread, so there is no edit
 * and no reply affordance.
 */
export function RequestNoteCard({ request }) {
  const note = request.note?.trim();
  if (!note) return null;

  return (
    <section className="space-y-2" data-test="request-note">
      <p className="app-crumb">Note from the admin</p>
      <div className="flex gap-3 rounded-[var(--r-card)] border border-border bg-muted/30 p-3.5">
        <Avatar user={request.noteBy} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="whitespace-pre-wrap text-[13px] leading-6 text-foreground">{note}</p>
          <p className="text-[11.5px] text-muted-foreground">
            {request.noteBy?.fullname ?? 'An admin'}
            {request.noteAt && ` · ${formatDay(request.noteAt)}`}
          </p>
        </div>
      </div>
    </section>
  );
}

// Which side ended the request, in the words each shell's readers use. Read off
// `closedBy.role` rather than inferred from the reason: the rule is one-per-side
// today (leadership withdraws, admin answers), but records closed before that
// rule existed don't know it, and a panel that states the wrong side is worse
// than one that states none.
const actorSide = (request) => {
  const role = request.closedBy?.role;
  if (role === ROLES.LEADERSHIP) return 'leadership';
  if (role === ROLES.ADMIN) return 'the admin team';
  return null;
};

// One entry per close reason: how it is announced, whose text explains it, and
// how it reads. `cancelled` is the demand going away, `declined` is the
// programme refusing it — different sides, different fields, never the same
// sentence.
const CLOSURE = {
  cancelled: {
    Icon: Ban,
    eyebrow: 'Cancelled',
    headline: (side) => (side ? `Withdrawn by ${side}` : 'The ask was withdrawn'),
    // A cancellation reason lives in `closeNote` precisely so withdrawing an ask
    // can never overwrite what an admin said about it.
    text: (request) => request.closeNote,
    missing: 'No reason was recorded for the withdrawal.',
    tone: 'danger',
  },
  declined: {
    Icon: XCircle,
    eyebrow: 'Declined',
    headline: (side) => (side ? `Refused by ${side}` : 'The request was refused'),
    // A decline's reason IS the admin's remark — mandatory, stored as `note`.
    text: (request) => request.note,
    missing: 'No reason was recorded for the refusal.',
    tone: 'danger',
  },
  fulfilled: {
    Icon: CheckCircle2,
    eyebrow: 'Fulfilled',
    headline: (side) => (side ? `Answered by ${side}` : 'The request was answered'),
    text: (request) => request.note,
    missing: null,
    tone: 'success',
  },
};

/**
 * How a request ended, and who ended it.
 *
 * This is what a closed request has left to say, and it replaced the history
 * trail at the bottom of both panes. The trail listed every event equally —
 * filed, project resolved, put forward, closed — which buried the one fact a
 * reader opens a closed request for, and it said *that* it was cancelled without
 * ever saying *why*.
 *
 * Naming the side matters more than naming the person: "withdrawn by leadership"
 * and "refused by the admin team" are different events with different
 * consequences, and on a closed record the reader is usually the other side of
 * that exchange. The person is named underneath, because someone will need to go
 * and ask them.
 */
export function RequestClosurePanel({ request }) {
  if (request?.status !== 'closed') return null;

  const closure = CLOSURE[request.reason];
  if (!closure) return null;

  const side = actorSide(request);
  const text = closure.text(request)?.trim();
  const closedOn = formatDay(request.closedAt);
  const isDanger = closure.tone === 'danger';
  const toneText = isDanger
    ? 'text-[hsl(var(--tone-danger-fg))]'
    : 'text-[hsl(var(--tone-success-fg))]';

  return (
    <section
      className={cn(
        'space-y-3 rounded-[var(--r-card)] border-l-4 p-3.5',
        isDanger
          ? 'border-l-destructive bg-destructive/5'
          : 'border-l-[hsl(var(--tone-success))] bg-[hsl(var(--tone-success)/0.07)]'
      )}
      data-test={`request-closure-${request.reason}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <closure.Icon className={cn('h-4 w-4 shrink-0', toneText)} aria-hidden="true" />
        <p className={cn('text-[11px] font-semibold uppercase tracking-wide', toneText)}>
          {closure.eyebrow}
        </p>
        <p className="text-[13px] font-semibold text-foreground">{closure.headline(side)}</p>
        {closedOn && <p className="text-[11.5px] text-muted-foreground">· {closedOn}</p>}
      </div>

      {text ? (
        <p className="whitespace-pre-wrap text-[13.5px] leading-7 text-foreground">{text}</p>
      ) : (
        closure.missing && (
          <p className="text-[12.5px] italic text-muted-foreground">{closure.missing}</p>
        )
      )}

      {request.closedBy?.fullname && (
        <div className="flex items-center gap-2">
          <Avatar user={request.closedBy} />
          <p className="text-[11.5px] text-muted-foreground">
            {request.closedBy.fullname}
            {request.closedBy.role && ` · ${request.closedBy.role}`}
          </p>
        </div>
      )}
    </section>
  );
}
