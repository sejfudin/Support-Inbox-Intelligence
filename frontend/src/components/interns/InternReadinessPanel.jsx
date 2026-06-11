import { InternPanel } from '@/components/interns/InternPanel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTechnologies } from '@/queries/technologies';
import { useInternReadiness, useUpsertInternReadiness } from '@/queries/interns';
import { getReadinessLabel, READINESS_LEVELS } from '@/helpers/internProfile';
import { useAuth } from '@/context/AuthContext';
import { canWriteInternMentorData } from '@/helpers/roles';
import { toast } from 'sonner';

export function InternReadinessPanel({ userId, declaredTechnologies = [], readOnly = false }) {
  const { user } = useAuth();
  const canWrite = !readOnly && canWriteInternMentorData(user?.role);
  const { data: technologies = [] } = useTechnologies();
  const { data: flags = [], isPending } = useInternReadiness(userId);
  const { mutate } = useUpsertInternReadiness();

  const flagMap = Object.fromEntries(flags.map((f) => [f.technology?._id || f.technology, f]));

  const handleLevelChange = (technologyId, level) => {
    if (!canWrite) return;
    mutate(
      { userId, payload: { technologyId, level } },
      {
        onSuccess: () => toast.success('Readiness updated'),
        onError: (err) => toast.error(err?.response?.data?.message || 'Failed to update readiness'),
      }
    );
  };

  return (
    <div className="space-y-6">
      {declaredTechnologies.length > 0 && (
        <InternPanel>
          <h3 className="text-lg font-semibold">Declared technologies</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Technologies the intern selected on their profile.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {declaredTechnologies.map((tech) => (
              <span
                key={tech._id || tech}
                className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-sm font-medium"
              >
                {tech.name || tech}
              </span>
            ))}
          </div>
        </InternPanel>
      )}

      <InternPanel className="overflow-hidden p-0">
        <div className="border-b border-border/60 px-5 py-4 md:px-6">
          <h3 className="text-lg font-semibold">Placement readiness by technology</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Mentor-assessed readiness for client placement tracks.
          </p>
        </div>
        {isPending && (
          <p className="px-5 py-6 text-sm text-muted-foreground md:px-6">Loading readiness...</p>
        )}
        {!isPending && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-border/60 bg-muted/40">
                <tr>
                  <th className="px-5 py-3 font-semibold text-foreground md:px-6">Technology</th>
                  <th className="px-5 py-3 font-semibold text-foreground md:px-6">Readiness</th>
                  <th className="px-5 py-3 font-semibold text-foreground md:px-6">Set by</th>
                </tr>
              </thead>
              <tbody>
                {technologies.map((tech) => {
                  const flag = flagMap[tech._id];
                  const level = flag?.level || 'none';
                  return (
                    <tr key={tech._id} className="border-t border-border/60">
                      <td className="px-5 py-3 font-medium md:px-6">{tech.name}</td>
                      <td className="px-5 py-3 md:px-6">
                        {canWrite ? (
                          <Select
                            value={level}
                            onValueChange={(v) => handleLevelChange(tech._id, v)}
                          >
                            <SelectTrigger
                              className="h-9 w-40"
                              data-test={`intern-readiness-${tech.slug}-select`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {READINESS_LEVELS.map((r) => (
                                <SelectItem key={r.value} value={r.value}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          getReadinessLabel(level)
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground md:px-6">
                        {flag?.setBy?.fullname || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </InternPanel>
    </div>
  );
}
