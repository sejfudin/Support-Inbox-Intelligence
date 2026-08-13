import { Ban, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLES } from '@/helpers/roles';
import { getInitials } from '@/helpers/staffingRequests';
import { formatDay } from './requestPresentation';

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
// programme refusing it — different sides, different fields, and never the same
// sentence.
const CLOSURE = {
  cancelled: {
    Icon: Ban,
    eyebrow: 'Cancelled',
    // The ask was withdrawn from the outside in, so the actor is the subject.
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
    // A decline's reason IS the admin's remark — mandatory, and stored as `note`.
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
 * reader opens a closed request for. It also said *that* it was cancelled
 * without ever saying *why*, while the reason sat in a quiet two-line section
 * further up the card.
 *
 * Naming the side matters more than naming the person: "withdrawn by leadership"
 * and "refused by the admin team" are different events with different
 * consequences, and on a closed record the reader is usually the other side of
 * that exchange. The person is named underneath, because someone will need to go
 * and ask them.
 */
export function RequestClosure({ request }) {
  if (request?.status !== 'closed') return null;

  const closure = CLOSURE[request.reason];
  if (!closure) return null;

  const side = actorSide(request);
  const text = closure.text(request)?.trim();
  const closedOn = formatDay(request.closedAt);

  return (
    <section
      className={cn(
        'space-y-3 rounded-xl border-l-4 p-4',
        closure.tone === 'danger' && 'border-l-destructive bg-destructive/5',
        closure.tone === 'success' &&
          'border-l-emerald-600 bg-emerald-500/5 dark:border-l-emerald-400 dark:bg-emerald-400/10'
      )}
      data-test={`request-closure-${request.reason}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <closure.Icon
          className={cn(
            'h-4 w-4 shrink-0',
            closure.tone === 'danger' && 'text-destructive',
            closure.tone === 'success' && 'text-emerald-600 dark:text-emerald-400'
          )}
          aria-hidden="true"
        />
        <p
          className={cn(
            'text-[0.6875rem] font-semibold uppercase tracking-wide',
            closure.tone === 'danger' && 'text-destructive',
            closure.tone === 'success' && 'text-emerald-600 dark:text-emerald-400'
          )}
        >
          {closure.eyebrow}
        </p>
        <p className="text-sm font-semibold text-foreground">{closure.headline(side)}</p>
        {closedOn && <p className="text-xs text-muted-foreground">· {closedOn}</p>}
      </div>

      {text ? (
        <p className="whitespace-pre-wrap text-base leading-7 text-foreground">{text}</p>
      ) : (
        closure.missing && <p className="text-sm italic text-muted-foreground">{closure.missing}</p>
      )}

      {request.closedBy?.fullname && (
        <div className="flex items-center gap-2">
          <span className="symphony-suggestion-avatar" aria-hidden="true">
            {getInitials(request.closedBy.fullname)}
          </span>
          <p className="text-xs text-muted-foreground">
            {request.closedBy.fullname}
            {request.closedBy.role && ` · ${request.closedBy.role}`}
          </p>
        </div>
      )}
    </section>
  );
}
