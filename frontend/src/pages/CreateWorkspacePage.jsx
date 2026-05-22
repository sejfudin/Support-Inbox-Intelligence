import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Building2, Mail, Plus, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  RichTextEditor,
  RichTextEditorContent,
  RichTextEditorToolbar,
} from '@/components/ui/rich-text-editor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import InvitationInbox from '@/components/InvitationInbox';
import { useCreateWorkspace } from '@/queries/workspaces';
import { invalidateWorkspaceScope } from '@/lib/invalidationScopes';
import TicketStatusEditor from '@/components/TicketStatusEditor';
import { DEFAULT_STATUS_DRAFTS } from '@/helpers/ticketStatus';
import { validateStatusDrafts } from '@/helpers/validateStatusDrafts';
import { getApiErrorMessage } from '@/helpers/getApiErrorMessage';
import { useAuth } from '@/context/AuthContext';
import { useAcceptInvitation, useDeclineInvitation, useMyInvitations } from '@/queries/invitations';
import { createCategory } from '@/api/categories';
import { normalizeTemplateForSave } from '@/helpers/ticketDescriptionTemplates';
import {
  WORKSPACE_LOGO_ACCEPT,
  WORKSPACE_LOGO_HELPER_TEXT,
  getWorkspaceLogoValidationError,
} from '@/constants/upload';
import { uploadWorkspaceLogo } from '@/api/workspaces';

const CATEGORY_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];

const createEmptyCategory = () => ({
  id: crypto.randomUUID(),
  name: '',
  color: CATEGORY_COLORS[4],
  descriptionTemplate: '',
});

const TemplateEditor = ({ value, onChange, categoryId }) => (
  <RichTextEditor
    value={value}
    onChange={onChange}
    placeholder="Ticket description template"
    className="mt-3 min-h-40 overflow-hidden rounded-lg bg-card"
  >
    <div className="border-b border-border/60 bg-muted/60 px-3 py-2">
      <RichTextEditorToolbar className="flex-wrap p-0" />
    </div>
    <RichTextEditorContent
      className="min-h-24 p-2"
      data-test={
        categoryId
          ? `create-workspace-category-${categoryId}-template-input`
          : 'create-workspace-template-input'
      }
    />
  </RichTextEditor>
);

export default function CreateWorkspacePage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [statusDrafts, setStatusDrafts] = useState(DEFAULT_STATUS_DRAFTS);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [activeInvitationId, setActiveInvitationId] = useState(null);

  const { user, refetchUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const createWorkspace = useCreateWorkspace();
  const { data: invitations = [], isLoading: loadingInvitations } = useMyInvitations();
  const acceptInvitation = useAcceptInvitation();
  const declineInvitation = useDeclineInvitation();
  const navigate = useNavigate();

  const [logoFile, setLogoFile] = useState(null);

  const validateLogoFile = (file) => {
    const validationError = getWorkspaceLogoValidationError(file);
    if (validationError) {
      setError(validationError);
      return false;
    }
    return true;
  };

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
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground shadow-sm">
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
              <Card className="border-border/50 bg-card shadow-elevated">
                <CardHeader className="space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl text-foreground">
                      You&apos;re not in a workspace yet
                    </CardTitle>
                    <CardDescription className="mt-2 text-sm leading-6">
                      Review the invitation on the right, accept it, and you&apos;ll be taken
                      straight into your assigned workspace.
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-border/70 bg-secondary/70 p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">How access works</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          Invitations are tied to a workspace. Once you accept, your access is
                          activated immediately and the app will take you there.
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
                      <div
                        key={step}
                        className="flex items-center gap-3 rounded-xl border border-border px-4 py-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                          {index + 1}
                        </div>
                        <p className="text-sm text-foreground">{step}</p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={logout}
                      className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
                      data-test="create-workspace-sign-out-link"
                    >
                      Sign out
                    </button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <div className="px-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Pending Invitations
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
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
            <Card className="mt-10 w-full max-w-3xl overflow-hidden border-border/50 bg-card shadow-elevated">
              <div className="grid gap-0 md:grid-cols-[1.05fr_0.95fr]">
                <div className="border-b border-border/60 p-8 md:border-b-0 md:border-r">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-primary/10 text-primary">
                    <Building2 className="h-7 w-7" />
                  </div>

                  <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground">
                    You&apos;re waiting for workspace access
                  </h1>
                  <p className="mt-4 max-w-lg text-base leading-8 text-muted-foreground">
                    An admin needs to invite you before you can enter the app. When that happens,
                    your invitation will appear here and you&apos;ll be able to join in one step.
                  </p>

                  <div className="mt-8 rounded-2xl border border-border/70 bg-secondary/70 p-5">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">What to expect</p>
                        <p className="mt-1 text-sm leading-7 text-muted-foreground">
                          Once an admin assigns you to a workspace, you&apos;ll see the invitation
                          here. Accept it and you&apos;ll go directly into your workspace.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-between p-8">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Current Status
                    </p>
                    <div className="mt-5 rounded-[1.75rem] border border-dashed border-primary/20 bg-primary/5 p-6 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-card shadow-sm">
                        <Mail className="h-6 w-6 text-primary/70" />
                      </div>
                      <h2 className="mt-5 text-xl font-semibold text-foreground">
                        No invitations yet
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
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
                      data-test="create-workspace-refresh-invitations-button"
                    >
                      Refresh Invitations
                    </Button>
                    <button
                      type="button"
                      onClick={logout}
                      className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
                      data-test="create-workspace-sign-out-link"
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

  const updateCategoryDraft = (id, field, value) => {
    setCategories((current) =>
      current.map((category) => (category.id === id ? { ...category, [field]: value } : category))
    );
  };

  const removeCategoryDraft = (id) => {
    setCategories((current) => current.filter((category) => category.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const statusValidation = validateStatusDrafts(statusDrafts);
    if (!statusValidation.valid) {
      setError(statusValidation.message);
      return;
    }

    if (logoFile && !validateLogoFile(logoFile)) return;

    const validCategories = categories
      .map((category) => ({
        name: category.name.trim(),
        color: category.color,
        descriptionTemplate: normalizeTemplateForSave(category.descriptionTemplate),
      }))
      .filter((category) => category.name);

    try {
      const workspace = await createWorkspace.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        statuses: statusDrafts,
      });
      const workspaceId = workspace?._id || workspace?.id || workspace?.data?._id;

      if (workspaceId && validCategories.length > 0) {
        try {
          await Promise.all(
            validCategories.map((category) => createCategory({ ...category, workspaceId }))
          );
        } catch {
          toast.error('Workspace created, but some categories could not be added.');
        }
      }

      if (logoFile && workspaceId) {
        try {
          await uploadWorkspaceLogo(workspaceId, logoFile);
          invalidateWorkspaceScope(queryClient, workspaceId);
        } catch (uploadErr) {
          toast.error(
            uploadErr?.response?.data?.message || 'Workspace created, but logo upload failed.'
          );
        }
      }

      await refetchUser();
      navigate('/admin/workspaces');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to create workspace.'));
    }
  };

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-y-auto bg-transparent p-4">
      <div className="mx-auto flex min-h-full w-full max-w-6xl items-center justify-center py-6 sm:py-10">
        <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-primary/10 bg-foreground text-background shadow-elevated">
            <CardHeader className="space-y-5">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-background/80">
                <Sparkles className="h-3.5 w-3.5" />
                Admin Setup
              </div>
              <div>
                <div className="text-3xl font-semibold tracking-tight md:text-4xl">
                  <span className="text-background">Task</span>
                  <span className="text-blue-300">Manager</span>
                </div>
                <CardTitle className="mt-8 text-3xl leading-tight text-background md:text-4xl">
                  Create your first workspace
                </CardTitle>
                <CardDescription className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                  Start with one focused workspace for your team. You can organize tickets, invite
                  people, and manage access from there.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-4">
                <p className="text-sm font-semibold text-background">What you unlock next</p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4 text-blue-300" />A dedicated workspace for
                    tickets, members, and workflows
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-blue-300" />
                    Admin controls for inviting users and assigning access
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <ArrowRight className="h-4 w-4 text-blue-300" />A clear starting point for your
                    team to begin collaborating
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card shadow-elevated">
            <CardHeader className="space-y-3 border-b border-border/60 pb-6">
              <CardTitle className="text-2xl font-bold text-foreground md:text-3xl">
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
                  <label
                    htmlFor="create-workspace-name"
                    className="text-sm font-semibold text-foreground"
                  >
                    Workspace name
                  </label>
                  <Input
                    id="create-workspace-name"
                    type="text"
                    placeholder="e.g. Acme Support Team"
                    required
                    className="h-13 border-border text-base"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    data-test="create-workspace-name-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    This is the main name your team will see across the app.
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="create-workspace-description"
                    className="text-sm font-semibold text-foreground"
                  >
                    Description{' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    id="create-workspace-description"
                    type="text"
                    placeholder="What does this workspace handle?"
                    className="h-13 border-border text-base"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                    data-test="create-workspace-description-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Add a short summary to make this workspace easy to recognize.
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="create-workspace-logo"
                    className="text-sm font-semibold text-foreground"
                  >
                    Workspace logo{' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    id="create-workspace-logo"
                    type="file"
                    accept={WORKSPACE_LOGO_ACCEPT}
                    data-test="create-workspace-logo-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (!file) {
                        setLogoFile(null);
                        return;
                      }
                      if (!validateLogoFile(file)) {
                        e.target.value = '';
                        setLogoFile(null);
                        return;
                      }
                      setLogoFile(file);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">{WORKSPACE_LOGO_HELPER_TEXT}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Ticket statuses</label>
                  <p className="text-xs text-muted-foreground">
                    Choose and order the workflow columns for this workspace.
                  </p>
                  <TicketStatusEditor
                    items={statusDrafts}
                    onChange={setStatusDrafts}
                    dataTestPrefix="create-workspace"
                  />
                </div>

                <div className="rounded-2xl border border-border bg-muted p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Initial categories</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Add custom categories and optional description templates for new tickets.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCategories((current) => [...current, createEmptyCategory()])
                      }
                      data-test="create-workspace-category-add-button"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>

                  {categories.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {categories.map((category, index) => (
                        <div
                          key={category.id}
                          className="rounded-xl border border-border bg-card p-3"
                        >
                          <div className="flex items-start gap-2">
                            <Input
                              id={`create-workspace-category-${category.id}-name`}
                              value={category.name}
                              onChange={(e) =>
                                updateCategoryDraft(category.id, 'name', e.target.value)
                              }
                              placeholder={`Category ${index + 1}`}
                              className="h-10 border-border"
                              maxLength={50}
                              data-test={`create-workspace-category-${category.id}-name-input`}
                            />
                            <div className="flex h-10 shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2">
                              {CATEGORY_COLORS.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => updateCategoryDraft(category.id, 'color', color)}
                                  className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                                  style={{
                                    backgroundColor: color,
                                    borderColor:
                                      category.color === color ? '#1e293b' : 'transparent',
                                  }}
                                  aria-label={`Use ${color}`}
                                  data-test={`create-workspace-category-${category.id}-color-${color.replace('#', '')}-button`}
                                />
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCategoryDraft(category.id)}
                              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                              aria-label="Remove category"
                              data-test={`create-workspace-category-${category.id}-remove-button`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <TemplateEditor
                            value={category.descriptionTemplate}
                            onChange={(html) =>
                              updateCategoryDraft(category.id, 'descriptionTemplate', html)
                            }
                            categoryId={category.id}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={createWorkspace.isPending || !name.trim()}
                  className="h-12 w-full text-base font-semibold"
                  data-test="create-workspace-submit-button"
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
