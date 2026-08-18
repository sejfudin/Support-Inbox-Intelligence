import { AlertTriangle, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * The one "are you sure?" dialog, shared by ticket, workspace, specialization and
 * daily deletions.
 *
 * This is the case the design carves out for a filled destructive button: the
 * whole view *is* the confirmation step, so Delete gets `destructive-solid` and
 * `lg`, the modal-footer size. Everywhere else a destructive action is an outline
 * — a page of filled red buttons stops reading as a warning.
 *
 * The colours run through `--tone-danger` rather than the raw `red-*` steps they
 * used to use. Those steps had no dark variants, so in dark mode this dialog put
 * a red-600 icon on a red-100 disc — near-invisible — and the same tokens are
 * what Settings → Accessibility → Colour-blind safe repaints.
 */
export const DeleteConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  errorMessage,
  title = 'Delete Ticket',
  description = 'Are you sure you want to delete this ticket? This action cannot be undone and all associated data will be lost.',
  confirmLabel = 'Delete',
  loadingLabel = 'Deleting...',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md overflow-hidden rounded-[var(--r-card)] border border-border bg-card shadow-elevated">
        <div className="flex justify-end p-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            data-test="delete-confirm-close-button"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 pb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--tone-danger)/0.15)]">
            <AlertTriangle className="h-6 w-6 text-[hsl(var(--tone-danger-fg))]" />
          </div>

          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>

          {errorMessage && (
            <div className="animate-shake mt-4 rounded-[var(--r-control)] border border-[hsl(var(--tone-danger)/0.3)] bg-[hsl(var(--tone-danger)/0.12)] p-3 text-sm text-[hsl(var(--tone-danger-fg))]">
              {errorMessage}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button
              variant="secondary"
              size="lg"
              onClick={onClose}
              className="flex-1"
              data-test="delete-confirm-cancel-button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive-solid"
              size="lg"
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1"
              data-test="delete-confirm-submit-button"
            >
              {isLoading ? loadingLabel : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
