import { Badge } from './ui/badge';
import { badgeTone } from '@/helpers/badgeTones';
import { cn } from '@/lib/utils';

/**
 * The user status enum is `active | invited | disabled` (`server/models/User.js`);
 * the reference-data panels pass a plain `active`/`inactive` flag instead. Labels
 * live here because a DB value is not a label — `disabled` reads as "Deactivated"
 * to an admin, and that word is the mockup's.
 */
const STATUS = {
  active: { label: 'Active', tone: 'success' },
  invited: { label: 'Invited', tone: 'warning' },
  disabled: { label: 'Deactivated', tone: 'neutral' },
  inactive: { label: 'Inactive', tone: 'neutral' },
};

/** One look, sentence case — see `RoleBadge` for why the uppercase pill went. */
export const UserStatusBadge = ({ status, className }) => {
  const slug = status?.toString().toLowerCase() ?? '';
  const { label, tone } = STATUS[slug] ?? { label: status, tone: 'neutral' };

  return <Badge className={cn(badgeTone(tone), 'border-0', className)}>{label}</Badge>;
};
