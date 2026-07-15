import { GitPullRequest } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { PRCard } from '@/components/PRCard';

export function TicketPrAccordion({
  linkedPullRequest,
  isArchived,
  onRefresh,
  isRefreshing,
  onUnlink,
  isUnlinking,
}) {
  return (
    <Accordion
      type="single"
      collapsible
      className="rounded-2xl border border-border bg-card shadow-md overflow-hidden"
    >
      <AccordionItem value="pr" className="border-none">
        <AccordionTrigger
          className="px-4 py-3 border-b border-separator bg-muted/30 gap-2 hover:no-underline hover:bg-muted/60"
          data-test="ticket-modal-pr-accordion-trigger"
        >
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Linked Pull Request
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-5 pt-4 data-[state=closed]:hidden">
          <PRCard
            pr={linkedPullRequest}
            onRefresh={isArchived ? undefined : onRefresh}
            isRefreshing={isRefreshing}
            onUnlink={isArchived ? undefined : onUnlink}
            isUnlinking={isUnlinking}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
