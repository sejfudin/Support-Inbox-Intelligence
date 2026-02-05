import { Badge } from "./ui/badge";

export const RoleBadge = ({role}) => {
    const r = role.toLowerCase();
    let style = "bg-slate-100 text-slate-700 border-slate-200";
    if (r === "admin")
      style = "bg-indigo-100 text-indigo-700 border-indigo-200";
    if (r === "user") style = "bg-amber-100 text-amber-700 border-amber-200";

    return (
      <Badge
        className={`${style} hover:${style} px-4 py-1 text-xs font-bold uppercase tracking-wider`}
      >
        {role}
      </Badge>
    );
  };