import { format } from 'date-fns';
import { ProfileMetaCard } from '@/components/profile/ProfileMetaCard';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import { useMyInternProfile } from '@/queries/interns';
import PanelBodySkeleton from '@/components/Skeletons/PanelBodySkeleton';
import { LoadingOverlay, useLoaderHold } from '@/components/ui/loader';

/**
 * The intern's own view of their programme, in the profile page's right-hand
 * column. Read-only by design — every field on it is mentor- or admin-owned.
 *
 * The hub is read off the intern profile's own populated user rather than the
 * signed-in viewer: this card is the programme record, and it should say what
 * that record says.
 */
export function InternSelfServicePanel() {
  const { data: intern, isPending: isPendingRaw, isError } = useMyInternProfile();
  // Global hold: keeps the mark up for MIN_VISIBLE_MS once it appears, and until the data is in.
  const isPending = useLoaderHold(isPendingRaw, { release: isError });

  if (isPending) {
    return (
      <section className="app-card px-[18px] py-[15px]">
        <LoadingOverlay size="sm" label="Loading profile">
          <PanelBodySkeleton rows={4} className="pt-0" />
        </LoadingOverlay>
      </section>
    );
  }

  if (isError || !intern) {
    return (
      <section className="app-card px-[18px] py-[15px] text-[12.5px] text-[hsl(var(--tone-danger-fg))]">
        No internship profile found. Contact your programme admin.
      </section>
    );
  }

  const rows = [
    { label: 'Type', value: intern.internshipType?.name },
    { label: 'Status', value: capitalizeFirst(intern.status || '') || null },
    {
      label: 'Start date',
      value: intern.startDate ? format(new Date(intern.startDate), 'MMM d, yyyy') : null,
    },
    { label: 'Hub', value: intern.user?.hub?.name },
    { label: 'Primary mentor', value: intern.primaryMentor?.fullname },
    { label: 'Secondary mentor', value: intern.secondaryMentor?.fullname },
  ];

  return (
    <ProfileMetaCard
      title="Internship programme"
      description="Managed by your mentor — read-only here."
      rows={rows}
      dataTest="profile-internship-panel"
    />
  );
}
