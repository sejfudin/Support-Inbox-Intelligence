import { History } from 'lucide-react';
import { format } from 'date-fns';
import { useTicketHistory } from '@/queries/history';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

function parseAction(action) {
  let m;

  // "... from X to Y" or "... from X to Y (extra note)"
  m = action.match(/^(.*?\bfrom\s+)(.+?)(\s+to\s+)(.+?)(\s*\([^)]*\))?$/);
  if (m) {
    const segments = [
      { text: m[1] },
      { text: m[2], bold: true },
      { text: m[3] },
      { text: m[4], bold: true },
    ];
    if (m[5]) segments.push({ text: m[5] });
    return segments;
  }

  // "... to X" — set to, changed to, Assigned to, Reassigned to
  m = action.match(/^(.*?\bto\s+)(.+)$/);
  if (m) {
    return [
      { text: m[1] },
      { text: m[2], bold: true },
    ];
  }

  // "PR #N linked/unlinked"
  m = action.match(/^(.*?)(PR #\d+)(.*)$/);
  if (m) {
    return [
      ...(m[1] ? [{ text: m[1] }] : []),
      { text: m[2], bold: true },
      ...(m[3] ? [{ text: m[3] }] : []),
    ];
  }

  // Fallback: bold the last word (covers "Ticket Archived", "Comment deleted", etc.)
  m = action.match(/^(.*\s)(\S+)$/);
  if (m) {
    return [{ text: m[1] }, { text: m[2], bold: true }];
  }

  return [{ text: action }];
}

function FormattedAction({ action }) {
  const segments = parseAction(action);
  return (
    <span>
      {segments.map((seg, i) =>
        seg.bold ? (
          <span key={i} className="font-semibold text-gray-900">
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  );
}

export default function TicketHistory({ ticketId }) {
  const { data, isLoading } = useTicketHistory(ticketId);
  const history = data?.data ?? [];

  if (isLoading || history.length === 0) return null;

  return (
    <Accordion
      type="single"
      collapsible
      className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden"
    >
      <AccordionItem value="history" className="border-none">
        <AccordionTrigger className="px-4 py-3 border-b border-gray-50 bg-gray-50/30 gap-2 hover:no-underline hover:bg-gray-50/60">
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              History
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="p-0 data-[state=closed]:hidden">
          <div className="divide-y divide-gray-50">
            {history.map((entry) => (
              <div key={entry._id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 text-sm text-gray-700">
                  <FormattedAction action={entry.action} />
                </div>
                <div className="text-xs text-gray-500 shrink-0">
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
