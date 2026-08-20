import { User } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import AssigneesAvatar from '@/components/Tickets/AssigneesAvatar';

export function TicketAssigneesField({
  isArchived,
  users,
  selectedAgents,
  setSelectedAgents,
  selectedUsersObjects,
}) {
  if (isArchived) {
    return (
      <div className="flex min-h-[40px] items-center gap-2 px-1 py-2">
        {selectedUsersObjects.length > 0 ? (
          <>
            <AssigneesAvatar users={selectedUsersObjects.slice(0, 3)} size="sm" />
            <span className="min-w-0 truncate text-sm font-semibold text-foreground">
              {selectedUsersObjects[0]?.fullName ||
                selectedUsersObjects[0]?.fullname ||
                selectedUsersObjects[0]?.email ||
                'Assigned'}
            </span>
            {selectedUsersObjects.length > 1 && (
              <span className="shrink-0 text-xs text-muted-foreground">
                +{selectedUsersObjects.length - 1}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Unassigned</span>
        )}
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 rounded-[var(--r-control)] text-xs font-bold uppercase transition-colors outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-muted text-foreground hover:bg-muted justify-between"
          aria-label="Change assignees"
          data-test="ticket-modal-assignees-trigger"
        >
          <span className="flex items-center gap-2 min-w-0 normal-case">
            {selectedUsersObjects.length > 0 ? (
              <>
                <AssigneesAvatar users={selectedUsersObjects.slice(0, 3)} size="sm" />
                <span className="min-w-0 truncate text-foreground font-semibold">
                  {selectedUsersObjects[0]?.fullName ||
                    selectedUsersObjects[0]?.fullname ||
                    selectedUsersObjects[0]?.email ||
                    'Assigned'}
                </span>
              </>
            ) : (
              <>
                <User className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground font-medium whitespace-nowrap">
                  Unassigned
                </span>
              </>
            )}
          </span>

          {selectedUsersObjects.length > 1 ? (
            <span className="shrink-0 inline-flex items-center rounded-full bg-card px-2 py-0.5 text-[10px] font-bold text-muted-foreground border border-border">
              +{selectedUsersObjects.length - 1}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[min(calc(100vw-2rem),18rem)] p-2 z-[110]"
        align="center"
        sideOffset={8}
      >
        <div className="space-y-1">
          <div className="mb-1 flex items-center justify-between border-b border-separator px-2 py-1.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Assign Agents
            </span>
            {selectedAgents.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedAgents([])}
                className="text-[10px] text-[hsl(var(--tone-danger))] hover:underline font-bold"
                data-test="ticket-modal-assignees-clear-button"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
            {users.length > 0 ? (
              users.map((agent) => {
                const isSelected = selectedAgents.includes(agent._id);
                return (
                  <div
                    key={agent._id}
                    onClick={() => {
                      setSelectedAgents((prev) =>
                        isSelected ? prev.filter((id) => id !== agent._id) : [...prev, agent._id]
                      );
                    }}
                    className="flex items-center gap-3 p-2 hover:bg-[hsl(var(--tone-info)/0.5)] rounded-[var(--r-control)] cursor-pointer transition-colors group"
                    data-test={`ticket-modal-assignee-option-${agent._id}`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={null}
                      className="pointer-events-none"
                      data-test={`ticket-modal-assignee-checkbox-${agent._id}`}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-foreground truncate group-hover:text-[hsl(var(--tone-info-fg))]">
                        {agent.fullName || agent.fullname || agent.email}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {agent.email}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-muted-foreground">No users found</div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
