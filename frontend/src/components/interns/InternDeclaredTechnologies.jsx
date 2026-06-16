import { cn } from '@/lib/utils';

export function InternDeclaredTechnologies({ technologies = [], className }) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {technologies.length === 0 && (
        <p className="text-sm text-muted-foreground">None declared yet.</p>
      )}
      {technologies.map((tech) => (
        <span
          key={tech._id || tech}
          className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-sm"
        >
          {tech.name || tech}
        </span>
      ))}
    </div>
  );
}
