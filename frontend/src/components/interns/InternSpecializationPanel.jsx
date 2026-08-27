import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InternOverviewSection } from '@/components/interns/InternOverviewSection';
import { InternPanel } from '@/components/interns/InternPanel';
import { AssignSpecializationModal } from '@/components/interns/specialization/AssignSpecializationModal';
import { ChangeMentorModal } from '@/components/interns/specialization/ChangeMentorModal';
import {
  getSpecializationAction,
  isSpecialized,
  SPECIALIZATION_ACTIONS,
} from '@/helpers/internProfile';

function Field({ label, value }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11.5px] text-muted-foreground">{label}</dt>
      <dd className="text-[12.5px] font-medium text-foreground">{value}</dd>
    </div>
  );
}

// The one place the action enum is read. Kept as a switch so a new action has
// exactly one arm to add and the compiler-less default still resolves.
//
// Every arm renders full-width, and sits under the body rather than beside the
// heading: the rail is ~1/3 of the row, so a header-right button either wraps
// onto its own line anyway or squeezes the title. Assign is the primary look —
// it is the write this card exists for, and on an unspecialized intern it is the
// next step the whole profile waits on. Change mentor stays secondary: the
// decision is already made, and it is an edit, not the step forward.
function renderControl(action, { onAssign, onChangeMentor }) {
  switch (action) {
    case SPECIALIZATION_ACTIONS.CHANGE_MENTOR:
      return (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full rounded-[var(--r-control)] text-[12.5px]"
          onClick={onChangeMentor}
          data-test="profile-change-specialization-mentor-button"
        >
          Change mentor
        </Button>
      );
    case SPECIALIZATION_ACTIONS.ASSIGN:
      return (
        <Button
          type="button"
          size="sm"
          className="w-full gap-1.5 rounded-[var(--r-control)] text-[12.5px]"
          onClick={onAssign}
          data-test="profile-assign-specialization-button"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Assign specialization
        </Button>
      );
    default:
      // Disabled rather than absent: an admin who cannot specialize somebody
      // needs to know it is the missing position blocking them, not that the
      // control lives somewhere else. `span` wrapper because a disabled button
      // fires no pointer events for the tooltip to hang off.
      return (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                className="block w-full"
                data-test="profile-assign-specialization-blocked"
              >
                <Button
                  type="button"
                  size="sm"
                  disabled
                  className="pointer-events-none w-full rounded-[var(--r-control)] text-[12.5px]"
                >
                  Assign specialization
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>This intern has not declared a position yet.</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
  }
}

/**
 * Setting an intern's specialization from their own profile.
 *
 * The Specialization tab stays the place to reassign a position or clear one —
 * both are rare and neither reads as "setting" a specialization. What a profile
 * needs is the two verbs an admin reaches for while looking at one person:
 * assign it, and swap the mentor paired with it.
 *
 * Its own card in the Overview sidebar, above the programme controls: both are
 * admin writes about the placement rather than facts read off the candidate, so
 * they sit together and leave the candidate card to the candidate's own
 * material.
 *
 * Admin-only, and the caller decides that: this panel renders whatever it is
 * given, so `InternProfileView` gates it the same way it gates the CV and
 * documentation controls.
 */
export function InternSpecializationPanel({ intern, className }) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [changeMentorOpen, setChangeMentorOpen] = useState(false);

  // No record, nothing to say about it. The blocked control below asserts the
  // intern declared no position, and that is a claim about data — saying it
  // while the record is absent would be a guess dressed as a fact.
  if (!intern) return null;

  const control = renderControl(getSpecializationAction(intern), {
    onAssign: () => setAssignOpen(true),
    onChangeMentor: () => setChangeMentorOpen(true),
  });

  return (
    <>
      <InternPanel dense className={className}>
        <InternOverviewSection
          title="Specialization"
          description="The position an admin confirmed, and the mentor paired with it."
        >
          {isSpecialized(intern) ? (
            /* One column: the rail is too narrow to pair the two fields without
               either wrapping the mentor name or squeezing both labels. */
            <dl className="space-y-3">
              <Field label="Specialization" value={intern.declaredPosition?.name || '—'} />
              <Field
                label="Specialization mentor"
                value={intern.secondaryMentor?.fullname || '—'}
              />
            </dl>
          ) : (
            <p
              className="text-[12.5px] text-muted-foreground"
              data-test="profile-specialization-empty"
            >
              No specialization assigned yet.
            </p>
          )}
          <div className="pt-1">{control}</div>
        </InternOverviewSection>
      </InternPanel>

      <AssignSpecializationModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        intern={intern}
      />
      <ChangeMentorModal
        open={changeMentorOpen}
        specialization={intern}
        onClose={() => setChangeMentorOpen(false)}
      />
    </>
  );
}
