import { format } from 'date-fns';
import { PagePanel } from '@/components/PageShell';
import { useMyInternProfile } from '@/queries/interns';

export function InternSelfServicePanel() {
  const { data: intern, isPending, isError } = useMyInternProfile();

  if (isPending) {
    return (
      <PagePanel className="px-5 py-6 text-sm text-muted-foreground md:px-6">
        Loading internship profile...
      </PagePanel>
    );
  }

  if (isError || !intern) {
    return (
      <PagePanel className="px-5 py-6 text-sm text-destructive md:px-6">
        No internship profile found. Contact your programme admin.
      </PagePanel>
    );
  }

  return (
    <PagePanel className="px-5 py-6 md:px-6">
      <h2 className="text-lg font-semibold text-foreground">Internship programme</h2>
      <p className="mt-1 text-sm text-muted-foreground">Your internship programme details.</p>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-4 rounded-xl border border-border/60 px-4 py-3">
          <dt className="text-muted-foreground">Type</dt>
          <dd className="font-medium text-foreground">{intern.internshipType?.name}</dd>
        </div>
        <div className="flex justify-between gap-4 rounded-xl border border-border/60 px-4 py-3">
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium capitalize text-foreground">{intern.status}</dd>
        </div>
        <div className="flex justify-between gap-4 rounded-xl border border-border/60 px-4 py-3">
          <dt className="text-muted-foreground">Start date</dt>
          <dd className="font-medium text-foreground">
            {intern.startDate ? format(new Date(intern.startDate), 'MMM d, yyyy') : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-4 rounded-xl border border-border/60 px-4 py-3">
          <dt className="text-muted-foreground">Primary mentor</dt>
          <dd className="font-medium text-foreground">{intern.primaryMentor?.fullname || '—'}</dd>
        </div>
        <div className="flex justify-between gap-4 rounded-xl border border-border/60 px-4 py-3 sm:col-span-2">
          <dt className="text-muted-foreground">Secondary mentor</dt>
          <dd className="font-medium text-foreground">{intern.secondaryMentor?.fullname || '—'}</dd>
        </div>
      </dl>
    </PagePanel>
  );
}
