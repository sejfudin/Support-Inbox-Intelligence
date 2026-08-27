import { cn } from '@/lib/utils';
import { TechnologyIcon } from '@/helpers/technologyIcons';
import { splitByCategory } from '@/helpers/technologyCategories';

/** One row of outline chips. Both halves are drawn by this. */
function ChipRow({ technologies }) {
  return (
    <div className="flex flex-wrap gap-[7px]">
      {technologies.map((tech) => (
        <span
          key={tech._id || tech}
          // Outline, not a tint: these are the candidate's own declarations, not a
          // status, and a tinted pill here competes with the readiness chips that
          // carry real signal on the next tab.
          className="inline-flex items-center gap-1.5 rounded-full border border-separator px-[11px] py-[5px] text-[12px] font-medium text-foreground"
        >
          {typeof tech === 'object' && (
            <TechnologyIcon technology={tech} size={13} className="shrink-0" />
          )}
          {tech.name || tech}
        </span>
      ))}
    </div>
  );
}

const GROUP_LABEL_CLASS =
  'mb-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/75';

/**
 * The skills a candidate declared for themselves.
 *
 * Each chip carries its brand logo. The list is scanned, not read — an admin
 * opening a profile is checking "is this a React person or a .NET person", and a
 * logo answers that before the word does. `selfTechnologies` arrives populated
 * with `slug` and `category` (see `internService`'s populate), which is what the
 * icon map and the split below key off; a plain string still renders, just
 * without a logo and always in the technologies half.
 *
 * The AI skills get their own labelled row once there are any — half a dozen agent
 * tools scattered alphabetically through thirty frameworks is exactly the question
 * this card is being scanned for and the hardest thing to answer from one cloud.
 * With none declared the labels would be chrome around a single row, so they only
 * appear when the second half is non-empty.
 */
export function InternDeclaredTechnologies({ technologies: declared = [], className }) {
  const { technologies, aiSkills } = splitByCategory(declared);

  if (declared.length === 0) {
    return (
      <p className={cn('text-[12.5px] text-muted-foreground', className)}>None declared yet.</p>
    );
  }

  if (aiSkills.length === 0) {
    return (
      <div className={className}>
        <ChipRow technologies={technologies} />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3.5', className)}>
      {technologies.length > 0 && (
        <div>
          <p className={GROUP_LABEL_CLASS}>Technologies</p>
          <ChipRow technologies={technologies} />
        </div>
      )}
      <div>
        <p className={GROUP_LABEL_CLASS}>AI skills</p>
        <ChipRow technologies={aiSkills} />
      </div>
    </div>
  );
}
