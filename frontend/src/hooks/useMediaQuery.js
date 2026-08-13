import { useEffect, useState } from 'react';

// Generic media-query subscription, for the cases `useIsMobile` cannot answer:
// it is fixed to the 768px mobile breakpoint, and some layouts split at other
// widths (the requests master/detail splits at Tailwind's `lg`, 1024px).
//
// Starts false and corrects after mount, so it never claims a match during SSR
// or the first paint. Callers that key layout off it should be written so false
// is the safe default.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
