import { Badge } from './ui/badge';
import { badgeTone } from '@/helpers/badgeTones';

export const UserStatusBadge = ({ status }) => {
  const s = status.toString().toLowerCase();
  const style = s === 'active' ? badgeTone('success') : badgeTone('neutral');

  return (
    <Badge
      className={`${style} px-4 py-1 text-xs font-bold uppercase tracking-wider`}
    >
      {status}
    </Badge>
  );
};
