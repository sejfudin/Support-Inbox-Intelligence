import { Archive, ArchiveRestore, Download, MoreVertical, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function TicketModalHeader({
  isArchived,
  ticket,
  onExportCsv,
  onArchiveToggle,
  isArchiving,
  onSave,
  isSaveDisabled,
  isSaving,
  onRestore,
  isUnarchiving,
  onClose,
}) {
  return (
    <div className="flex shrink-0 flex-col gap-3 border-b bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4 lg:px-8">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Ticket Details
        </span>
      </div>

      <div className="flex w-full flex-row flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-3">
        {!isArchived && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-muted/50"
                aria-label="Ticket actions"
                title="Ticket actions"
                data-test="ticket-modal-actions-trigger"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[200] min-w-[180px]">
              <DropdownMenuItem
                onSelect={onExportCsv}
                disabled={!ticket}
                className="cursor-pointer text-foreground"
                data-test="ticket-modal-export-csv-option"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onArchiveToggle}
                disabled={isArchiving}
                className="cursor-pointer text-foreground"
                data-test="ticket-modal-archive-option"
              >
                <Archive className="w-4 h-4 mr-2" />
                {isArchiving ? 'Archiving...' : 'Archive'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!isArchived && (
          <Button
            variant="default"
            size="lg"
            type="button"
            onClick={onSave}
            disabled={isSaveDisabled}
            data-test="ticket-modal-save-button"
            className={`flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all shadow-sm sm:w-auto sm:flex-initial ${
              isSaveDisabled ? 'cursor-not-allowed bg-muted text-muted-foreground' : ''
            }`}
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
        {isArchived && (
          <Button
            variant="default"
            size="lg"
            type="button"
            onClick={onRestore}
            disabled={isUnarchiving}
            data-test="ticket-modal-restore-button"
            className="flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-all sm:w-auto sm:flex-initial"
          >
            <ArchiveRestore className="w-4 h-4" />
            {isUnarchiving ? 'Restoring...' : 'Restore'}
          </Button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-1 ml-2 hover:bg-muted rounded text-muted-foreground hover:text-muted-foreground transition-colors"
          aria-label="Close ticket details"
          data-test="ticket-modal-close-button"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
