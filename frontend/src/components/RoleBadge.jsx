import { Badge } from './ui/badge';
import { badgeTone } from '@/helpers/badgeTones';
import { getRoleLabel } from '@/helpers/roles';
import { cn } from '@/lib/utils';

const ROLE_TONE = {
  admin: 'indigo',
  mentor: 'violet',
  intern: 'cyan',
  leadership: 'warning',
};

/**
 * One look, sentence case. There used to be two — a `flat` chip and an uppercase
 * bordered pill (`ADMIN`) that the users table and the profile page rendered.
 * Uppercase is spoken for by page eyebrows and table column heads, so an
 * uppercase badge in a row reads as a column head that wandered in; the pill
 * shape is spoken for by meters and toggles. `Badge` now carries both decisions
 * in its base, which is why nothing but the tone is passed here.
 *
 * The hue per role is deliberately NOT the mockup's: this badge is the app's one
 * source of role colour, and picking different hues on the users table than on
 * the profile page would make the same role two colours.
 */
export const RoleBadge = ({ role, className }) => {
  const slug = role?.toLowerCase() ?? '';
  const tone = ROLE_TONE[slug] ?? 'neutral';

  return <Badge className={cn(badgeTone(tone), 'border-0', className)}>{getRoleLabel(slug)}</Badge>;
};
