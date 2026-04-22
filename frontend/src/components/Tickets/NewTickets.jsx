import { useState } from "react";
import { useCreateTicket } from "@/queries/tickets";
import { useAiTicketSuggestion } from "@/hooks/useAiTicketSuggestion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUsers } from "@/queries/users";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_OPTIONS } from "@/helpers/ticketStatus";
import { PRIORITY_OPTIONS } from "@/helpers/ticketPriority";
import {
  STORY_POINTS_OPTIONS,
  getStoryPointsStyle,
  normalizeStoryPoints,
} from "@/helpers/storyPoints";
import { useTicketForm } from "@/hooks/useTicketForm";
import { toast } from "sonner";
import { ChevronsUpDown, Sparkles } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const NewTickets = ({
  isOpen,
  onClose,
  initialStatus = "to do",
  hideStatus = false,
  workspaceId: previewWorkspaceId,
}) => {
  const createMutation = useCreateTicket();
  const { user } = useAuth();

  const effectiveWorkspaceId = previewWorkspaceId || user?.workspaceId;
  const { data: usersData } = useUsers({
    pagination: false,
    workspaceId: effectiveWorkspaceId,
  });
  const users = usersData?.users || [];

  const { form: newTicket, updateField, resetForm } = useTicketForm(initialStatus);

  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
  const [priorityLockedByUser, setPriorityLockedByUser] = useState(false);
  const [storyPointsLockedByUser, setStoryPointsLockedByUser] = useState(false);

  const normalizedStoryPoints = normalizeStoryPoints(newTicket.storyPoints);
  const storyPointsStyle = getStoryPointsStyle(normalizedStoryPoints);
  const storyPointsLabel =
    normalizedStoryPoints === null ? "No estimate" : `SP ${normalizedStoryPoints}`;

  const {
    hasSuggestibleInput,
    isSuggesting,
    requestManualSuggestion,
    resetSuggestionState: resetAiSuggestionState,
  } = useAiTicketSuggestion({
    isOpen,
    subject: newTicket.subject,
    description: newTicket.description,
    priorityLockedByUser,
    storyPointsLockedByUser,
    updateField,
  });

  const resetSuggestionState = () => {
    setPriorityLockedByUser(false);
    setStoryPointsLockedByUser(false);
    resetAiSuggestionState();
  };

  const handleUseAiSuggestion = () => {
    if (!hasSuggestibleInput || isSuggesting) return;

    setPriorityLockedByUser(false);
    setStoryPointsLockedByUser(false);

    requestManualSuggestion();
  };

  const handleDialogOpenChange = (open) => {
    if (open) return;
    resetSuggestionState();
    onClose();
  };


  const handleCreate = (e) => {
    e.preventDefault();

    const ticketData = {
      ...newTicket,
      assignedTo: Array.isArray(newTicket.assignedTo)
        ? newTicket.assignedTo
        : [],
      workspaceId: effectiveWorkspaceId,
    };

    if (hideStatus) {
      delete ticketData.status;
    }

    if (ticketData.dueDate) {
      ticketData.dueDate = new Date(`${ticketData.dueDate}T12:00:00`).toISOString();
    } else {
      delete ticketData.dueDate;
    }

    createMutation.mutate(ticketData, {
      onSuccess: () => {
        toast.success("Ticket created", {
          description: `"${newTicket.subject}" has been added to the system.`,
        });
        resetForm();
        resetSuggestionState();
        onClose();
      },
      onError: (error) => {
        toast.error("Failed to create ticket", {
          description:
            error?.response?.data?.message ||
            "Please check your connection and try again.",
        });
      },
    });
  };

  const currentAssignees = Array.isArray(newTicket.assignedTo)
    ? newTicket.assignedTo
    : [];

  const handleAgentToggle = (userId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (currentAssignees.includes(userId)) {
      updateField(
        "assignedTo",
        currentAssignees.filter((id) => id !== userId),
      );
    } else {
      updateField("assignedTo", [...currentAssignees, userId]);
    }
  };

  const getAssigneeLabel = () => {
    if (currentAssignees.length === 0) return "Unassigned";
    if (currentAssignees.length === 1) {
      const selectedUser = users.find((u) => u._id === currentAssignees[0]);
      return (
        selectedUser?.fullName ||
        selectedUser?.fullname ||
        selectedUser?.email ||
        "1 Agent"
      );
    }
    return `${currentAssignees.length} Agents Selected`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto p-0">
        <Card className="border-0 shadow-none">
          <DialogHeader className="px-6 pt-6 border-b mb-4">
            <DialogTitle className="text-xl font-bold">Create New Ticket</DialogTitle>
            <DialogDescription className="sr-only">
              Fill in the form below to create a new ticket.
            </DialogDescription>
          </DialogHeader>

          <CardContent className="px-6 pb-6">
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Subject
                  </Label>
                  <Input
                    placeholder="e.g. Technical problem with registration"
                    value={newTicket.subject}
                    onChange={(e) => updateField("subject", e.target.value)}
                    className="h-12 text-base"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Description
                  </Label>
                  <Textarea
                    placeholder="Describe the issue..."
                    value={newTicket.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    className="min-h-[120px] text-base"
                    required
                  />
                </div>

                <div className="space-y-6">
                  <div className={`grid grid-cols-1 gap-6 ${hideStatus ? "" : "md:grid-cols-2"}`}>
                    {!hideStatus && (
                      <div className="space-y-2">
                        <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                          Status
                        </Label>
                        <Select
                          value={newTicket.status}
                          onValueChange={(value) => updateField("status", value)}
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="relative space-y-2">
                      <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide pr-8">
                        Priority
                      </Label>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleUseAiSuggestion}
                        disabled={!hasSuggestibleInput || isSuggesting}
                        className="absolute -right-1 -top-2 h-7 w-7 p-0 text-slate-500 hover:text-slate-700 [&_svg]:size-5"
                        aria-label="Regenerate AI suggestion"
                        title="Regenerate AI suggestion"
                      >
                        <Sparkles className={isSuggesting ? "animate-pulse" : ""} />
                      </Button>

                      <Select
                        value={newTicket.priority}
                        onValueChange={(value) => {
                          setPriorityLockedByUser(true);
                          updateField("priority", value);
                        }}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map((priority) => (
                            <SelectItem key={priority.value} value={priority.value}>
                              {priority.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                        Due date{" "}
                        <span className="font-normal normal-case text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        type="date"
                        value={newTicket.dueDate}
                        onChange={(e) => updateField("dueDate", e.target.value)}
                        className="h-12 text-base w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                        Story points
                      </Label>
                      <Select
                        value={
                          normalizedStoryPoints === null
                            ? "none"
                            : String(normalizedStoryPoints)
                        }
                        onValueChange={(value) => {
                          setStoryPointsLockedByUser(true);
                          updateField(
                            "storyPoints",
                            value === "none" ? null : Number(value),
                          );
                        }}
                      >
                        <SelectTrigger className="h-12">
                          <span
                            className={cn(
                              "inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-bold uppercase",
                              storyPointsStyle.indicator,
                            )}
                          >
                            <span
                              className={cn("h-2 w-2 rounded-full", storyPointsStyle.dot)}
                            />
                            {storyPointsLabel}
                          </span>
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="none">
                            <span className="inline-flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-gray-400" />
                              No estimate
                            </span>
                          </SelectItem>

                          {STORY_POINTS_OPTIONS.map((option) => {
                            const optionStyle = getStoryPointsStyle(option.value);

                            return (
                              <SelectItem key={option.value} value={String(option.value)}>
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-2 rounded-md border px-2 py-0.5 text-xs font-bold uppercase",
                                    optionStyle.indicator,
                                  )}
                                >
                                  <span
                                    className={cn("h-2 w-2 rounded-full", optionStyle.dot)}
                                  />
                                  {`SP ${option.label}`}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Agent
                  </Label>

                  <Popover
                    open={assigneePopoverOpen}
                    onOpenChange={setAssigneePopoverOpen}
                    modal
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={assigneePopoverOpen}
                        className="w-full justify-between h-12 px-3 text-left font-normal"
                      >
                        <span
                          className={
                            currentAssignees.length === 0
                              ? "text-muted-foreground"
                              : "text-foreground"
                          }
                        >
                          {getAssigneeLabel()}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-2 z-[200]"
                      align="start"
                      onWheel={(e) => e.stopPropagation()}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-100 mb-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            Assign Agents
                          </span>
                          {currentAssignees.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                updateField("assignedTo", []);
                              }}
                              className="text-[10px] text-red-500 hover:underline font-bold"
                            >
                              Clear all
                            </button>
                          )}
                        </div>

                        <div className="max-h-[250px] overflow-y-auto">
                          {users.length > 0 ? (
                            users.map((listUser) => {
                              const isSelected = currentAssignees.includes(listUser._id);

                              return (
                                <div
                                  key={listUser._id}
                                  onClick={(e) => handleAgentToggle(listUser._id, e)}
                                  className="flex items-center gap-3 p-2 hover:bg-blue-50/50 rounded-lg cursor-pointer transition-colors group"
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    className="pointer-events-none"
                                    onCheckedChange={() => {}}
                                  />
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-semibold text-gray-700 truncate group-hover:text-blue-700">
                                      {listUser.fullName ||
                                        listUser.fullname ||
                                        listUser.email}
                                    </span>
                                    <span className="text-[10px] text-gray-400 truncate">
                                      {listUser.email}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="p-4 text-center text-xs text-gray-400">
                              No users found
                            </div>
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create Ticket"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default NewTickets;
