import { format } from 'date-fns';

import { Avatar } from '@/components/Avatar';
import { formatDuration } from '@/helpers/formatDuration';
import { getTicketTimeSpentSeconds, isTicketTrackingTime } from '@/helpers/ticketTimeSpent';
import { useTimeSpentTicker } from '@/hooks/useTimeSpentTicker';
import { cn } from '@/lib/utils';

import { TicketAssigneesField } from './TicketAssigneesField';
import { TicketCategoryField } from './TicketCategoryField';
import { TicketDueDateField } from './TicketDueDateField';
import { TicketPriorityField } from './TicketPriorityField';
import { TicketStoryPointsField } from './TicketStoryPointsField';

/** One rail row: a 10.5px caption over its value, per the mockup's meta column. */
function RailField({ label, children, className }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-[5px]', className)}>
      <span className="text-[10.5px] font-semibold tracking-[0.07em] text-muted-foreground/75">
        {label}
      </span>
      {children}
    </div>
  );
}

const RAIL_VALUE = 'text-[12.5px] font-medium text-foreground';

/**
 * The modal's 300px meta column, 1:1 with the mockup: a `surface-alt` rail of
 * flat label/value rows, closed by the category chips.
 *
 * It replaces three collapsible accordions (Details / Tracking / PR). Those hid
 * every field behind a disclosure and stacked three more card outlines inside a
 * modal that already has one — the mockup states the values outright, which is
 * what a side rail is for.
 */
export function TicketMetaRail({
  ticket,
  isArchived,
  users,
  selectedAgents,
  setSelectedAgents,
  selectedUsersObjects,
  currentPriority,
  onPriorityChange,
  currentStoryPoints,
  onStoryPointsChange,
  dueDateInput,
  onDueDateChange,
  categories,
  currentCategory,
  onCategoryChange,
  statusTracksTime,
  lead,
  children,
}) {
  const tracksTime = isTicketTrackingTime(ticket, statusTracksTime);
  useTimeSpentTicker(tracksTime ? [ticket] : [], statusTracksTime);
  const seconds = getTicketTimeSpentSeconds(ticket, statusTracksTime);
  const creator = ticket?.creator;
  const creatorName = creator?.fullname || creator?.fullName || 'Unknown user';

  return (
    <aside
      className={cn(
        'flex min-w-0 flex-col gap-3.5 bg-muted px-[18px] pb-[22px] pt-[18px]',
        // The rail is the tinted surface, so its controls need their own. Left
        // as-is they are `bg-muted` on `bg-muted` and read as plain text. Scoped
        // to the dropdown triggers by data-test so the category chips below keep
        // their own pill styling.
        '[&_[data-test$="-trigger"]]:h-[30px] [&_[data-test$="-trigger"]]:rounded-[var(--r-control)]',
        '[&_[data-test$="-trigger"]]:border [&_[data-test$="-trigger"]]:border-separator',
        '[&_[data-test$="-trigger"]]:bg-card [&_[data-test$="-trigger"]]:px-2',
        '[&_[data-test$="-trigger"]]:text-[12.5px] [&_[data-test$="-trigger"]]:font-medium',
        '[&_[data-test$="-trigger"]]:normal-case'
      )}
      data-test="ticket-modal-meta-rail"
    >
      {/* Above ASSIGNEE, ahead of the mockup's order, because the only thing that
          renders here is the blocker — the answer to "why is this not moving?"
          belongs at the top of the column, not under the category chips. */}
      {lead}

      <RailField label="ASSIGNEE">
        <TicketAssigneesField
          isArchived={isArchived}
          users={users}
          selectedAgents={selectedAgents}
          setSelectedAgents={setSelectedAgents}
          selectedUsersObjects={selectedUsersObjects}
        />
      </RailField>

      <RailField label="PRIORITY">
        <TicketPriorityField
          isArchived={isArchived}
          ticket={ticket}
          currentPriority={currentPriority}
          onPriorityChange={onPriorityChange}
        />
      </RailField>

      <RailField label="STORY POINTS">
        <TicketStoryPointsField
          isArchived={isArchived}
          currentStoryPoints={currentStoryPoints}
          onStoryPointsChange={onStoryPointsChange}
          bare
        />
      </RailField>

      <RailField label="DUE DATE">
        <TicketDueDateField
          isArchived={isArchived}
          dueDateInput={dueDateInput}
          onDueDateChange={onDueDateChange}
        />
      </RailField>

      <RailField label="TIME SPENT">
        <span className={cn('flex items-center gap-1.5', RAIL_VALUE)}>
          {tracksTime ? (
            <span
              className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--tone-info))]"
              title="Timer active"
            />
          ) : null}
          {formatDuration(seconds)}
        </span>
      </RailField>

      <RailField label="CREATED BY">
        <span className="flex min-w-0 items-center gap-2">
          {creator ? (
            <Avatar users={[creator]} size="xs" />
          ) : (
            <span className="h-[22px] w-[22px] animate-pulse rounded-full bg-border" />
          )}
          <span
            className="min-w-0 truncate text-[12.5px] text-muted-foreground"
            title={creatorName}
          >
            {creatorName}
            {ticket?.createdAt ? ` · ${format(new Date(ticket.createdAt), 'MMM d, yyyy')}` : ''}
          </span>
        </span>
      </RailField>

      {categories.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-separator pt-3">
          <span className="text-[10.5px] font-semibold tracking-[0.07em] text-muted-foreground/75">
            CATEGORY
          </span>
          <TicketCategoryField
            isArchived={isArchived}
            categories={categories}
            currentCategory={currentCategory}
            onCategoryChange={onCategoryChange}
          />
        </div>
      ) : null}

      {/* The linked-PR panel is not in the mockup, but it is a real integration —
          it keeps its card, at the foot of the rail. */}
      {children}
    </aside>
  );
}
