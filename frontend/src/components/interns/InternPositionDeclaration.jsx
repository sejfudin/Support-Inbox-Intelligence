import { PagePanel } from '@/components/PageShell';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useMyInternProfile,
  useUpdateMyPosition,
  useUpdateMySecondaryPosition,
} from '@/queries/interns';
import { usePositions } from '@/queries/positions';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const NONE_VALUE = 'none';

// The two positions sit side by side in one row, so the field box is shared
// rather than set per control: at the flat card's 36px both fields line up, and
// the locked specialization state below has to match them exactly or the row
// visibly steps when an intern is specialized.
const FIELD_CLASS = 'h-9 w-full rounded-[var(--r-control)] text-[13px]';

/**
 * `id` is the control the caption labels — omitted when the field renders a
 * read-only value instead of a control, since a `<label for>` pointing at a
 * non-labelable element is dead markup rather than an association.
 */
function PositionField({ id, label, children }) {
  const Caption = id ? 'label' : 'span';

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Caption htmlFor={id} className="text-[11.5px] font-medium text-muted-foreground">
        {label}
      </Caption>
      {children}
    </div>
  );
}

export function InternPositionDeclaration({ className }) {
  const { data: intern, isPending: isLoadingProfile } = useMyInternProfile();
  const { data: positions = [], isPending: isLoadingPositions } = usePositions();
  const { mutate: savePosition, isPending: isSavingMain } = useUpdateMyPosition();
  const { mutate: saveSecondaryPosition, isPending: isSavingSecondary } =
    useUpdateMySecondaryPosition();

  const isLoading = isLoadingProfile || isLoadingPositions;
  const hasPositions = positions.length > 0;

  const mainPositionId = intern?.declaredPosition?._id || '';
  const secondaryPositionId = intern?.secondaryPosition?._id || '';
  const isSpecialized = Boolean(intern?.specializationAssignedAt);

  const handleChange = (positionId) => {
    savePosition(positionId, {
      onSuccess: () => toast.success('Position updated'),
      onError: (err) => toast.error(err?.response?.data?.message || 'Failed to update position'),
    });
  };

  const handleSecondaryChange = (positionId) => {
    saveSecondaryPosition(positionId === NONE_VALUE ? null : positionId, {
      onSuccess: () => toast.success('Secondary position updated'),
      onError: (err) =>
        toast.error(err?.response?.data?.message || 'Failed to update secondary position'),
    });
  };

  const mainOptions = positions.filter((position) => position._id !== secondaryPositionId);
  const secondaryOptions = positions.filter((position) => position._id !== mainPositionId);

  const renderMainControl = () => {
    if (isLoading) {
      return <Skeleton className={FIELD_CLASS} />;
    }

    // A specialization is the admin's call, so the field becomes a read-only value
    // in the same box the select occupied — the chip is what says why it can't be
    // changed. The mentor who owns it is named in the rail beside this card.
    if (isSpecialized) {
      return (
        <div
          aria-disabled="true"
          data-test="position-locked-value"
          className="flex h-9 select-none items-center gap-2 rounded-[var(--r-control)] border border-border bg-muted/40 px-[11px]"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
            {intern?.declaredPosition?.name || '—'}
          </span>
          <span
            data-test="specialization-badge"
            className="app-chip ml-auto shrink-0 bg-primary/10 tracking-[0.04em] text-primary"
          >
            SPECIALIZATION
          </span>
        </div>
      );
    }

    if (!hasPositions) {
      return <p className="text-[12.5px] text-muted-foreground">No positions configured yet.</p>;
    }

    return (
      <Select value={mainPositionId} onValueChange={handleChange} disabled={isSavingMain}>
        <SelectTrigger id="main-position" className={FIELD_CLASS} data-test="position-select">
          <SelectValue placeholder="Select your position" />
        </SelectTrigger>
        <SelectContent>
          {mainOptions.map((position) => (
            <SelectItem key={position._id} value={position._id}>
              {position.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const renderSecondaryControl = () => {
    if (isLoading) {
      return <Skeleton className={FIELD_CLASS} />;
    }

    if (!hasPositions) {
      return <p className="text-[12.5px] text-muted-foreground">No positions configured yet.</p>;
    }

    return (
      <Select
        value={secondaryPositionId || NONE_VALUE}
        onValueChange={handleSecondaryChange}
        disabled={isSavingSecondary}
      >
        <SelectTrigger
          id="secondary-position"
          className={FIELD_CLASS}
          data-test="secondary-position-select"
        >
          <SelectValue placeholder="No secondary position" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE} data-test="secondary-position-option-none">
            No secondary position
          </SelectItem>
          {secondaryOptions.map((position) => (
            <SelectItem key={position._id} value={position._id}>
              {position.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <PagePanel className={cn('px-[18px] pb-[18px] pt-[15px]', className)}>
      <h2 className="app-card-title">Position</h2>
      <p className="mt-[3px] text-[12.5px] leading-[1.45] text-muted-foreground">
        {isSpecialized
          ? 'Your specialization is assigned by your admin. The second interest stays yours to pick.'
          : 'Your main position in the firm, and an optional second interest.'}
      </p>

      <div className="mt-[13px] grid gap-3.5 sm:grid-cols-2">
        <PositionField
          id={isSpecialized ? undefined : 'main-position'}
          label={isSpecialized ? 'Specialization' : 'Main position'}
        >
          {renderMainControl()}
        </PositionField>
        <PositionField id="secondary-position" label="Secondary position">
          {renderSecondaryControl()}
        </PositionField>
      </div>
    </PagePanel>
  );
}
