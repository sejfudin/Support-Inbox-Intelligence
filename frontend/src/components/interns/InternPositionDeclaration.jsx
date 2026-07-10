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
    <InternPanel className="overflow-hidden p-0">
      <div className="border-b border-border/60 px-5 py-4 md:px-6">
        <h3 className="text-lg font-semibold">My position</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Declare your main position in the firm.
        </p>
      </div>
      <div className="px-5 py-4 md:px-6">
        {positions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No positions configured yet. Check back later.
          </p>
        ) : (
          <Select
            value={intern?.declaredPosition?._id || ''}
            onValueChange={handleChange}
            disabled={isSaving}
          >
            <SelectTrigger className="w-full max-w-sm" data-test="position-select">
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
    </InternPanel>
  );
}
