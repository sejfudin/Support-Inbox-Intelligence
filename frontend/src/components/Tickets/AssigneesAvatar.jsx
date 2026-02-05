import { Avatar } from "@/components/Avatar";

export default function AssigneesAvatar({ users, emptyLabel = "Unassigned" }) {
  if (!users || (Array.isArray(users) && users.length === 0)) {
    return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
  }

  return <Avatar users={users} />;
}
