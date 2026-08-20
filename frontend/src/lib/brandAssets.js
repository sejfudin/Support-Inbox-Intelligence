export const TASK_MANAGER_LOGO_SRC = '/brand/TMLogo.png';
export const TASK_MANAGER_FAVICON_SRC = '/favicon.svg';

// The mark's four petals as separate files, on the same 242x242 canvas as TMLogo.png —
// so stacked at the same size they reassemble the logo exactly, and each can be animated
// on its own. Ordered as the loader unfurls them (see components/ui/loader.jsx), which is
// also the mark's reading order: red top-left, then clockwise.
export const TASK_MANAGER_PETAL_SRCS = [
  '/brand/petals/petal-red.png',
  '/brand/petals/petal-gold.png',
  '/brand/petals/petal-blue.png',
  '/brand/petals/petal-purple.png',
];
