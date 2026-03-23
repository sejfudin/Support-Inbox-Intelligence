import { Building2, CheckCircle2, Clock3, MailX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function InvitationInbox({
  invitations = [],
  isLoading,
  onAccept,
  onDecline,
  actionLoadingId,
  emptyTitle = 'No pending workspace invitations',
  emptyDescription = 'When an admin invites you to a workspace, it will appear here.',
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} className="border-white/70 bg-white/90">
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-10 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <Card className="border-white/70 bg-white/90">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Clock3 className="h-9 w-9 text-primary/35" />
          <div>
            <p className="text-base font-semibold text-gray-900">{emptyTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {invitations.map((invitation) => {
        const invitationId = invitation._id;
        const workspaceName = invitation.workspace?.name || 'Workspace';
        const inviterName = invitation.invitedBy?.fullname || invitation.invitedBy?.email || 'Admin';
        const isLoadingAction = actionLoadingId === invitationId;

        return (
          <Card key={invitationId} className="overflow-hidden border-white/70 bg-gradient-to-br from-white via-white to-primary/5">
            <CardHeader className="space-y-3 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{workspaceName}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {inviterName} invited you to join as <span className="font-medium text-foreground">{invitation.workspaceRole}</span>
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Pending
                </span>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {invitation.workspace?.description && (
                <p className="rounded-xl border border-border/70 bg-secondary/70 px-4 py-3 text-sm text-slate-600">
                  {invitation.workspace.description}
                </p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  onClick={() => onAccept(invitationId)}
                  disabled={isLoadingAction}
                  className="w-full gap-2 sm:w-auto"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isLoadingAction ? 'Saving...' : 'Accept Invitation'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onDecline(invitationId)}
                  disabled={isLoadingAction}
                  className="w-full gap-2 sm:w-auto"
                >
                  <MailX className="h-4 w-4" />
                  Ignore
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
