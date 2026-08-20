import { Archive, ArchiveRestore, Download, MoreVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { TicketStatusField } from './TicketStatusField';

/**
 * The mockup's modal header: `TICKET #81`, the status beside it, then the
 * actions and the close button flush right — one 12px/16px band closed by a
 * hairline. It replaces the old "Ticket Details" caption and 44px controls,
 * which made the header taller than the mockup's whole title block.
 *
 * Status lives here rather than in the rail because that is where the mockup
 * puts it; unlike the mockup it stays editable, so it renders as the dropdown.
 */
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
  currentStatus,
  onStatusChange,
  statusOptions,
  statusBadgeConfig,
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-separator px-4 py-3">
      <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground/75">
        TICKET {ticket?.taskNumber ? `#${ticket.taskNumber}` : ''}
      </span>

      {/* Sized to the band's 28px row and set in sentence case — the shared
          dropdown defaults to a taller bold-uppercase pill, which next to the
          buttons here read as a third, louder button. */}
      <div className="w-[9.5rem]">
        <TicketStatusField
          isArchived={isArchived}
          ticket={ticket}
          currentStatus={currentStatus}
          onStatusChange={onStatusChange}
          statusOptions={statusOptions}
          statusBadgeConfig={statusBadgeConfig}
          className="h-[var(--h-sm)] rounded-[var(--r-control)] px-[var(--px-sm)] text-[12px] font-semibold normal-case"
        />
      </div>

      <span className="flex-1" />

      {!isArchived && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Ticket actions"
              title="Ticket actions"
              data-test="ticket-modal-actions-trigger"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-[200] min-w-[180px]">
            <DropdownMenuItem
              onSelect={onExportCsv}
              disabled={!ticket}
              className="cursor-pointer text-foreground"
              data-test="ticket-modal-export-csv-option"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {!isArchived && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onArchiveToggle}
          disabled={isArchiving}
          data-test="ticket-modal-archive-option"
        >
          <Archive className="h-3.5 w-3.5" />
          {isArchiving ? 'Archiving…' : 'Archive'}
        </Button>
      )}

      {/* The one primary in this band. */}
      {!isArchived && (
        <Button
          size="sm"
          onClick={onSave}
          disabled={isSaveDisabled}
          data-test="ticket-modal-save-button"
        >
          {isSaving ? 'Saving…' : 'Save changes'}
        </Button>
      )}

      {isArchived && (
        <Button
          size="sm"
          onClick={onRestore}
          disabled={isUnarchiving}
          data-test="ticket-modal-restore-button"
        >
          <ArchiveRestore className="h-3.5 w-3.5" />
          {isUnarchiving ? 'Restoring…' : 'Restore'}
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        aria-label="Close ticket details"
        data-test="ticket-modal-close-button"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
