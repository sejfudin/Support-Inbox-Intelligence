import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useSuggestTicketMetadata } from '@/queries/tickets';
import { MIN_SUBJECT_LENGTH, MIN_TEXT_LENGTH } from '@/helpers/aiValidationRules';

export const useAiTicketSuggestion = ({
  isOpen,
  subject,
  description,
  priorityLockedByUser,
  storyPointsLockedByUser,
  updateField,
  isPaused = false,
  skipInitialAutoSuggestion = false,
}) => {
  const suggestMetadataMutation = useSuggestTicketMetadata();

  const latestSuggestionRequestIdRef = useRef(0);
  const manualSuggestionInFlightRef = useRef(false);
  const lastAutoSuggestionInputKeyRef = useRef('');
  const hasInitializedAutoSuggestionRef = useRef(false);


  const safeSubject = String(subject || '').trim();
  const safeDescription = String(description || '').trim();

  const hasSuggestibleInput =
    !isPaused &&
    safeSubject.length >= MIN_SUBJECT_LENGTH &&
    safeDescription.length >= MIN_TEXT_LENGTH;

  const resetSuggestionState = useCallback(() => {
    latestSuggestionRequestIdRef.current = 0;
    manualSuggestionInFlightRef.current = false;
    lastAutoSuggestionInputKeyRef.current = '';
    hasInitializedAutoSuggestionRef.current = false;
  }, []);

  const applySuggestion = useCallback(
    (suggestion, { force = false } = {}) => {
      if (!suggestion || typeof suggestion !== 'object') return;

      if ((force || !priorityLockedByUser) && suggestion.priority) {
        updateField('priority', suggestion.priority);
      }

      if ((force || !storyPointsLockedByUser) && suggestion.storyPoints != null) {
        updateField('storyPoints', suggestion.storyPoints);
      }
    },
    [priorityLockedByUser, storyPointsLockedByUser, updateField]
  );

  const requestSuggestion = useCallback(
    ({ force = false, showToast = false, source = 'auto' } = {}) => {
      if (isPaused) return false;
      if (!hasSuggestibleInput) return false;
      if (suggestMetadataMutation.isPending) return false;

      if (source === 'auto' && manualSuggestionInFlightRef.current) return false;
      if (source === 'manual') {
        manualSuggestionInFlightRef.current = true;
      }

      const requestId = ++latestSuggestionRequestIdRef.current;

      suggestMetadataMutation.mutate(
        { subject: safeSubject, description: safeDescription },
        {
          onSuccess: (res) => {
            if (requestId !== latestSuggestionRequestIdRef.current) return;
            applySuggestion(res?.data, { force });
            if (showToast) toast.success('AI suggestions applied.');
          },
          onError: (error) => {
            if (requestId !== latestSuggestionRequestIdRef.current) return;
            if (showToast) {
              toast.error(
                error?.response?.data?.message || 'AI suggestion is unavailable right now.'
              );
            }
          },
          onSettled: () => {
            if (source === 'manual') {
              manualSuggestionInFlightRef.current = false;
            }
          },
        }
      );

      return true;
    },
    [
      isPaused,
      hasSuggestibleInput,
      safeSubject,
      safeDescription,
      suggestMetadataMutation,
      applySuggestion,
    ]
  );

  useEffect(() => {
    if (!isOpen) return;

    if (isPaused) {
      lastAutoSuggestionInputKeyRef.current = '';
      return;
    }

    if (!hasSuggestibleInput) {
      lastAutoSuggestionInputKeyRef.current = '';
      return;
    }

    const inputKey = `${safeSubject}::${safeDescription}`;

    if (skipInitialAutoSuggestion && !hasInitializedAutoSuggestionRef.current) {
      hasInitializedAutoSuggestionRef.current = true;
      lastAutoSuggestionInputKeyRef.current = inputKey;
      return;
    }


    if (inputKey === lastAutoSuggestionInputKeyRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      const started = requestSuggestion({
        force: false,
        showToast: false,
        source: 'auto',
      });

      if (started) {
        lastAutoSuggestionInputKeyRef.current = inputKey;
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [
      isOpen, 
      isPaused, 
      hasSuggestibleInput, 
      safeSubject, 
      safeDescription, 
      requestSuggestion,
      skipInitialAutoSuggestion,
    ]);

  const requestManualSuggestion = useCallback(() => {
    if (isPaused) return;
    if (!hasSuggestibleInput) return;
    if (manualSuggestionInFlightRef.current) return;

    requestSuggestion({ force: true, showToast: true, source: 'manual' });
  }, [isPaused, hasSuggestibleInput, requestSuggestion]);

  return {
    hasSuggestibleInput,
    isSuggesting: suggestMetadataMutation.isPending,
    requestManualSuggestion,
    resetSuggestionState,
  };
};
