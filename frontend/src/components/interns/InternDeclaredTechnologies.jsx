import { cn } from '@/lib/utils';
import { TechnologyIcon } from '@/helpers/technologyIcons';

/**
 * The stacks a candidate declared for themselves.
 *
 * Each chip carries its brand logo. The list is scanned, not read — an admin
 * opening a profile is checking "is this a React person or a .NET person", and a
 * logo answers that before the word does. `selfTechnologies` arrives populated
 * with `slug` (see `internService`'s populate), which is what the icon map keys
 * off, so no reference-data lookup is needed here; a plain string still renders,
 * just without a logo.
 */
export function InternDeclaredTechnologies({ technologies = [], className }) {
  return (
    <div className={cn('flex flex-wrap gap-[7px]', className)}>
      {technologies.length === 0 && (
        <p className="text-[12.5px] text-muted-foreground">None declared yet.</p>
      )}
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
