import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useGenerateTicketDescription } from '@/queries/tickets';
import {
  AI_PROMPT_MIN_LENGTH,
  extractAiPromptFromDescriptionHtml,
} from '@/helpers/aiDescriptionPrompt';
import { MIN_SUBJECT_LENGTH } from '@/helpers/aiValidationRules';

export const useAiDescriptionGenerator = ({ isOpen, subject, descriptionHtml, updateField }) => {
  const generateDescriptionMutation = useGenerateTicketDescription();

  const [isDescriptionDraftActive, setIsDescriptionDraftActive] = useState(false);

  const originalDescriptionHtmlRef = useRef('');
  const originalPromptTextRef = useRef('');
  const latestRequestIdRef = useRef(0);

  const safeSubject = String(subject || '').trim();

  const { isAiPromptMode, prompt: parsedPrompt } = useMemo(
    () => extractAiPromptFromDescriptionHtml(descriptionHtml),
    [descriptionHtml]
  );

  const isPromptPanelVisible = isAiPromptMode || isDescriptionDraftActive;
  const effectivePrompt = isDescriptionDraftActive ? originalPromptTextRef.current : parsedPrompt;

  const hasValidSubject = safeSubject.length >= MIN_SUBJECT_LENGTH;
  const hasValidPrompt = effectivePrompt.length >= AI_PROMPT_MIN_LENGTH;

  const canGenerateDescription = isPromptPanelVisible && hasValidSubject && hasValidPrompt;

  const shouldPauseMetadataSuggestion =
    isAiPromptMode || isDescriptionDraftActive || generateDescriptionMutation.isPending;

  const resetDescriptionGenerationState = useCallback(() => {
    latestRequestIdRef.current = 0;
    originalDescriptionHtmlRef.current = '';
    originalPromptTextRef.current = '';
    setIsDescriptionDraftActive(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetDescriptionGenerationState();
    }
  }, [isOpen, resetDescriptionGenerationState]);

  const generateDescription = useCallback(
    ({ showToast = true } = {}) => {
      if (!canGenerateDescription) return false;
      if (generateDescriptionMutation.isPending) return false;

      if (!isDescriptionDraftActive) {
        originalDescriptionHtmlRef.current = String(descriptionHtml || '');
        originalPromptTextRef.current = effectivePrompt;
      }

      const requestId = ++latestRequestIdRef.current;

      generateDescriptionMutation.mutate(
        { subject: safeSubject, prompt: effectivePrompt },
        {
          onSuccess: (res) => {
            if (requestId !== latestRequestIdRef.current) return;

            const descriptionFromAi = String(res?.data?.descriptionHtml || '').trim();
            if (!descriptionFromAi) {
              toast.error('AI generated empty description.');
              return;
            }

            updateField('description', descriptionFromAi);
            setIsDescriptionDraftActive(true);

            if (showToast) {
              toast.success('Description generated.');
            }
          },
          onError: (error) => {
            if (requestId !== latestRequestIdRef.current) return;

            toast.error(
              error?.response?.data?.message ||
                'AI description generation is unavailable right now.'
            );
          },
        }
      );

      return true;
    },
    [
      canGenerateDescription,
      generateDescriptionMutation,
      isDescriptionDraftActive,
      descriptionHtml,
      effectivePrompt,
      safeSubject,
      updateField,
    ]
  );

  const acceptGeneratedDescription = useCallback(() => {
    if (!isDescriptionDraftActive) return;
    originalDescriptionHtmlRef.current = '';
    originalPromptTextRef.current = '';
    setIsDescriptionDraftActive(false);
  }, [isDescriptionDraftActive]);

  const cancelGeneratedDescription = useCallback(() => {
    if (!isDescriptionDraftActive) return;

    updateField('description', originalDescriptionHtmlRef.current || '');
    originalDescriptionHtmlRef.current = '';
    originalPromptTextRef.current = '';
    setIsDescriptionDraftActive(false);
  }, [isDescriptionDraftActive, updateField]);

  return {
    isAiPromptMode,
    isPromptPanelVisible,
    promptLength: effectivePrompt.length,
    canGenerateDescription,
    isGeneratingDescription: generateDescriptionMutation.isPending,
    isDescriptionDraftActive,
    shouldPauseMetadataSuggestion,
    generateDescription,
    acceptGeneratedDescription,
    cancelGeneratedDescription,
    resetDescriptionGenerationState,
  };
};
