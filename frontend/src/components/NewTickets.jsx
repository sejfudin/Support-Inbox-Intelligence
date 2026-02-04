import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTicket } from "@/queries/tickets";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NewTickets = ({ onClose }) => {
  const createMutation = useCreateTicket();

  const [newTicket, setNewTicket] = useState({
    subject: "",
    description: "",
    status: "to_do",
    agent: "unassigned",
  });

  const handleCreate = (e) => {
    e.preventDefault();

    createMutation.mutate(newTicket, {
      onSuccess: () => {
        onClose();
      },
      onError: (error) => {
        console.error("Mutation error:", error);
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <Card className="border-0 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between border-b mb-4">
            <CardTitle className="text-xl font-bold">
              Create New Ticket
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Subject
                  </Label>
                  <Input
                    placeholder="e.g. Technical problem with registration"
                    value={newTicket.subject}
                    onChange={(e) =>
                      setNewTicket({ ...newTicket, subject: e.target.value })
                    }
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
                    onChange={(e) =>
                      setNewTicket({
                        ...newTicket,
                        description: e.target.value,
                      })
                    }
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
                      onValueChange={(value) =>
                        setNewTicket({ ...newTicket, status: value })
                      }
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="to_do">To Do</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="on_staging">On Staging</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                      Agent
                    </Label>
                    <Select
                      value={newTicket.agent}
                      onValueChange={(value) =>
                        setNewTicket({ ...newTicket, agent: value })
                      }
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        <SelectItem value="agent_1">Agent Smith</SelectItem>
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
      </div>
    </div>
  );
};

export default NewTickets;
