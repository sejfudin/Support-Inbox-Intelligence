import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  draftPayloadsEqual,
  draftToForm,
  isDraftFormEmpty,
  toDraftPayload,
} from '@/helpers/ticketDraft';
import { useDeleteTicketDraft, useSaveTicketDraft, useTicketDraft } from '@/queries/ticketDrafts';

// Long enough that a sentence is one save rather than forty, short enough that
// closing the modal a beat after the last word has already been saved. A close
// inside the window is flushed immediately anyway (see below), so this only ever
// trades requests for latency, never work.
export const DRAFT_AUTOSAVE_DELAY_MS = 900;

/**
 * Keeps the New-ticket form on the server while it is being typed, and hands it
 * back the next time the modal opens.
 *
 * Three rules hold this together:
 *
 * - **Hydration happens once per opening, and nothing is saved before it.** The
 *   stored draft and the live form are two copies of the same object; saving
 *   before the restore has landed would let the first keystroke overwrite the
 *   draft it is about to be merged into.
 * - **Closing flushes.** The debounce is cleared when the modal closes, so the
 *   last few characters would otherwise be exactly the ones lost — the case this
 *   whole feature exists to prevent.
 * - **The server owns emptiness.** An emptied form is saved like any other change
 *   and the server deletes the row; the client only skips the request when
 *   nothing was ever typed and nothing is stored.
 *
 * `onRestore` receives the form state to apply — the caller owns the form (and,
 * in the modal's case, has to remount the rich-text editor around it).
 */
export function useTicketDraftAutosave({
  isOpen,
  workspaceId,
  form,
  fallbackStatus = '',
  onRestore,
  enabled = true,
}) {
  const isActive = enabled && Boolean(workspaceId);

  const draftQuery = useTicketDraft(workspaceId, { enabled: isActive && isOpen });
  const { mutate: saveDraft } = useSaveTicketDraft();
  const { mutate: deleteDraft } = useDeleteTicketDraft();

  const [isHydrated, setIsHydrated] = useState(false);
  const [wasRestored, setWasRestored] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // What the server is known to hold. `null` means "no draft stored", which is
  // also what makes an untouched modal cost no request at all.
  const lastSavedRef = useRef(null);
  const payload = useMemo(() => toDraftPayload(form), [form]);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  const persist = useCallback(
    (nextPayload) => {
      lastSavedRef.current = nextPayload;
      setIsSaving(true);
      saveDraft(
        { draft: nextPayload, workspaceId },
        {
          onSuccess: (response) => {
            const saved = response?.data ?? null;
            // An emptied form is a real save whose result is "the row is gone".
            // Without this the header would keep advertising "Draft saved" and a
            // Discard button for a draft that no longer exists.
            if (!saved) {
              lastSavedRef.current = null;
              setSavedAt(null);
              setWasRestored(false);
              return;
            }
            setSavedAt(saved.updatedAt ?? new Date().toISOString());
            // The header stops saying "restored" as soon as this opening has
            // written something of its own.
            setWasRestored(false);
          },
          // Put the draft back in doubt so the next change retries it, rather
          // than treating a failed request as saved.
          onError: () => {
            lastSavedRef.current = null;
          },
          onSettled: () => setIsSaving(false),
        }
      );
    },
    [saveDraft, workspaceId]
  );

  // One restore per opening. A failed fetch counts as "no draft": the modal opens
  // empty rather than not at all, and the first save writes a fresh one.
  //
  // "Not active yet" is split in two: the draft feature being switched off for
  // this mount latches hydrated (there is nothing to wait for), but a workspace
  // id that has not resolved yet does NOT — latching there would skip the restore
  // for the whole opening once the id finally arrived.
  useEffect(() => {
    if (!isOpen || isHydrated) return;
    if (!enabled) {
      setIsHydrated(true);
      return;
    }
    if (!workspaceId) return;
    if (draftQuery.isPending) return;

    const draft = draftQuery.isError ? null : draftQuery.data;
    if (draft) {
      const restoredForm = draftToForm(draft, fallbackStatus);
      lastSavedRef.current = toDraftPayload(restoredForm);
      onRestoreRef.current?.(restoredForm);
      setWasRestored(true);
      setSavedAt(draft.updatedAt ?? null);
    }
    setIsHydrated(true);
  }, [
    isOpen,
    isHydrated,
    enabled,
    workspaceId,
    draftQuery.isPending,
    draftQuery.isError,
    draftQuery.data,
    fallbackStatus,
  ]);

  // The autosave itself.
  useEffect(() => {
    if (!isOpen || !isHydrated || !isActive) return undefined;
    if (draftPayloadsEqual(payload, lastSavedRef.current)) return undefined;
    if (lastSavedRef.current === null && isDraftFormEmpty(form)) return undefined;

    const timer = setTimeout(() => persist(payload), DRAFT_AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // `payload` is rebuilt from the form on every keystroke, so it is the dependency
    // that restarts the debounce — `form` itself would restart it on any render.
  }, [payload, form, isOpen, isHydrated, isActive, persist]);

  // Closing flushes whatever the debounce was still holding, then forgets the
  // opening so the next one restores again.
  useEffect(() => {
    if (isOpen) return;
    if (isHydrated && isActive && !draftPayloadsEqual(payloadRef.current, lastSavedRef.current)) {
      if (!(lastSavedRef.current === null && isDraftFormEmpty(form))) {
        persist(payloadRef.current);
      }
    }
    setIsHydrated(false);
    setWasRestored(false);
    setSavedAt(null);
    lastSavedRef.current = null;
    // Deliberately keyed on `isOpen` alone: this is the close transition, and
    // re-running it on every form change would flush mid-typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Mirrors `savedAt` so `discardDraft` can tell "there is a draft to delete"
  // without taking `savedAt` as a dependency and churning its identity.
  const hasStoredDraftRef = useRef(false);
  hasStoredDraftRef.current = savedAt !== null || lastSavedRef.current !== null;

  /**
   * Throw the draft away — the explicit "Discard draft" button, and the implicit
   * discard that follows a successful create. The caller resets the form; this
   * only settles what the server holds.
   *
   * The DELETE goes out only when something was actually stored: creating a
   * ticket faster than the autosave debounce would otherwise fire a delete for a
   * draft that never existed, once per ticket created.
   */
  const discardDraft = useCallback(() => {
    const hadDraft = hasStoredDraftRef.current;
    lastSavedRef.current = null;
    setWasRestored(false);
    setSavedAt(null);
    if (isActive && hadDraft) deleteDraft(workspaceId);
  }, [deleteDraft, isActive, workspaceId]);

  return {
    isSaving,
    savedAt,
    wasRestored,
    hasDraft: savedAt !== null,
    discardDraft,
  };
}
