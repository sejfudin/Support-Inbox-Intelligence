import { Badge } from "@/components/ui/badge";

const getRoleBadge = (role) => {
  const roleLower = role?.toLowerCase();
  const variants = {
    admin: "admin",
    agent: "agent",
  };

  return (
    <Badge
      variant={variants[roleLower] || "outline"}
      className="px-3 py-1 text-xs font-bold uppercase tracking-wider"
    >
      {role}
    </Badge>
  );
};

export default getRoleBadge;
