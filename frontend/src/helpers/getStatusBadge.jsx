import { Badge } from "@/components/ui/badge";

const getStatusBadge = (status) => {
  const statusLower = status?.toLowerCase();
  const variants = {
    open: "destructive",
    pending: "warning",
    closed: "success",
    active: "active",
    inactive: "inactive",
  };
  
  return (
    <Badge variant={variants[statusLower]} className="uppercase">
      {status}
    </Badge>
  );
};

export default getStatusBadge;
