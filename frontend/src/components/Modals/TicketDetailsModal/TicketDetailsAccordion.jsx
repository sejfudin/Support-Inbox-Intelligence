import { Ticket } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { TicketDueDateField } from './TicketDueDateField';
import { TicketStoryPointsField } from './TicketStoryPointsField';
import { TicketCategoryField } from './TicketCategoryField';

export function TicketDetailsAccordion({
  isArchived,
  dueDateInput,
  onDueDateChange,
  currentStoryPoints,
  onStoryPointsChange,
  categories,
  currentCategory,
  onCategoryChange,
}) {
  return (
    <Accordion
      type="single"
      collapsible
      className="rounded-[var(--r-card)] border border-border bg-card shadow-md overflow-hidden"
    >
      <AccordionItem value="details" className="border-none">
        <AccordionTrigger
          className="px-4 py-3 border-b border-separator bg-muted/30 gap-2 hover:no-underline hover:bg-muted/60"
          data-test="ticket-modal-details-accordion-trigger"
        >
          <div className="flex items-center gap-2">
            <Ticket className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Details
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-5 pt-4 data-[state=closed]:hidden">
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Due date
                </span>
              </div>
              <TicketDueDateField
                isArchived={isArchived}
                dueDateInput={dueDateInput}
                onDueDateChange={onDueDateChange}
              />
            </div>

            <TicketStoryPointsField
              isArchived={isArchived}
              currentStoryPoints={currentStoryPoints}
              onStoryPointsChange={onStoryPointsChange}
            />
          </div>

          {categories.length > 0 && (
            <div className="mt-4 space-y-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Category
              </span>
              <TicketCategoryField
                isArchived={isArchived}
                categories={categories}
                currentCategory={currentCategory}
                onCategoryChange={onCategoryChange}
              />
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
