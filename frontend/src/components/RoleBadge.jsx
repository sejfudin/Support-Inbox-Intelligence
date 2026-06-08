import { Badge } from './ui/badge';
import { badgeTone } from '@/helpers/badgeTones';
import { getRoleLabel } from '@/helpers/roles';

const ROLE_TONE = {
  admin: 'indigo',
  mentor: 'violet',
  intern: 'cyan',
  leadership: 'warning',
};

export const RoleBadge = ({ role }) => {
  const slug = role?.toLowerCase() ?? '';
  const tone = ROLE_TONE[slug] ?? 'neutral';

  return (
    <Badge className={`${badgeTone(tone)} px-4 py-1 text-xs font-bold uppercase tracking-wider`}>
      {getRoleLabel(slug)}
    </Badge>
  );
};
