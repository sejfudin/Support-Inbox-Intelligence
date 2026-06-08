import {
  Briefcase,
  GraduationCap,
  LineChart,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROLES, getRoleLabel } from '@/helpers/roles';
import {
  isInternRole,
  skipsWorkspaceSelection,
  showsWorkspaceSelection,
} from '@/helpers/registerForm';

const ROLE_ICONS = {
  [ROLES.ADMIN]: ShieldCheck,
  [ROLES.MENTOR]: Users,
  [ROLES.INTERN]: GraduationCap,
  [ROLES.LEADERSHIP]: LineChart,
};

function GuideBlock({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{children}</p>
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({ icon: Icon, children }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}

export function RegisterRoleGuide({ role }) {
  const Icon = ROLE_ICONS[role] || Sparkles;
  const roleLabel = role ? getRoleLabel(role) : null;

  return (
    <>
      <CardHeader className="space-y-5">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          <UserPlus className="h-3.5 w-3.5" />
          Admin action
        </div>
        <div className="text-3xl font-semibold tracking-tight md:text-4xl">
          <span className="text-foreground">Task</span>
          <span className="text-primary">Manager</span>
        </div>
        <div>
          <CardTitle className="text-2xl leading-tight text-foreground md:text-3xl">
            {roleLabel ? `Creating a ${roleLabel}` : 'Create a new user'}
          </CardTitle>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            {role === ROLES.ADMIN &&
              'Admins get full platform access. Assign a hub; workspace selection is not needed.'}
            {role === ROLES.LEADERSHIP &&
              'Leadership users see dashboards and intern profiles. They do not use task manager workspaces.'}
            {role === ROLES.MENTOR &&
              'Mentors guide interns and use the task manager. Hub is required; workspace is optional.'}
            {isInternRole(role) &&
              'Interns need a hub, programme track, start date, and a primary mentor from the same hub.'}
            {!role &&
              'Pick a role in the form to see which fields apply. Every employee needs an office hub.'}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {role && (
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground">
            <Icon className="h-3.5 w-3.5 text-primary" />
            {roleLabel} selected
          </div>
        )}

        {role === ROLES.ADMIN && (
          <GuideBlock icon={ShieldCheck} title="Admin access">
            Full control over users, platform settings, interns, and workspaces. No workspace
            assignment at account creation.
          </GuideBlock>
        )}

        {role === ROLES.LEADERSHIP && (
          <GuideBlock icon={LineChart} title="Leadership access">
            Read-only dashboards and candidate visibility for TA and workforce stakeholders. No task
            manager workspaces.
          </GuideBlock>
        )}

        {role === ROLES.MENTOR && (
          <GuideBlock icon={Users} title="Mentor access">
            Manage assigned interns, add private comments, and work in project workspaces. Workspace
            invitation can be added now or later.
          </GuideBlock>
        )}

        {isInternRole(role) && (
          <GuideBlock icon={GraduationCap} title="Intern onboarding">
            Programme type, start date, and mentors are saved with the account. An optional secondary
            mentor can cover DS, ML, QA, or other tracks.
          </GuideBlock>
        )}

        <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Required at creation
          </p>
          <ul className="mt-3 space-y-2">
            <ChecklistItem icon={Briefcase}>Office hub for every employee</ChecklistItem>
            {isInternRole(role) && (
              <>
                <ChecklistItem icon={GraduationCap}>
                  Internship type and start date
                </ChecklistItem>
                <ChecklistItem icon={Users}>Primary mentor from the intern&apos;s hub</ChecklistItem>
              </>
            )}
            {showsWorkspaceSelection(role) && (
              <ChecklistItem icon={Sparkles}>Workspace invitation is optional</ChecklistItem>
            )}
            {skipsWorkspaceSelection(role) && (
              <ChecklistItem icon={ShieldCheck}>No workspace assignment for this role</ChecklistItem>
            )}
          </ul>
        </div>

        <GuideBlock icon={Sparkles} title="Password setup">
          The user activates their account from the login screen by choosing Set password and
          entering their company email.
        </GuideBlock>
      </CardContent>
    </>
  );
}
