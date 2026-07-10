import { AlertTriangle, ArchiveRestore, X } from 'lucide-react';

const TONE_STYLES = {
  danger: {
    iconWrap: 'bg-red-100',
    icon: 'text-red-600',
    Icon: AlertTriangle,
    confirm: 'bg-red-600 hover:bg-red-700',
  },
  primary: {
    iconWrap: 'bg-primary/10',
    icon: 'text-primary',
    Icon: ArchiveRestore,
    confirm: 'bg-primary hover:bg-primary/90',
  },
};

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
  tone = 'danger',
}) => {
  if (!isOpen) return null;

  const toneStyle = TONE_STYLES[tone] || TONE_STYLES.danger;
  const ToneIcon = toneStyle.Icon;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex justify-end p-2">
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-full text-muted-foreground"
            data-test="delete-confirm-close-button"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 text-center">
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full mb-4 ${toneStyle.iconWrap}`}
          >
            <ToneIcon className={`h-6 w-6 ${toneStyle.icon}`} />
          </div>

          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-2">{description}</p>

          {errorMessage && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm animate-shake">
              {errorMessage}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-semibold text-foreground bg-muted hover:bg-muted rounded-lg transition-colors"
              data-test="delete-confirm-cancel-button"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 ${toneStyle.confirm}`}
              data-test="delete-confirm-submit-button"
            >
              {isLoading ? loadingLabel : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
