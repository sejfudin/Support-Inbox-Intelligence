import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSuggestTicketMetadata } from "@/queries/tickets";

export const useAiTicketSuggestion = ({
  isOpen,
  subject,
  description,
  priorityLockedByUser,
  storyPointsLockedByUser,
  updateField,
}) => {
  const suggestMetadataMutation = useSuggestTicketMetadata();

  const latestSuggestionRequestIdRef = useRef(0);
  const manualSuggestionInFlightRef = useRef(false);
  const lastAutoSuggestionInputKeyRef = useRef("");

  const safeSubject = String(subject || "").trim();
  const safeDescription = String(description || "").trim();

  const hasSuggestibleInput =
    safeSubject.length >= 3 && safeDescription.length >= 10;

  const resetSuggestionState = useCallback(() => {
    latestSuggestionRequestIdRef.current = 0;
    manualSuggestionInFlightRef.current = false;
    lastAutoSuggestionInputKeyRef.current = "";
  }, []);

  const applySuggestion = useCallback(
    (suggestion, { force = false } = {}) => {
      if (!suggestion || typeof suggestion !== "object") return;

      if ((force || !priorityLockedByUser) && suggestion.priority) {
        updateField("priority", suggestion.priority);
      }

      if ((force || !storyPointsLockedByUser) && suggestion.storyPoints != null) {
        updateField("storyPoints", suggestion.storyPoints);
      }
    },
    [priorityLockedByUser, storyPointsLockedByUser, updateField],
  );

  const requestSuggestion = useCallback(
    ({ force = false, showToast = false, source = "auto" } = {}) => {
      if (!hasSuggestibleInput) return false;
      if (suggestMetadataMutation.isPending) return false;

      if (source === "auto" && manualSuggestionInFlightRef.current) return false;
      if (source === "manual") {
        manualSuggestionInFlightRef.current = true;
      }

      const requestId = ++latestSuggestionRequestIdRef.current;

      suggestMetadataMutation.mutate(
        { subject: safeSubject, description: safeDescription },
        {
          onSuccess: (res) => {
            if (requestId !== latestSuggestionRequestIdRef.current) return;
            applySuggestion(res?.data, { force });
            if (showToast) toast.success("AI suggestions applied.");
          },
          onError: (error) => {
            if (requestId !== latestSuggestionRequestIdRef.current) return;
            if (showToast) {
              toast.error(
                error?.response?.data?.message ||
                  "AI suggestion is unavailable right now.",
              );
            }
          },
          onSettled: () => {
            if (source === "manual") {
              manualSuggestionInFlightRef.current = false;
            }
          },
        },
      );

      return true;
    },
    [
      hasSuggestibleInput,
      safeSubject,
      safeDescription,
      suggestMetadataMutation,
      applySuggestion,
    ],
  );

  useEffect(() => {
    if (!isOpen) return;

    if (!hasSuggestibleInput) {
      lastAutoSuggestionInputKeyRef.current = "";
      return;
    }

    const inputKey = `${safeSubject}::${safeDescription}`;

    if (inputKey === lastAutoSuggestionInputKeyRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      const started = requestSuggestion({
        force: false,
        showToast: false,
        source: "auto",
      });

      if (started) {
        lastAutoSuggestionInputKeyRef.current = inputKey;
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [isOpen, hasSuggestibleInput, safeSubject, safeDescription, requestSuggestion]);

  const requestManualSuggestion = useCallback(() => {
    if (!hasSuggestibleInput) return;
    if (manualSuggestionInFlightRef.current) return;

    requestSuggestion({ force: true, showToast: true, source: "manual" });
  }, [hasSuggestibleInput, requestSuggestion]);

  return {
    hasSuggestibleInput,
    isSuggesting: suggestMetadataMutation.isPending,
    requestManualSuggestion,
    resetSuggestionState,
  };
};
