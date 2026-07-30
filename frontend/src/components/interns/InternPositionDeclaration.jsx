import { InternPanel } from '@/components/interns/InternPanel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMyInternProfile, useUpdateMyPosition } from '@/queries/interns';
import { usePositions } from '@/queries/positions';
import { toast } from 'sonner';

export function InternPositionDeclaration() {
  const { data: intern } = useMyInternProfile();
  const { data: positions = [] } = usePositions();
  const { mutate: savePosition, isPending: isSaving } = useUpdateMyPosition();

  const handleChange = (positionId) => {
    savePosition(positionId, {
      onSuccess: () => toast.success('Position updated'),
      onError: (err) => toast.error(err?.response?.data?.message || 'Failed to update position'),
    });
  };

  return (
    <InternPanel className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
      <div>
        <h3 className="text-base font-semibold text-foreground">My position</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">Your main position in the firm.</p>
      </div>
      {positions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No positions configured yet.</p>
      ) : (
        <Select
          value={intern?.declaredPosition?._id || ''}
          onValueChange={handleChange}
          disabled={isSaving}
        >
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
    </InternPanel>
  );
}
