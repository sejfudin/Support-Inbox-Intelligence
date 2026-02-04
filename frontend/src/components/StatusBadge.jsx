import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function TicketStatusBadge({ status }) {
  const s = status?.toLowerCase();

  const config = {
    "to do": {
      variant: "secondary",
      className: "bg-slate-100 text-slate-600 border-slate-200",
    },
    "in progress": {
      variant: "outline",
      className: "bg-blue-50 text-blue-700 border-blue-200",
    },
    "on staging": {
      variant: "outline",
      className: "bg-purple-50 text-purple-700 border-purple-200",
    },
    "blocked": {
      variant: "destructive",
      className: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50",
    },
    "done": {
      variant: "outline",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
  };

  const current = config[s] || { variant: "outline", className: "" };

  return (
    <Badge 
      variant={current.variant} 
      className={cn(
        "capitalize font-semibold px-2.5 py-0.5 border shadow-none transition-none", 
        current.className
      )}
    >
      {status}
    </Badge>
  );
}