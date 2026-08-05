import { InternPanel } from '@/components/interns/InternPanel';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';

const NONE_VALUE = 'none';

function PositionRow({ title, description, children }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function PositionControlSkeleton() {
  return <Skeleton className="h-10 w-full sm:w-56" />;
}

export function InternPositionDeclaration() {
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
      return <PositionControlSkeleton />;
    }

    if (isSpecialized) {
      return (
        <div className="w-full sm:w-auto sm:text-right" data-test="position-locked-value">
          <div
            aria-disabled="true"
            className="inline-flex h-10 select-none items-center gap-2 rounded-lg bg-indigo-600/10 px-4 dark:bg-indigo-500/15"
          >
            <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
            <span className="text-sm font-semibold text-foreground">
              {intern?.declaredPosition?.name || '-'}
            </span>
            <Badge
              variant="outline"
              className="pointer-events-none border-none bg-transparent px-0 text-[10px] font-bold tracking-wide text-indigo-700 shadow-none dark:text-indigo-300"
              data-test="specialization-badge"
            >
              SPECIALIZATION
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Mentor: {intern?.secondaryMentor?.fullname || 'Unassigned'}
          </p>
        </div>
      );
    }

    if (!hasPositions) {
      return <p className="text-sm text-muted-foreground">No positions configured yet.</p>;
    }

    return (
      <Select value={mainPositionId} onValueChange={handleChange} disabled={isSavingMain}>
        <SelectTrigger className="w-full sm:w-56" data-test="position-select">
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
      return <PositionControlSkeleton />;
    }

    if (!hasPositions) {
      return <p className="text-sm text-muted-foreground">No positions configured yet.</p>;
    }

    return (
      <Select
        value={secondaryPositionId || NONE_VALUE}
        onValueChange={handleSecondaryChange}
        disabled={isSavingSecondary}
      >
        <SelectTrigger className="w-full sm:w-56" data-test="secondary-position-select">
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
    <InternPanel className="flex flex-col gap-5 px-5 py-5 md:px-6">
      <PositionRow
        title={isSpecialized ? 'Primary position' : 'My position'}
        description={
          isSpecialized
            ? 'Your specialization — assigned by your admin.'
            : 'Your main position in the firm.'
        }
      >
        {renderMainControl()}
      </PositionRow>

      <PositionRow
        title="Secondary position"
        description="Optional — a second position you're also interested in."
      >
        {renderSecondaryControl()}
      </PositionRow>
    </InternPanel>
  );
}
