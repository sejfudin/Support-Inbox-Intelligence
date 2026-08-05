// Shared with SymphonyNav's navbar avatar — one/two initials from a full name.
export function getInitials(fullname, fallback = '?') {
  if (!fullname) return fallback;
  const parts = fullname.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
