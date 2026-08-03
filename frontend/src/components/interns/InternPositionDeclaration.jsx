import { InternPanel } from '@/components/interns/InternPanel';
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

export function InternPositionDeclaration() {
  const { data: intern } = useMyInternProfile();
  const { data: positions = [] } = usePositions();
  const { mutate: savePosition, isPending: isSavingMain } = useUpdateMyPosition();
  const { mutate: saveSecondaryPosition, isPending: isSavingSecondary } =
    useUpdateMySecondaryPosition();

  const mainPositionId = intern?.declaredPosition?._id || '';

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

  const secondaryOptions = positions.filter((position) => position._id !== mainPositionId);

  return (
    <InternPanel className="flex flex-col gap-5 px-5 py-5 md:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">My position</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">Your main position in the firm.</p>
        </div>
        {positions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No positions configured yet.</p>
        ) : (
          <Select value={mainPositionId} onValueChange={handleChange} disabled={isSavingMain}>
            <SelectTrigger className="w-full sm:w-56" data-test="position-select">
              <SelectValue placeholder="Select your position" />
            </SelectTrigger>
            <SelectContent>
              {positions.map((position) => (
                <SelectItem key={position._id} value={position._id}>
                  {position.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {positions.length > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Secondary position</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Optional — a second position you're also interested in.
            </p>
          </div>
          <Select
            value={intern?.secondaryPosition?._id || NONE_VALUE}
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
        </div>
      )}
    </InternPanel>
  );
}
