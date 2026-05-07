import { Button } from '@/components/ui/button';
import { MIN_SUBJECT_LENGTH, MIN_TEXT_LENGTH } from '@/helpers/aiValidationRules';

const AiDescriptionPanel = ({
  isVisible,
  promptLength,
  canGenerateDescription,
  isGeneratingDescription,
  isDescriptionDraftActive,
  onGenerate,
  onAccept,
  onCancel,
  disabled = false,
}) => {
  if (!isVisible) return null;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/90 p-3">
      <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-700">
        <span>AI prompt detected</span>
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {promptLength} chars
        </span>
      </p>

      {!canGenerateDescription && (
        <p className="mt-1 text-xs text-slate-600">
          To generate, use at least {MIN_SUBJECT_LENGTH} characters in the subject and{' '}
          {MIN_TEXT_LENGTH} characters after <span className="font-mono">/ai</span>.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onGenerate}
          disabled={!canGenerateDescription || disabled || isGeneratingDescription}
        >
          {isGeneratingDescription
            ? 'Generating...'
            : isDescriptionDraftActive
              ? 'Regenerate Description'
              : 'Generate Description'}
        </Button>

        {isDescriptionDraftActive && (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onAccept}
              disabled={isGeneratingDescription || disabled}
            >
              Accept
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCancel}
              disabled={isGeneratingDescription || disabled}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default AiDescriptionPanel;
