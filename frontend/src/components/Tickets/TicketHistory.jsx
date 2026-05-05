import { History } from 'lucide-react';
import { format } from 'date-fns';
import { useTicketHistory } from '@/queries/history';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function TicketHistory({ ticketId }) {
  const { data, isLoading } = useTicketHistory(ticketId);
  const history = data?.data ?? [];

  if (isLoading || history.length === 0) return null;

  return (
    <Accordion
      type="single"
      collapsible
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
    >
      <AccordionItem value="history" className="border-none">
        <AccordionTrigger className="px-4 py-3 border-b border-gray-50 bg-gray-50/30 gap-2 hover:no-underline hover:bg-gray-50/60">
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              History
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="p-0 data-[state=closed]:hidden">
          <div className="divide-y divide-gray-50">
            {history.map((entry) => (
              <div key={entry._id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 text-sm text-gray-700">{entry.action}</div>
                <div className="text-xs text-gray-400 shrink-0">
                  {entry.userName} · {format(new Date(entry.timestamp), 'MMM d, yyyy · HH:mm')}
                </div>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
