import { Badge } from "./ui/badge";

export const UserStatusBadge = ({status}) => {
    const s = status.toString().toLowerCase();
    const style =
      s === "active"
        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
        : "bg-slate-100 text-slate-600 border-slate-200";

    return (
      <Badge
        className={`${style} hover:${style} px-4 py-1 text-xs font-bold uppercase tracking-wider`}
      >
        {status}
      </Badge>
    );
  };