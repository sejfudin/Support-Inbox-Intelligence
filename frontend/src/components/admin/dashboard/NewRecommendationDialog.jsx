import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  RecommendationFormModal,
  RecommendationDuplicateWarnDialog,
} from '@/components/interns/recommendations/RecommendationModals';
import {
  activeRecommendationsOnOtherProjects,
  isRecommendBlockedByProfileStatus,
  recommendBlockedReason,
  recommendationProjectName,
  RECOMMENDATION_STATUSES,
} from '@/helpers/recommendations';
import { useIntern } from '@/queries/interns';
import { usePositions } from '@/queries/positions';
import { useProjects } from '@/queries/projects';
import { useTechnologies } from '@/queries/technologies';
import { useCreateRecommendation, useRecommendations } from '@/queries/recommendations';

const todayInputDate = () => format(new Date(), 'yyyy-MM-dd');

const createEmptyForm = () => ({
  positionId: '',
  projectId: '',
  technologyIds: [],
  recommendationNote: '',
  status: 'recommended',
  resultOutcome: 'none',
  resultNote: '',
  // Never editable here — a new recommendation starts at Recommended, so the
  // placement-outcome section (and with it the start date) stays hidden. Present
  // only to keep the form shape identical to the panel's, which the shared modal
  // reads from.
  startDate: '',
  statusDates: { recommended: todayInputDate(), interviewing: '', resulted: '' },
  interviewingSkipped: false,
});

/**
 * "Recommend intern" from the dashboard, without leaving the dashboard.
 *
 * Renders the SAME `RecommendationFormModal` the intern's own profile uses, so the
 * form, its stage locking and its validation messages stay identical — only the
 * surrounding orchestration lives here, and only the create half of it: a new
 * recommendation always starts at Recommended, so there is no stage-date ordering
 * to police and no outcome to carry, which is most of what the profile panel's
 * version deals with.
 *
 * `InternRecommendationsPanel` remains the canonical create+edit flow. If the
 * create rules change, both need it — they are intentionally kept side by side
 * rather than one calling into the other, because the panel's copy is entangled
 * with editing an existing record.
 */
export function NewRecommendationDialog({ internUserId, open, onClose }) {
  const { data: intern } = useIntern(internUserId, { enabled: Boolean(internUserId) });
  const { data: positions = [] } = usePositions();
  const { data: projects = [] } = useProjects();
  const { data: technologies = [] } = useTechnologies();
  const { data } = useRecommendations(
    { internUserId, limit: 50 },
    { enabled: Boolean(internUserId) }
  );
  const { mutate: createRecommendation, isPending: isSaving } = useCreateRecommendation();

  const [form, setForm] = useState(createEmptyForm);
  const [duplicateWarn, setDuplicateWarn] = useState(null);

  const recommendations = data?.recommendations ?? [];
  const internName = intern?.user?.fullname || 'this intern';
  const blocked = isRecommendBlockedByProfileStatus(intern?.status);

  // Each open starts from a clean form — the dialog is reused for whoever the
  // picker lands on next, and carrying the previous intern's draft over would be
  // a quiet way to file the wrong recommendation.
  useEffect(() => {
    if (open) {
      setForm(createEmptyForm());
      setDuplicateWarn(null);
    }
  }, [open, internUserId]);

  const close = () => {
    setDuplicateWarn(null);
    onClose();
  };

  const save = (payload) => {
    createRecommendation(payload, {
      onSuccess: () => {
        toast.success(`Recommendation created for ${internName}`);
        setDuplicateWarn(null);
        setForm(createEmptyForm());
        onClose();
      },
      onError: (err) =>
        toast.error(err?.response?.data?.message || 'Failed to save recommendation'),
    });
  };

  const handleSubmit = () => {
    if (blocked) {
      toast.error(recommendBlockedReason(intern?.status));
      return;
    }
    if (!form.positionId) {
      toast.error('Select a position for this recommendation');
      return;
    }
    if (!form.projectId) {
      toast.error('Select a project for this recommendation');
      return;
    }

    const payload = {
      internUserId,
      positionId: form.positionId,
      projectId: form.projectId,
      technologyIds: form.technologyIds,
      recommendationNote: form.recommendationNote,
      status: form.status,
      statusDates: { recommended: form.statusDates.recommended || undefined },
    };

    // Same soft warning as the profile panel: pitching someone who already has an
    // open recommendation on a different project is allowed, but not silently.
    const conflicts = activeRecommendationsOnOtherProjects(recommendations, form.projectId);
    if (conflicts.length > 0) {
      setDuplicateWarn({
        payload,
        existingProjectNames: [
          ...new Set(conflicts.map((recommendation) => recommendationProjectName(recommendation))),
        ],
        targetProjectName:
          projects.find((project) => project._id === form.projectId)?.name || 'this project',
      });
      return;
    }

    save(payload);
  };

  return (
    <>
      <RecommendationFormModal
        open={open && !duplicateWarn}
        onClose={close}
        isEditing={false}
        form={form}
        setForm={setForm}
        statuses={RECOMMENDATION_STATUSES}
        positions={positions}
        projects={projects}
        technologies={technologies}
        activeRecommendation={null}
        hasRecordedOutcome={false}
        positionName={(recommendation) => recommendation?.position?.name || 'Position not set'}
        todayInputDate={todayInputDate}
        isSaving={isSaving}
        onSubmit={handleSubmit}
      />

      <RecommendationDuplicateWarnDialog
        open={Boolean(duplicateWarn)}
        internName={internName}
        existingProjectNames={duplicateWarn?.existingProjectNames}
        targetProjectName={duplicateWarn?.targetProjectName}
        isSaving={isSaving}
        onCancel={() => setDuplicateWarn(null)}
        onConfirm={() => save(duplicateWarn.payload)}
      />
    </>
  );
}
