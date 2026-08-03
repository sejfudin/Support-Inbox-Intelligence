import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getAvatarColor } from '@/helpers/avatarColor';
import { getInitials } from '@/helpers/getInitials';
import { DashboardCardHeader } from './DashboardCard';

/**
 * ⚠️ PLACEHOLDER — NOT REAL DATA.
 *
 * "Specialization assigned" does not exist in the data model: there is no
 * specialization field, no assigned-at timestamp, and no assigning action
 * anywhere in the platform. The closest existing shapes are
 * `InternProfile.declaredPosition` (the intern's own declared position) and
 * `InternProfile.secondaryMentor` — neither of which carries the "assigned on
 * <date>" semantics this card shows.
 *
 * The card is rendered from the fixtures below so the layout is settled and
 * reviewable while the feature is specced. Replace `MOCK_ASSIGNMENTS` with a
 * real field on the dashboard payload once the model gains one — the row markup
 * below already matches the intended shape:
 *   { id, intern, specialization, secondaryMentor, assignedAt }
 *
 * One half of `PlacementsSpecializationCard` — the parent card owns the surface.
 */
const MOCK_ASSIGNMENTS = [
  {
    id: 'mock-1',
    intern: 'Maya Chen',
    specialization: 'Frontend',
    secondaryMentor: 'Ana Kovač',
    assignedAt: 'Jul 14',
  },
  {
    id: 'mock-2',
    intern: 'Priya Rao',
    specialization: 'Full-stack',
    secondaryMentor: 'Marko Ilić',
    assignedAt: 'Jul 6',
  },
  {
    id: 'mock-3',
    intern: 'Tom Weber',
    specialization: 'QA',
    secondaryMentor: 'Lejla Hodžić',
    assignedAt: 'Jun 28',
  },
];

export function SpecializationAssignedSection() {
  return (
    <>
      <DashboardCardHeader
        kicker="Specialization assigned"
        action={
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="About this card"
                className="shrink-0 rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-56">
              <p className="text-xs">
                Placeholder content. Specialization assignment is not implemented in the data model
                yet, so these rows are sample data.
              </p>
            </TooltipContent>
          </Tooltip>
        }
      />

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <ul className="-mx-1 space-y-1" aria-describedby="specialization-mock-note">
          {MOCK_ASSIGNMENTS.map((row) => (
            <li key={row.id} className="flex items-center gap-2.5 rounded-xl px-1 py-1.5">
              <span
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${getAvatarColor(row.intern)}`}
                aria-hidden="true"
              >
                {getInitials(row.intern)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold leading-4 text-foreground">
                  {row.intern}
                </span>
                <span className="block truncate text-[11px] leading-4 text-muted-foreground">
                  {row.specialization} · 2nd {row.secondaryMentor}
                </span>
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {row.assignedAt}
              </span>
            </li>
          ))}
        </ul>
        <p
          id="specialization-mock-note"
          className="mt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-600 dark:text-amber-500"
        >
          Sample data — to be implemented
        </p>
      </div>
    </>
  );
}
