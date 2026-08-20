import { useEffect, useMemo, useRef, useState } from 'react';
import { useMarkStaffingRequestsSeen, useStaffingRequestNews } from '@/queries/staffingRequests';

// Per-row "new" markers for the requests list.
//
// Opening the tab clears the badge, and marking seen refetches the news query —
// which would wipe the markers a moment after the page renders, right when an
// admin arriving from a notification is looking for them. So the first news
// payload is frozen for the life of the mount: the badge still clears, but the
// rows keep showing what changed until the reader leaves the page.
export const useStaffingNewsMarkers = () => {
  const { data: news } = useStaffingRequestNews();
  const [frozenIds, setFrozenIds] = useState(null);

  // Stamp seen only once the markers are captured, so the seen stamp can never
  // land ahead of the news fetch and empty it out.
  const markSeenMutation = useMarkStaffingRequestsSeen();
  const hasMarkedSeen = useRef(false);
  useEffect(() => {
    if (frozenIds || !news) return;
    setFrozenIds(news.requestIds ?? []);
    if (hasMarkedSeen.current) return;
    hasMarkedSeen.current = true;
    markSeenMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [news, frozenIds]);

  return useMemo(() => new Set(frozenIds ?? []), [frozenIds]);
};
