import { Badge } from './ui/badge';
import { badgeTone } from '@/helpers/badgeTones';

export const RoleBadge = ({ role }) => {
  const r = role.toLowerCase();
  let style = badgeTone('neutral');
  if (r === 'admin') style = badgeTone('indigo');
  if (r === 'user') style = badgeTone('warning');

  return (
    <Badge className={`${style} px-4 py-1 text-xs font-bold uppercase tracking-wider`}>
      {role}
    </Badge>
  );
};
