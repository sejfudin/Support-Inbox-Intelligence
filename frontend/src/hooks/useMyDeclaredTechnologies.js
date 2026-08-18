import { useMemo } from 'react';
import { useMyInternProfile, useMyInternReadiness } from '@/queries/interns';
import { useTechnologies } from '@/queries/technologies';

/**
 * The intern's own declared technologies, in catalog order, each joined to the
 * readiness flag a mentor set on it.
 *
 * Shared by the declaration list and the readiness summary that sits beside it on
 * `/my-technologies`: both need the same profile → catalog → flags join, and all
 * three queries are cached under their own keys, so a second caller costs the
 * join and nothing else.
 */
export function useMyDeclaredTechnologies() {
  const { data: intern } = useMyInternProfile();
  const { data: allTechnologies = [], isPending: isLoadingTechnologies } = useTechnologies();
  const { data: flags = [] } = useMyInternReadiness();

  // Set of declared tech IDs — fast lookup for "already declared?"
  const declaredIds = useMemo(
    () => new Set((intern?.selfTechnologies || []).map((t) => t._id || t)),
    [intern]
  );

  // { techId → flag } — used to look up readiness level per tech. The intern's
  // position flag is in here too under a null key; nothing looks it up by that.
  const flagMap = useMemo(
    () => Object.fromEntries(flags.map((f) => [f.technology?._id || f.technology, f])),
    [flags]
  );

  const declaredTechnologies = useMemo(
    () => allTechnologies.filter((t) => declaredIds.has(t._id)),
    [allTechnologies, declaredIds]
  );

  return {
    intern,
    allTechnologies,
    declaredIds,
    declaredTechnologies,
    flagMap,
    isLoadingTechnologies,
  };
}
