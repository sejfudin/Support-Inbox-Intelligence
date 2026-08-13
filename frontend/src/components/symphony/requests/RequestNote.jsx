import { getInitials } from '@/helpers/staffingRequests';
import { formatDay } from './requestPresentation';

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
export function RequestNote({ request }) {
  const note = request.note?.trim();
  if (!note) return null;

  return (
    <section className="space-y-2" data-test="request-note">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Note from the admin
      </p>
      <div className="symphony-card-muted flex gap-3 p-4">
        <span className="symphony-suggestion-avatar" aria-hidden="true">
          {getInitials(request.noteBy?.fullname ?? '')}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{note}</p>
          <p className="text-xs text-muted-foreground">
            {request.noteBy?.fullname ?? 'An admin'}
            {request.noteAt && ` · ${formatDay(request.noteAt)}`}
          </p>
        </div>
      </div>
    </section>
  );
}
