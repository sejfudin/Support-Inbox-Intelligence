import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'staffing-staged-picks';

/**
 * The admin's staged picks — interns lined up against a request's seats but not
 * yet sent. Deliberately client-only: a staged pick is an intention the server
 * has never been told about, so there is nothing to read back off it and no
 * model to hold it (see `.scratch/staffing-requests/issues/08-*`, and ADR 0006
 * for why the request itself still holds no list of interns).
 *
 * `sessionStorage`, not state alone: a refresh, a route change or clicking a
 * second request must not silently discard the picks. Not `localStorage`,
 * because unsent picks should not outlive the browsing session and reappear
 * days later as if they were still current.
 *
 * Stored shape is `{ [requestId]: { [positionId]: [pick] } }`, where a pick is
 * `{ id, name, technologies, startDate }`. It carries the candidate's display
 * fields, not just the id, because the seat group shows staged picks for every
 * seat while the candidate list is only ever fetched for the one seat the rail
 * is filtered to — an id alone would render as a nameless row. Only the id is
 * ever sent.
 *
 * It is read in an effect rather than in the initial state so the first render
 * is the same for every visitor, and every read is defensive — anything
 * malformed in storage is treated as no cart at all rather than crashing the
 * screen.
 */
const readStorage = () => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    /* ignore — private mode, disabled storage, or junk written by an older build */
    return {};
  }
};

const writeStorage = (carts) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(carts));
  } catch {
    /* ignore — the picks still work for this render, they just won't survive */
  }
};

// A cart is `{ [positionId]: [pick] }`. These are used by the list, which only
// ever has the cart and not the hook, as well as by the detail pane.
export const countStagedPicks = (cart = {}) =>
  Object.values(cart).reduce((total, picks) => total + picks.length, 0);

export const stagedInternIds = (cart = {}) =>
  new Set(
    Object.values(cart)
      .flat()
      .map((pick) => pick.id)
  );

export const toPutForwardGroups = (cart = {}) =>
  Object.entries(cart)
    .filter(([, picks]) => picks.length > 0)
    .map(([positionId, picks]) => ({
      positionId,
      internProfileIds: picks.map((pick) => pick.id),
    }));

// Shared so the page's "no cart for this request" fallback is the same object
// every render — a fresh `{}` would re-run every memo that reads the cart.
export const EMPTY_CART = {};

export function useStagedPicks() {
  const [carts, setCarts] = useState(EMPTY_CART);
  const hasLoaded = useRef(false);

  useEffect(() => {
    setCarts(readStorage());
    hasLoaded.current = true;
  }, []);

  // Mirroring happens here rather than inside the state updaters: an updater
  // must stay pure (React double-invokes it in development), and the guard
  // stops the pre-load empty state from overwriting a stored cart on mount.
  useEffect(() => {
    if (!hasLoaded.current) return;
    writeStorage(carts);
  }, [carts]);

  const update = useCallback((requestId, updateCart) => {
    setCarts((current) => {
      const cart = updateCart(current[requestId] ?? {});
      const next = { ...current };
      // Drop empty carts rather than leaving `{}` behind: "has staged picks" is
      // asked of this object all over the list, and an empty cart that answers
      // yes would badge a request nobody has touched.
      if (countStagedPicks(cart) === 0) delete next[requestId];
      else next[requestId] = cart;
      return next;
    });
  }, []);

  // Staging an intern who is already staged on another seat of the same request
  // moves them rather than duplicating them — one person cannot answer two of
  // one request's seats, and the server refuses it on submit anyway.
  const togglePick = useCallback(
    (requestId, positionId, pick) =>
      update(requestId, (cart) => {
        const staged = cart[positionId] ?? [];
        if (staged.some((candidate) => candidate.id === pick.id)) {
          return {
            ...cart,
            [positionId]: staged.filter((candidate) => candidate.id !== pick.id),
          };
        }
        const withoutElsewhere = Object.fromEntries(
          Object.entries(cart).map(([key, picks]) => [
            key,
            picks.filter((candidate) => candidate.id !== pick.id),
          ])
        );
        return {
          ...withoutElsewhere,
          [positionId]: [...(withoutElsewhere[positionId] ?? []), pick],
        };
      }),
    [update]
  );

  // Replaces one position's picks wholesale — what the picker saves when it
  // hands back a shortlist it assembled as a draft. Anyone in the new list is
  // pulled off the request's other positions for the same reason `togglePick`
  // moves rather than duplicates: one person cannot answer two of one request's
  // seats, and the server refuses it on submit.
  const setPositionPicks = useCallback(
    (requestId, positionId, picks) =>
      update(requestId, (cart) => {
        const ids = new Set(picks.map((pick) => pick.id));
        const withoutElsewhere = Object.fromEntries(
          Object.entries(cart)
            .filter(([key]) => key !== positionId)
            .map(([key, staged]) => [key, staged.filter((pick) => !ids.has(pick.id))])
        );
        return { ...withoutElsewhere, [positionId]: picks };
      }),
    [update]
  );

  const clearRequest = useCallback(
    (requestId) =>
      setCarts((current) => {
        if (!current[requestId]) return current;
        const next = { ...current };
        delete next[requestId];
        return next;
      }),
    []
  );

  return { carts, togglePick, setPositionPicks, clearRequest };
}
