import { useState } from 'react';
import { History, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { useTicketHistory } from '@/queries/history';
import { cn } from '@/lib/utils';

export default function TicketHistory({ ticketId }) {
  const { data, isLoading } = useTicketHistory(ticketId);
  const [open, setOpen] = useState(false);
  const history = data?.data ?? [];

  if (isLoading || history.length === 0) return null;

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-gray-400 text-sm font-bold uppercase tracking-wider mb-3 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4" /> History
        </div>
        <ChevronDown
          className={cn('w-4 h-4 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="rounded-2xl border border-gray-100 shadow-sm bg-white overflow-hidden">
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
        </div>
      )}
    </div>
  );
}
