import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTicket } from "@/queries/tickets";
import { useUsers } from "@/queries/users";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_OPTIONS } from "@/helpers/ticketStatus";
import { useTicketForm } from "@/hooks/useTicketForm";
import { toast } from "sonner";

import { ChevronsUpDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

const NewTickets = ({
  isOpen,
  onClose,
  initialStatus = "to do",
  hideStatus = false,
}) => {
  const createMutation = useCreateTicket();
  const { user } = useAuth();
  const { data: usersData } = useUsers({
    pagination: false,
    workspaceId: user?.workspaceId,
  });
  const users = usersData?.users || [];

  const { form: newTicket, updateField, resetForm } = useTicketForm(initialStatus);

  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);

  const handleCreate = (e) => {
    e.preventDefault();

    const ticketData = {
      ...newTicket,
      assignedTo: Array.isArray(newTicket.assignedTo) ? newTicket.assignedTo : [],
    };

    if (hideStatus) {
      delete ticketData.status;
    }

    createMutation.mutate(ticketData, {
      onSuccess: () => {
        toast.success("Ticket created", {
          description: `"${newTicket.subject}" has been added to the system.`,
        });
        resetForm();
        onClose();
      },
      onError: (error) => {
        toast.error("Failed to create ticket", {
          description: error?.response?.data?.message || "Please check your connection and try again.",
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
      updateField("assignedTo", currentAssignees.filter((id) => id !== userId));
    } else {
      updateField("assignedTo", [...currentAssignees, userId]);
    }
  };

  const getAssigneeLabel = () => {
    if (currentAssignees.length === 0) return "Unassigned";
    if (currentAssignees.length === 1) {
      const user = users.find((u) => u._id === currentAssignees[0]);
      return user?.fullName || user?.fullname || user?.email || "1 Agent";
    }
    return `${currentAssignees.length} Agents Selected`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto p-0">
        <Card className="border-0 shadow-none">
          <DialogHeader className="px-6 pt-6 border-b mb-4">
            <DialogTitle className="text-xl font-bold">
              Create New Ticket
            </DialogTitle>
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

                <div
                  className={`grid grid-cols-1 gap-6 ${hideStatus ? "" : "md:grid-cols-2"}`}
                >
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

                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                      Agent
                    </Label>
                    
                    <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen} modal={true}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button" 
                          variant="outline"
                          role="combobox"
                          aria-expanded={assigneePopoverOpen}
                          className="w-full justify-between h-12 px-3 text-left font-normal"
                        >
                          <span className={currentAssignees.length === 0 ? "text-muted-foreground" : "text-foreground"}>
                             {getAssigneeLabel()}
                          </span>

                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>

                      <PopoverContent 
                        className="w-72 p-2 z-[200]" 
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
                              users.map((user) => {
                                const isSelected = currentAssignees.includes(user._id);
                                return (
                                  <div
                                    key={user._id}
                                    onClick={(e) => handleAgentToggle(user._id, e)}
                                    className="flex items-center gap-3 p-2 hover:bg-blue-50/50 rounded-lg cursor-pointer transition-colors group"
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      className="pointer-events-none" 
                                      onCheckedChange={() => {}}
                                    />
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-sm font-semibold text-gray-700 truncate group-hover:text-blue-700">
                                        {user.fullName || user.fullname || user.email}
                                      </span>
                                      <span className="text-[10px] text-gray-400 truncate">
                                        {user.email}
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
                  onClick={onClose}
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
