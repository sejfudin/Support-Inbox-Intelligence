import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_BADGE_CONFIG } from "@/helpers/ticketStatus";

export function TicketStatusBadge({ status, className }) {
  const s = status?.toLowerCase();
  const current = STATUS_BADGE_CONFIG[s] || { variant: "outline", className: "" };

  return (
    <Badge 
      variant={current.variant} 
      className={cn(
        "capitalize font-semibold px-2.5 py-0.5 border shadow-none transition-none",
        current.className,
        className,
      )}
    >
      {status}
    </Badge>
  );
}
