import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import InvitationInbox from '@/components/InvitationInbox';
import {
  useMyInvitations,
  useAcceptInvitation,
  useDeclineInvitation,
} from '@/queries/invitations';

export default function UserInvitationsPage() {
  const navigate = useNavigate();
  const { refetchUser } = useAuth();
  const [activeInvitationId, setActiveInvitationId] = useState(null);

  const { data: invitations = [], isLoading } = useMyInvitations();
  const acceptInvitation = useAcceptInvitation();
  const declineInvitation = useDeclineInvitation();

  const handleAccept = (invitationId) => {
    setActiveInvitationId(invitationId);
    acceptInvitation.mutate(invitationId, {
      onSuccess: async () => {
        toast.success('Invitation accepted', {
          description: 'You have joined the workspace.',
        });
        await refetchUser();
        navigate('/dashboard');
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to accept invitation.');
        setActiveInvitationId(null);
      },
      onSettled: () => {
        setActiveInvitationId(null);
      },
    });
  };

  const handleDecline = (invitationId) => {
    setActiveInvitationId(invitationId);
    declineInvitation.mutate(invitationId, {
      onSuccess: () => {
        toast.success('Invitation declined');
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to decline invitation.');
      },
      onSettled: () => {
        setActiveInvitationId(null);
      },
    });
  };

  return (
    <div className="app-page">
      <div className="app-page-content space-y-6">
        <div className="app-panel flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <div className="app-kicker mb-3">Workspace</div>
            <h1 className="app-title">Invitations</h1>
            <p className="app-subtitle">
              Review and respond to workspace invitations.
            </p>
          </div>
        </div>

        <div className="app-panel">
          <InvitationInbox
            invitations={invitations}
            isLoading={isLoading}
            onAccept={handleAccept}
            onDecline={handleDecline}
            actionLoadingId={activeInvitationId}
          />
        </div>
      </div>
    </div>
  );
}
