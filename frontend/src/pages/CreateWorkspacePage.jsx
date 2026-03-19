import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Building2, Mail, ShieldCheck, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import InvitationInbox from '@/components/InvitationInbox';
import { useCreateWorkspace } from '@/queries/workspaces';
import { useAuth } from '@/context/AuthContext';
import { useAcceptInvitation, useDeclineInvitation, useMyInvitations } from '@/queries/invitations';

export default function CreateWorkspacePage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [activeInvitationId, setActiveInvitationId] = useState(null);

  const { user, refetchUser, logout } = useAuth();
  const createWorkspace = useCreateWorkspace();
  const { data: invitations = [], isLoading: loadingInvitations } = useMyInvitations();
  const acceptInvitation = useAcceptInvitation();
  const declineInvitation = useDeclineInvitation();
  const navigate = useNavigate();

  if (user?.role !== 'admin') {
    const handleAccept = (invitationId) => {
      setActiveInvitationId(invitationId);
      acceptInvitation.mutate(invitationId, {
        onSuccess: async () => {
          toast.success('Invitation accepted');
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
          toast.success('Invitation ignored');
        },
        onError: (err) => {
          toast.error(err.response?.data?.message || 'Failed to ignore invitation.');
        },
        onSettled: () => {
          setActiveInvitationId(null);
        },
      });
    };

    const hasInvitations = invitations.length > 0;

    return (
      <div className="fixed inset-0 h-screen w-screen overflow-y-auto bg-transparent p-4">
        <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col items-center justify-center py-6 sm:py-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm backdrop-blur">
              <Mail className="h-3.5 w-3.5" />
              Workspace Access
            </div>
            <div className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">
              <span className="text-foreground">Task</span>
              <span className="text-blue-600">Manager</span>
            </div>
          </div>

          {hasInvitations ? (
            <div className="mt-10 grid w-full gap-6 lg:grid-cols-[0.78fr_1.12fr]">
              <Card className="border-white/70 bg-white/92 shadow-[0_24px_60px_-30px_rgba(76,81,191,0.38)]">
                <CardHeader className="space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl text-slate-900">
                      You&apos;re not in a workspace yet
                    </CardTitle>
                    <CardDescription className="mt-2 text-sm leading-6">
                      Review the invitation on the right, accept it, and you&apos;ll be taken straight
                      into your assigned workspace.
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-border/70 bg-secondary/70 p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">How access works</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Invitations are tied to a workspace. Once you accept, your access is activated
                          immediately and the app will take you there.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      'Review the workspace invitation details',
                      'Accept it to unlock access right away',
                      'Ignore it if it is not relevant to you',
                    ].map((step, index) => (
                      <div key={step} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                          {index + 1}
                        </div>
                        <p className="text-sm text-slate-700">{step}</p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={logout}
                      className="text-sm font-medium text-slate-500 hover:text-slate-900 underline underline-offset-4"
                    >
                      Sign out
                    </button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <div className="px-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Pending Invitations
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Accept an invitation below to enter your assigned workspace.
                  </p>
                </div>

                <InvitationInbox
                  invitations={invitations}
                  isLoading={loadingInvitations}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                  actionLoadingId={activeInvitationId}
                />
              </div>
            </div>
          ) : (
            <Card className="mt-10 w-full max-w-3xl overflow-hidden border-white/70 bg-white/92 shadow-[0_28px_70px_-34px_rgba(76,81,191,0.42)]">
              <div className="grid gap-0 md:grid-cols-[1.05fr_0.95fr]">
                <div className="border-b border-slate-100 p-8 md:border-b-0 md:border-r">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-primary/10 text-primary">
                    <Building2 className="h-7 w-7" />
                  </div>

                  <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
                    You&apos;re waiting for workspace access
                  </h1>
                  <p className="mt-4 max-w-lg text-base leading-8 text-slate-600">
                    An admin needs to invite you before you can enter the app. When that happens,
                    your invitation will appear here and you&apos;ll be able to join in one step.
                  </p>

                  <div className="mt-8 rounded-2xl border border-border/70 bg-secondary/70 p-5">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">What to expect</p>
                        <p className="mt-1 text-sm leading-7 text-slate-600">
                          Once an admin assigns you to a workspace, you&apos;ll see the invitation here.
                          Accept it and you&apos;ll go directly into your workspace.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-between p-8">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Current Status
                    </p>
                    <div className="mt-5 rounded-[1.75rem] border border-dashed border-primary/20 bg-primary/5 p-6 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                        <Mail className="h-6 w-6 text-primary/70" />
                      </div>
                      <h2 className="mt-5 text-xl font-semibold text-slate-900">
                        No invitations yet
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        You can sign out and come back later, or contact your admin if you think you
                        should already have access.
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => window.location.reload()}
                    >
                      Refresh Invitations
                    </Button>
                    <button
                      onClick={logout}
                      className="text-sm font-medium text-slate-500 hover:text-slate-900 underline underline-offset-4"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    createWorkspace.mutate(
      { name: name.trim(), description: description.trim() },
      {
        onSuccess: async () => {
          await refetchUser();
          navigate('/admin/workspaces');
        },
        onError: (err) => {
          setError(err.response?.data?.message || 'Failed to create workspace.');
        },
      }
    );
  };

  return (
      <div className="fixed inset-0 h-screen w-screen overflow-y-auto bg-transparent p-4">
      <div className="mx-auto flex min-h-full w-full max-w-6xl items-center justify-center py-6 sm:py-10">
        <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-primary/10 bg-slate-950 text-white shadow-[0_32px_80px_-40px_rgba(35,39,92,0.95)]">
            <CardHeader className="space-y-5">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
                <Sparkles className="h-3.5 w-3.5" />
                Admin Setup
              </div>
              <div>
                <div className="text-3xl font-semibold tracking-tight md:text-4xl">
                  <span className="text-white">Task</span>
                  <span className="text-blue-300">Manager</span>
                </div>
                <CardTitle className="mt-8 text-3xl leading-tight text-white md:text-4xl">
                  Create your first workspace
                </CardTitle>
                <CardDescription className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                  Start with one focused workspace for your team. You can organize tickets, invite
                  people, and manage access from there.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">What you unlock next</p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-slate-200">
                    <Building2 className="h-4 w-4 text-blue-300" />
                    A dedicated workspace for tickets, members, and workflows
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-200">
                    <ShieldCheck className="h-4 w-4 text-blue-300" />
                    Admin controls for inviting users and assigning access
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-200">
                    <ArrowRight className="h-4 w-4 text-blue-300" />
                    A clear starting point for your team to begin collaborating
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white shadow-[0_24px_60px_-30px_rgba(76,81,191,0.38)]">
            <CardHeader className="space-y-3 border-b border-slate-100 pb-6">
              <CardTitle className="text-2xl font-bold text-slate-900 md:text-3xl">
                Workspace Details
              </CardTitle>
              <CardDescription className="text-sm leading-6">
                Choose a strong workspace name and add a short description so teammates understand
                what this space is for.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 md:p-8">
              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  {error}
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-800">
                    Workspace name
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Acme Support Team"
                    required
                    className="h-13 border-slate-300 text-base"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground">
                    This is the main name your team will see across the app.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-800">
                    Description <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="What does this workspace handle?"
                    className="h-13 border-slate-300 text-base"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground">
                    Add a short summary to make this workspace easy to recognize.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">After creation</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    You’ll be taken into the workspace so you can start inviting users and setting up
                    your team.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={createWorkspace.isPending || !name.trim()}
                  className="h-12 w-full text-base font-semibold"
                >
                  {createWorkspace.isPending ? 'Creating workspace...' : 'Create Workspace'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
