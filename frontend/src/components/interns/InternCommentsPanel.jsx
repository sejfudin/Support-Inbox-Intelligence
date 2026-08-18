import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SortControl } from '@/components/interns/SortControl';
import { Chips, DetailModal, DetailText } from '@/components/interns/DetailModal';
import { useCommentViewers, useCreateInternComment, useInternComments } from '@/queries/interns';
import { canWriteInternMentorData } from '@/helpers/roles';
import { CHIP, badgeTone } from '@/helpers/badgeTones';
import { getInitials } from '@/helpers/getInitials';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const SORT_OPTIONS = [
  { key: 'date', label: 'Date' },
  { key: 'author', label: 'Author' },
];

const viewerId = (viewer) => viewer?._id || viewer?.id;

/**
 * What the note's audience chip says. An empty `visibleTo` is not "shared with
 * nobody" — admins and the author always see the note — so it reads as the
 * narrowest real audience rather than as an empty list.
 */
function audienceOf(comment) {
  const viewers = (comment.visibleTo || []).filter(Boolean);
  if (viewers.length === 0) return { label: 'Admins only', tone: 'warning' };
  if (viewers.every((viewer) => viewer.role === 'mentor')) {
    return { label: 'Mentors', tone: 'neutral', names: viewers.map((v) => v.fullname) };
  }
  return {
    label: `Shared with ${viewers.length}`,
    tone: 'neutral',
    names: viewers.map((v) => v.fullname),
  };
}

function NoteAvatar({ name }) {
  return (
    <span
      className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-primary/15 text-[10.5px] font-bold accent-ink"
      aria-hidden="true"
    >
      {getInitials(name || '')}
    </span>
  );
}

/**
 * The composer's audience control. Select-shaped, but a menu of checkboxes
 * underneath: the audience is a list of specific people, not one of three
 * presets, and collapsing it to a preset would quietly remove the ability to
 * share a note with one named mentor.
 */
function SharedWithMenu({ viewers, visibleTo, onToggle, onSetAll, onClear }) {
  const mentorIds = viewers.filter((v) => v.role === 'mentor').map(viewerId);
  const allMentors =
    mentorIds.length > 0 &&
    visibleTo.length === mentorIds.length &&
    mentorIds.every((id) => visibleTo.includes(id));

  const label = allMentors
    ? 'Shared with mentors'
    : visibleTo.length === 0
      ? 'Admins only'
      : `Shared with ${visibleTo.length} ${visibleTo.length === 1 ? 'person' : 'people'}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-[var(--r-control)] border border-input bg-card px-2.5 text-[12.5px] text-foreground transition-colors hover:bg-accent/60"
          data-test="intern-comment-visibility-trigger"
        >
          {label}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-[11.5px]">Who else can read this</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {viewers.map((viewer) => {
          const id = viewerId(viewer);
          return (
            <DropdownMenuCheckboxItem
              key={id}
              checked={visibleTo.includes(id)}
              onCheckedChange={() => onToggle(id)}
              onSelect={(event) => event.preventDefault()}
              className="text-[12.5px]"
              data-test={`intern-comment-viewer-${id}-checkbox`}
            >
              {viewer.fullname}
              <span className="ml-1 text-muted-foreground/75">({viewer.role})</span>
            </DropdownMenuCheckboxItem>
          );
        })}
        {mentorIds.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="flex items-center gap-2 px-2 py-1.5">
              <button
                type="button"
                onClick={onSetAll}
                className="text-[11.5px] font-semibold accent-ink hover:underline"
              >
                All mentors
              </button>
              <button
                type="button"
                onClick={onClear}
                className="text-[11.5px] font-semibold text-muted-foreground hover:text-foreground"
              >
                Admins only
              </button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function InternCommentsPanel({ userId, readOnly = false }) {
  const { user } = useAuth();
  const canWrite = !readOnly && canWriteInternMentorData(user?.role);
  const { data: comments = [], isPending } = useInternComments(userId);
  const { data: allViewers = [] } = useCommentViewers({ enabled: canWrite });
  const { mutate, isPending: isSaving } = useCreateInternComment();

  const [detailComment, setDetailComment] = useState(null);
  const [content, setContent] = useState('');
  const [visibleTo, setVisibleTo] = useState([]);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('desc');

  // You are never in your own audience list — you wrote the note.
  const viewers = useMemo(
    () => allViewers.filter((viewer) => viewerId(viewer) !== user?._id),
    [allViewers, user?._id]
  );

  const toggleViewer = (id) => {
    setVisibleTo((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!content.trim()) return;

    mutate(
      { userId, payload: { content: content.trim(), visibleTo } },
      {
        onSuccess: () => {
          setContent('');
          setVisibleTo([]);
          toast.success('Note posted');
        },
        onError: (err) => toast.error(err?.response?.data?.message || 'Failed to add comment'),
      }
    );
  };

  const handleSortKeyChange = (key) => {
    setSortKey(key);
    if (key) setSortDir(key === 'date' ? 'desc' : 'asc');
  };

  const ordered = useMemo(() => {
    const newestFirst = [...comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (!sortKey) return newestFirst;
    const factor = sortDir === 'asc' ? 1 : -1;
    return newestFirst.sort((a, b) => {
      if (sortKey === 'date') {
        return (new Date(a.createdAt) - new Date(b.createdAt)) * factor;
      }
      return (
        String(a.author?.fullname ?? '').localeCompare(String(b.author?.fullname ?? '')) * factor
      );
    });
  }, [comments, sortKey, sortDir]);

  const subtitle = `${ordered.length} note${ordered.length === 1 ? '' : 's'} · visible to admins and mentors`;

  return (
    <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="app-card overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-separator px-[18px] py-3">
          <div className="min-w-0">
            <h2 className="app-card-title">Mentor notes</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</p>
          </div>
          {ordered.length > 0 && (
            <SortControl
              sortKey={sortKey}
              sortDir={sortDir}
              options={SORT_OPTIONS}
              onSortKeyChange={handleSortKeyChange}
              onToggleDir={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="h-8 rounded-[var(--r-control)]"
              triggerClassName="text-[12.5px]"
              dataTest="mentor-notes-sort"
            />
          )}
        </header>

        {/* Inline rather than behind a "New note" dialog: writing a note is the
            main thing this tab is for, and the audience control has to sit beside
            the text so you pick it before posting, not in a separate step. */}
        {canWrite && (
          <form className="border-b border-separator px-[18px] py-3" onSubmit={handleSubmit}>
            <AutoTextarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={3}
              placeholder="Add a note about this intern…"
              className="text-[12.5px]"
              aria-label="Add a note about this intern"
              data-test="intern-comment-content-input"
            />
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <SharedWithMenu
                viewers={viewers}
                visibleTo={visibleTo}
                onToggle={toggleViewer}
                onSetAll={() =>
                  setVisibleTo(viewers.filter((v) => v.role === 'mentor').map(viewerId))
                }
                onClear={() => setVisibleTo([])}
              />
              <Button
                type="submit"
                className="px-3 text-[12.5px]"
                disabled={isSaving || !content.trim()}
                data-test="intern-comment-submit-button"
              >
                {isSaving ? 'Posting…' : 'Post note'}
              </Button>
            </div>
          </form>
        )}

        <div>
          {isPending && (
            <p className="px-[18px] py-8 text-center text-[12.5px] text-muted-foreground">
              Loading…
            </p>
          )}
          {!isPending && ordered.length === 0 && (
            <p className="px-[18px] py-10 text-center text-[12.5px] text-muted-foreground">
              No notes you can view yet.
            </p>
          )}
          {!isPending &&
            ordered.map((comment) => {
              const audience = audienceOf(comment);
              return (
                <article
                  key={comment._id}
                  className="border-b border-separator px-[18px] py-3 last:border-b-0"
                  data-test={`history-card-${comment._id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <NoteAvatar name={comment.author?.fullname} />
                      <p className="min-w-0 truncate text-[12.5px] leading-[1.35]">
                        <span className="font-semibold text-foreground">
                          {comment.author?.fullname ?? 'Unknown'}
                        </span>
                        <span className="ml-1.5 text-[11.5px] text-muted-foreground/75">
                          {capitalizeFirst(comment.author?.role || '')} ·{' '}
                          {format(new Date(comment.createdAt), 'MMM d, yyyy')}
                        </span>
                      </p>
                    </div>
                    <span
                      className={cn(CHIP, 'shrink-0 border-0', badgeTone(audience.tone))}
                      title={audience.names?.join(', ')}
                    >
                      {audience.label}
                    </span>
                  </div>

                  {/* Most notes are a sentence or two and should just be read in
                      place. The clamp and its "Read more" only appear past roughly
                      three lines' worth of text — a length heuristic rather than a
                      measurement, but wrong only in the harmless direction (a
                      slightly-too-long note renders in full). */}
                  <p className="mt-2 text-[12.5px] leading-[1.5] text-foreground/90">
                    <span
                      className={cn(
                        'align-top [overflow-wrap:anywhere]',
                        comment.content.length > 220 && 'line-clamp-3'
                      )}
                    >
                      {comment.content}
                    </span>
                    {comment.content.length > 220 && (
                      <button
                        type="button"
                        onClick={() => setDetailComment(comment)}
                        className="mt-0.5 font-semibold accent-ink hover:underline"
                      >
                        Read more
                      </button>
                    )}
                  </p>
                </article>
              );
            })}
        </div>
      </section>

      {viewers.length > 0 && (
        <aside className="app-card p-[18px] pt-[15px]">
          <h3 className="app-card-title">Who can read these</h3>
          <p className="mt-0.5 text-[12.5px] leading-[1.5] text-muted-foreground">
            Notes never appear on the intern&apos;s own profile.
          </p>
          <div className="mt-3 flex flex-col gap-2.5">
            {viewers.map((viewer) => (
              <div key={viewerId(viewer)} className="flex items-center gap-2">
                <NoteAvatar name={viewer.fullname} />
                <div className="min-w-0 leading-[1.35]">
                  <p className="truncate text-[12.5px] font-semibold text-foreground">
                    {viewer.fullname}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground/75">
                    {capitalizeFirst(viewer.role || '')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}

      <DetailModal
        open={Boolean(detailComment)}
        onClose={() => setDetailComment(null)}
        dataTest="intern-comment-detail-dialog"
        title={detailComment?.author?.fullname ?? 'Mentor note'}
        subtitle={
          detailComment ? format(new Date(detailComment.createdAt), 'MMM d, yyyy') : undefined
        }
        sections={
          detailComment
            ? [
                { content: <DetailText>{detailComment.content}</DetailText> },
                ...(detailComment.visibleTo?.length > 0
                  ? [
                      {
                        label: 'Shared with',
                        content: (
                          <Chips
                            items={detailComment.visibleTo
                              .filter((viewer) => viewer?.fullname)
                              .map((viewer) => viewer.fullname)}
                          />
                        ),
                      },
                    ]
                  : []),
              ]
            : []
        }
      />
    </div>
  );
}
