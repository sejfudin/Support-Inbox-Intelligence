import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InternOverviewSection } from '@/components/interns/InternOverviewSection';
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
function renderControl(action, { onAssign, onChangeMentor }) {
  switch (action) {
    case SPECIALIZATION_ACTIONS.CHANGE_MENTOR:
      return (
        <Button
          type="button"
          variant="outline"
          size="sm"
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
          variant="outline"
          size="sm"
          onClick={onAssign}
          data-test="profile-assign-specialization-button"
        >
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
              <span tabIndex={0} data-test="profile-assign-specialization-blocked">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  className="pointer-events-none"
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
      <InternOverviewSection
        title="Specialization"
        description="The position an admin confirmed, and the mentor paired with it."
        action={control}
        className={className}
      >
        {isSpecialized(intern) ? (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Specialization" value={intern.declaredPosition?.name || '—'} />
            <Field label="Specialization mentor" value={intern.secondaryMentor?.fullname || '—'} />
          </dl>
        ) : (
          <p
            className="text-[12.5px] text-muted-foreground"
            data-test="profile-specialization-empty"
          >
            No specialization assigned yet.
          </p>
        )}
      </InternOverviewSection>

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
