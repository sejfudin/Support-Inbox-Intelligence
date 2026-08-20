import { TicketTitleField } from './TicketTitleField';
import { TicketAssigneesField } from './TicketAssigneesField';
import { TicketStatusField } from './TicketStatusField';
import { TicketPriorityField } from './TicketPriorityField';

export function TicketHeaderFields({
  ticket,
  isArchived,
  title,
  onTitleChange,
  users,
  selectedAgents,
  setSelectedAgents,
  selectedUsersObjects,
  currentStatus,
  onStatusChange,
  statusOptions,
  statusBadgeConfig,
  currentPriority,
  onPriorityChange,
}) {
  return (
    <div className="group relative mb-8 flex flex-col gap-3">
      {ticket?.taskNumber && (
        <div className="flex">
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground border border-border uppercase tracking-tight">
            Ticket {ticket.taskNumber}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
        <div className="flex min-w-0 flex-1">
          <TicketTitleField title={title} onTitleChange={onTitleChange} isArchived={isArchived} />
        </div>

        <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3 lg:w-[420px]">
          <div className="space-y-2 min-w-0">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Assignees
            </div>
            <TicketAssigneesField
              isArchived={isArchived}
              users={users}
              selectedAgents={selectedAgents}
              setSelectedAgents={setSelectedAgents}
              selectedUsersObjects={selectedUsersObjects}
            />
          </div>

          <div className="space-y-2 min-w-0">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Status
            </div>
            <TicketStatusField
              isArchived={isArchived}
              ticket={ticket}
              currentStatus={currentStatus}
              onStatusChange={onStatusChange}
              statusOptions={statusOptions}
              statusBadgeConfig={statusBadgeConfig}
            />
          </div>

          <div className="space-y-2 min-w-0">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Priority
            </div>
            <TicketPriorityField
              isArchived={isArchived}
              ticket={ticket}
              currentPriority={currentPriority}
              onPriorityChange={onPriorityChange}
            />
          </div>
        </div>
      </div>

      {!title.trim() && (
        <p className="absolute -bottom-5 left-0 text-[9px] font-bold text-[hsl(var(--tone-danger-fg))] uppercase tracking-wider mt-1">
          Title is required
        </p>
      )}
    </div>
  );
}
