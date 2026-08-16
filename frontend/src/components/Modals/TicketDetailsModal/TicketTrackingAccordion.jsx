import { format } from 'date-fns';
import { Clock } from 'lucide-react';
import { formatDuration } from '@/helpers/formatDuration';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Avatar } from '@/components/Avatar';
import TimeSpent from '@/components/TimeSpent';

export function TicketTrackingAccordion({ ticket, isArchived, statusTracksTime }) {
  return (
    <Accordion
      type="single"
      collapsible
      className="rounded-[var(--r-card)] border border-border bg-card shadow-md overflow-hidden"
    >
      <AccordionItem value="tracking" className="border-none">
        <AccordionTrigger
          className="px-4 py-3 border-b border-separator bg-muted/30 gap-2 hover:no-underline hover:bg-muted/60"
          data-test="ticket-modal-tracking-accordion-trigger"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Tracking
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-5 pt-4 data-[state=closed]:hidden">
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            <TimeSpent ticket={ticket} statusTracksTime={statusTracksTime} />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Created By
                </span>
              </div>

              <div className="flex min-h-[44px] w-full items-center gap-3 px-1.5 py-2">
                {ticket?.creator ? (
                  <Avatar users={[ticket.creator]} size="md" />
                ) : (
                  <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
                )}

                <div className="flex flex-col justify-center min-w-0">
                  <span className="text-sm font-semibold text-foreground leading-none truncate">
                    {ticket?.creator?.fullname || ticket?.creator?.fullName || 'Unknown User'}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium mt-1">
                    {ticket?.createdAt ? format(new Date(ticket.createdAt), 'MMM d, yyyy') : ''}
                  </span>
                </div>
              </div>
            </div>

            {isArchived && ticket?.doneAt && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Resolution time
                  </span>
                </div>
                <div className="flex min-h-[44px] flex-col justify-center px-1.5 py-2">
                  <span className="text-sm font-semibold text-foreground leading-none">
                    {formatDuration(
                      Math.max(
                        0,
                        Math.floor(
                          (new Date(ticket.doneAt).getTime() -
                            new Date(ticket.createdAt).getTime()) /
                            1000
                        )
                      )
                    )}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium mt-1">
                    Resolved {format(new Date(ticket.doneAt), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
