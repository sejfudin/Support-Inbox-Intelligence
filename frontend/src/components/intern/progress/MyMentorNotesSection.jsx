import { format } from 'date-fns';
import { UserAvatar } from '@/components/ui/user-avatar';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import { ProgressPanel, ProgressPanelEmpty, ProgressPanelLead } from './ProgressPanel';

/**
 * "Notes from your mentor" — the mentor/admin notes their authors explicitly
 * chose, at write time, to share with the intern they're about (a separate,
 * opt-in flag from the staff-only "Mentor notes" tab; see
 * `server/services/internProgressService.js`).
 *
 * Read-only, same as every other section on this page: there is no reply or
 * write path here, only the note text, who wrote it, and when.
 */
/** The closed band's summary: what is in this section, in one muted phrase. */
function SectionCount({ children }) {
  return <span className="text-[11.5px] font-medium text-muted-foreground">{children}</span>;
}

export function MyMentorNotesSection({ mentorNotes }) {
  const items = mentorNotes?.items || [];

  return (
    <ProgressPanel
      id="my-progress-mentor-notes"
      title="Notes from your mentor"
      action={
        <SectionCount>
          {items.length === 0
            ? 'None yet'
            : `${items.length} note${items.length === 1 ? '' : 's'} shared`}
        </SectionCount>
      }
      dataTour="my-progress-mentor-notes"
    >
      <ProgressPanelLead>
        Notes your mentor or an admin chose to share with you directly — most notes stay internal
        and never appear here.
      </ProgressPanelLead>

      {items.length === 0 ? (
        <ProgressPanelEmpty>
          Nothing shared with you yet. Your mentor or an admin can share a note here any time.
        </ProgressPanelEmpty>
      ) : (
        <ul className="divide-y divide-separator">
          {items.map((note) => (
            <li key={note.id} className="flex gap-3 p-[18px]">
              <UserAvatar user={note.author} size="sm" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] leading-[1.35]">
                  <span className="font-semibold text-foreground">
                    {note.author?.fullname ?? 'Unknown'}
                  </span>
                  <span className="ml-1.5 text-[11.5px] text-muted-foreground/75">
                    {capitalizeFirst(note.author?.role || '')} ·{' '}
                    {format(new Date(note.createdAt), 'MMM d, yyyy')}
                  </span>
                </p>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-foreground/90 [overflow-wrap:anywhere]">
                  {note.content}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ProgressPanel>
  );
}
