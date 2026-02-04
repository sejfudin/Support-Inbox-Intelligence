import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTicket } from "@/queries/tickets";
import { useUsers } from "@/queries/users";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_OPTIONS } from "@/helpers/ticketStatus";
import { useTicketForm } from "@/hooks/useTicketForm";

const NewTickets = ({ isOpen, onClose, initialStatus = "to do" }) => {
  const createMutation = useCreateTicket();
  const { data: users, isLoading: usersLoading } = useUsers();

  const { form: newTicket, updateField, resetForm } = useTicketForm(initialStatus);

  const handleCreate = (e) => {
    e.preventDefault();

    const ticketData = {
      ...newTicket,
      assignedTo:
        newTicket.assignedTo === "unassigned" ? [] : [newTicket.assignedTo],
    };

    createMutation.mutate(ticketData, {
      onSuccess: () => {
        resetForm();
        onClose();
      },
      onError: (error) => {
        console.error("Mutation error:", error);
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto p-0">
        <Card className="border-0 shadow-none">
          <DialogHeader className="px-6 pt-6 border-b mb-4">
            <DialogTitle className="text-xl font-bold">
              Create New Ticket
            </DialogTitle>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                      Agent
                    </Label>
                    <Select
                      value={newTicket.assignedTo}
                      onValueChange={(value) => updateField("assignedTo", value)}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {!usersLoading &&
                          users?.map((user) => (
                            <SelectItem key={user._id} value={user._id}>
                              {user.fullname || user.email}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
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
