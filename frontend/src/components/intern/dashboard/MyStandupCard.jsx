import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowUpRight, CalendarOff, CheckCircle2, NotebookPen, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { ExampleChip } from './ExampleChip';
import { AddEntryModal } from '@/components/dailies/AddEntryModal';
import { useAuth } from '@/context/AuthContext';
import { useDaily } from '@/queries/dailies';
import { useSummarizeMyStandup } from '@/queries/internDashboard';

/**
 * Hard character caps. This card sits in a three-across row, so its height is
 * the row's height — an unbounded note does not just overflow itself, it pushes
 * the attendance hero and the workload card down with it. Nothing here expands
 * in place: the full text opens on the standup page instead.
 *
 * The cap is per section rather than one budget across the note, so a long
 * "Done" can never eat the space that "Blocked" needs — the blocker is the part
 * of a standup someone else has to act on, and it must always be visible.
 */
const SECTION_CHAR_CAP = 120;
const SUMMARY_CHAR_CAP = 320;

/**
 * The three sections of a stored entry, each on its own line.
 *
 * `Daily` keeps done / todo / blockers as three arrays of lines. Run together as
 * one paragraph they were unreadable — you could not tell at a glance what was
 * finished from what is blocked, which is the whole question the card answers.
 * The label colours are the same semantics the rest of the board uses: emerald
 * for done, primary for in-flight, red for blocked.
 */
const SECTIONS = [
  { key: 'done', label: 'Done', className: 'text-[hsl(var(--tone-success-fg))]' },
  { key: 'todo', label: 'Today', className: 'text-primary' },
  { key: 'blocked', label: 'Blocked', className: 'text-[hsl(var(--tone-danger-fg))]' },
];

/** Cut to `cap`, preferring the last word boundary so it doesn't end mid-word. */
const truncate = (text, cap) => {
  if (text.length <= cap) return { text, truncated: false };
  const hard = text.slice(0, cap);
  const lastSpace = hard.lastIndexOf(' ');
  // Only honour the word boundary if it isn't so early that it throws most of
  // the budget away — a note with one very long token would otherwise show "…".
  const cut = lastSpace > cap * 0.6 ? hard.slice(0, lastSpace) : hard;
  return { text: `${cut.trimEnd()}…`, truncated: true };
};

const composeNote = ({ done = [], todo = [], blockers = [] }) => {
  const lines = {
    done,
    todo,
    blocked: blockers.map((blocker) => blocker.text),
  };

  return SECTIONS.filter((section) => lines[section.key].length > 0).map((section) => ({
    ...section,
    ...truncate(lines[section.key].join(' '), SECTION_CHAR_CAP),
  }));
};

/**
 * The intern's own standup note for today.
 *
 * The note itself is the default view — the AI summary is an alternative behind a
 * toggle, not a replacement. Both are capped; neither ever grows the card.
 *
 * Read-only plus a link out: writing a note involves the ticket picker for
 * blockers and the whole workspace's daily, which is what `/dailies` is for.
 * Duplicating that editor into a dashboard card would give the feature two
 * places to drift apart.
 */
export function MyStandupCard({ standup, isPreview = false }) {
  const [showSummary, setShowSummary] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { user } = useAuth();
  const { mutate: summarize, isPending: isSummarizing } = useSummarizeMyStandup();

  // `AddEntryModal` is the standup page's own editor, reused as-is rather than
  // reimplemented here — it owns the blocker/ticket picker and the add-vs-update
  // mutation split, and a second copy would drift. It needs the real `Daily`
  // document and entry subdocument, which the dashboard aggregate deliberately
  // does not carry (it sends a display shape, not the editable one).
  //
  // Fetched as soon as the note is editable rather than on click: it is the same
  // cached query `/dailies` uses, so the modal opens instantly instead of on a
  // spinner, and navigating to the standup page afterwards is already warm.
  const canEdit = Boolean(standup?.written && standup?.editable && standup?.date);
  const { data: dailyResponse } = useDaily(user?.workspaceId, standup?.date, {
    enabled: canEdit && Boolean(user?.workspaceId),
  });
  const daily = dailyResponse?.data ?? null;
  const myEntry =
    daily?.entries?.find(
      (entry) => String(entry.member?._id ?? entry.member) === String(user?._id)
    ) ?? null;

  // The server decides which notes are long enough to summarise (`needsSummary`)
  // and the card acts on it, so the summary is ready the moment the intern wants
  // it rather than after a wait.
  //
  // The ref is what makes that safe: a failed generation leaves `needsSummary`
  // true, and without a guard this effect would retry on every render and hammer
  // the provider. One attempt per note per mount; the fallback is the capped
  // note, which is all the card shows by default anyway.
  const attemptedFor = useRef(null);

  useEffect(() => {
    if (!standup?.needsSummary) return;
    const noteKey = standup.updatedAt || standup.date;
    if (attemptedFor.current === noteKey) return;
    attemptedFor.current = noteKey;
    summarize();
  }, [standup?.needsSummary, standup?.updatedAt, standup?.date, summarize]);

  if (standup?.isWeekend) {
    return (
      <DashboardCard title="Today's standup note" data-tour="intern-dashboard-standup">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <CalendarOff className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">No standup today</p>
          <p className="text-xs leading-5 text-muted-foreground">
            It&apos;s the weekend — the next one is Monday.
          </p>
        </div>
      </DashboardCard>
    );
  }

  if (!standup?.written) {
    return (
      <DashboardCard
        title="Today's standup note"
        action={<NotebookPen className="h-4 w-4 shrink-0 text-muted-foreground" />}
        data-tour="intern-dashboard-standup"
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center">
          <p className="text-lg font-semibold text-foreground">Not written</p>
          <p className="max-w-[16rem] text-xs leading-5 text-muted-foreground">
            Say what you finished, what you&apos;re on today, and anything blocking you.
          </p>
        </div>
        <div className="mt-auto pt-4">
          <Button asChild size="sm" className="w-full">
            <Link to="/dailies" data-test="intern-dashboard-write-note-link">
              Write my note
            </Link>
          </Button>
        </div>
      </DashboardCard>
    );
  }

  const sections = composeNote(standup);
  const summary = standup.aiSummary ? truncate(standup.aiSummary, SUMMARY_CHAR_CAP) : null;

  // Anything cut here is reachable in full on the standup page — never inline, so
  // the card's height is the same whichever view is selected.
  const isClipped = sections.some((section) => section.truncated);
  const dailyHref = standup.date ? `/dailies?date=${standup.date}` : '/dailies';

  return (
    <DashboardCard
      title="Today's standup note"
      action={
        isPreview ? (
          <ExampleChip />
        ) : (
          <CheckCircle2
            className="h-4 w-4 shrink-0 text-[hsl(var(--tone-success-fg))]"
            aria-label="Submitted"
          />
        )
      }
      data-tour="intern-dashboard-standup"
    >
      {showSummary && summary && (
        <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-primary">
          <Sparkles className="h-3 w-3" />
          AI summary
        </span>
      )}

      {/* break-words throughout: a standup line is free text and can legitimately
          contain a long unbroken token (a branch name, a URL, a stack frame).
          Without it one of those runs straight out of the card. */}
      {showSummary && summary ? (
        <p className="break-words text-sm leading-relaxed text-muted-foreground">{summary.text}</p>
      ) : (
        <div className="space-y-2.5">
          {sections.map((section) => (
            <div key={section.key}>
              <p
                className={cn(
                  'text-[11px] font-bold uppercase tracking-[0.1em]',
                  section.className
                )}
              >
                {section.label}
              </p>
              <p className="mt-0.5 break-words text-sm leading-relaxed text-foreground/85">
                {section.text}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {summary && (
          <button
            type="button"
            onClick={() => setShowSummary((on) => !on)}
            className="text-[11px] font-semibold text-primary hover:underline"
            data-test="intern-dashboard-note-toggle"
          >
            {showSummary ? 'Show original' : 'Show AI summary'}
          </button>
        )}
        {isSummarizing && !summary && (
          <span className="animate-pulse text-[11px] text-muted-foreground">
            Summarising your note…
          </span>
        )}
        {/* Opens the standup page on this note's own day rather than expanding
            in place — expanding is what pushed the rest of the row down. */}
        {isClipped && (
          <Link
            to={dailyHref}
            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary hover:underline"
            data-test="intern-dashboard-view-full-note-link"
          >
            View full note
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      <div className="mt-auto pt-4">
        <p className="text-[11px] text-muted-foreground">
          {standup.submittedAt && `Submitted ${format(new Date(standup.submittedAt), 'HH:mm')}`}
          {standup.ticketsMentioned > 0 && (
            <>
              {standup.submittedAt && ' · '}
              {standup.ticketsMentioned} ticket
              {standup.ticketsMentioned === 1 ? '' : 's'} mentioned
            </>
          )}
        </p>
        {/* Editing happens in place. Falls back to a link when the edit window
            has closed (a daily is only editable on its day and the next working
            one) or while the entry is still loading — there is nothing to open
            an editor on yet. */}
        {canEdit && myEntry ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2 w-full"
            onClick={() => setIsEditOpen(true)}
            data-test="intern-dashboard-edit-note-button"
          >
            Edit my note
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline" className="mt-2 w-full">
            <Link to={dailyHref} data-test="intern-dashboard-edit-note-link">
              {standup.editable ? 'Edit my note' : 'Open standups'}
            </Link>
          </Button>
        )}
      </div>

      {canEdit && myEntry && (
        <AddEntryModal
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          workspaceId={user?.workspaceId}
          daily={daily}
          entry={myEntry}
          date={new Date(`${standup.date}T12:00:00`)}
        />
      )}
    </DashboardCard>
  );
}
