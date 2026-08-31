import { useMemo } from 'react';
import { useMyInternProfile, useMyInternReadiness } from '@/queries/interns';
import { useTechnologies } from '@/queries/technologies';
import { useLoaderHold } from '@/components/ui/loader';
import { splitByCategory } from '@/helpers/technologyCategories';

/**
 * The intern's own declared skills, in catalog order, each joined to the
 * readiness flag a mentor set on it.
 *
 * Returned three ways because the page needs all three: `declaredSkills` is everything
 * declared (what the readiness bar summarises), and the two halves below it are what the
 * technologies and AI skills sections list. The catalog is split the same way, one half per
 * search box.
 *
 * Shared by the declaration list and the readiness summary that sits beside it on
 * `/my-technologies`: both need the same profile → catalog → flags join, and all
 * three queries are cached under their own keys, so a second caller costs the
 * join and nothing else.
 */
export function useMyDeclaredTechnologies() {
  const {
    data: intern,
    isPending: isProfilePending,
    isError: isProfileError,
  } = useMyInternProfile();
  const { data: allTechnologies = [], isPending, isError } = useTechnologies();
  // Held here rather than at each caller: this is the flag both the declaration list and the
  // readiness summary render their loaders off, so gating it once covers every use.
  //
  // The profile is folded in because `declaredIds` is read off it: an edit made while the
  // profile is still pending would see an empty set and save a single-id `selfTechnologies`
  // over the real list. Both queries are cached under their own keys and fetched together on
  // this page, so waiting on the pair here rarely adds a visible beat.
  const isLoadingTechnologies = useLoaderHold(isPending || isProfilePending, {
    release: isError || isProfileError,
  });
  const { data: flags = [] } = useMyInternReadiness();

  // Set of declared tech IDs — fast lookup for "already declared?"
  //
  // Read off the profile populate, which is NOT filtered by `isActive`, while
  // `declaredTechnologies` below joins against the active catalog only. That gap is
  // load-bearing: a technology an admin deactivates stays declared but stops being
  // rendered, and the save posts this set. Derive the saved ids from the rendered
  // rows instead and every such declaration is silently dropped on the next edit.
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

  const declaredSkills = useMemo(
    () => allTechnologies.filter((t) => declaredIds.has(t._id)),
    [allTechnologies, declaredIds]
  );

  const catalog = useMemo(() => splitByCategory(allTechnologies), [allTechnologies]);
  const declared = useMemo(() => splitByCategory(declaredSkills), [declaredSkills]);

  return {
    intern,
    allTechnologies,
    catalogTechnologies: catalog.technologies,
    catalogAiSkills: catalog.aiSkills,
    declaredIds,
    declaredSkills,
    declaredTechnologies: declared.technologies,
    declaredAiSkills: declared.aiSkills,
    flagMap,
    isLoadingTechnologies,
  };
}
