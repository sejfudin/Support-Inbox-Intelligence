import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PagePanel } from '@/components/PageShell';
import {
  useAttendanceRequestSettings,
  useUpdateAttendanceRequestSettings,
  useResetAttendanceRequestSettings,
} from '@/queries/attendanceRequestSettings';

/**
 * How many days an intern may ask for, per kind of request. Admin only.
 *
 * The panel renders entirely from the server's payload — the four types, their
 * labels, which of them have a yearly allowance at all, the bounds, and what each
 * ships as. Nothing about the types is written down here, so adding a fifth is
 * still a row in `server/constants/attendanceRequestTypes.js` and no change to
 * this file.
 *
 * Remote work and sick days have no yearly allowance by design, and the panel says
 * so rather than showing an empty box: nothing should bound an intern's remote
 * days (exam week must not become a queue of refusals), and an intern who is ill
 * past a cap cannot be refused their illness.
 */

// Kept as strings while editing so a field can be empty mid-keystroke instead of
// snapping to 0 the moment the last digit is deleted.
const draftFrom = (types) =>
  Object.fromEntries(
    types.map((entry) => [
      entry.type,
      {
        maxDaysPerRequest: String(entry.maxDaysPerRequest),
        yearlyBudget: entry.budgeted ? String(entry.yearlyBudget) : '',
      },
    ])
  );

const outOfBounds = (raw, { min, max }) => {
  const value = Number(raw);
  return raw.trim() === '' || !Number.isInteger(value) || value < min || value > max;
};

export function AttendanceLimitsPanel() {
  const { data: settings, isPending, isError } = useAttendanceRequestSettings();
  const updateSettings = useUpdateAttendanceRequestSettings();
  const resetSettings = useResetAttendanceRequestSettings();

  const [draft, setDraft] = useState(null);

  // Re-seed whenever the server's copy changes — on load, after a save, and after
  // a reset, which is what puts the defaults back in the boxes without the panel
  // having to know what they are.
  useEffect(() => {
    if (settings?.types) setDraft(draftFrom(settings.types));
  }, [settings]);

  if (isPending) {
    return (
      <PagePanel className="px-5 py-6 text-sm text-muted-foreground md:px-6">
        Loading request limits…
      </PagePanel>
    );
  }

  if (isError || !settings || !draft) {
    return (
      <PagePanel className="px-5 py-6 text-sm text-destructive md:px-6">
        Could not load the request limits.
      </PagePanel>
    );
  }

  const { bounds, types } = settings;

  const fieldError = (entry, field) =>
    field === 'yearlyBudget' && !entry.budgeted
      ? false
      : outOfBounds(draft[entry.type][field], bounds[field]);

  const hasError = types.some(
    (entry) => fieldError(entry, 'maxDaysPerRequest') || fieldError(entry, 'yearlyBudget')
  );

  const isDirty = types.some((entry) => {
    const row = draft[entry.type];
    if (Number(row.maxDaysPerRequest) !== entry.maxDaysPerRequest) return true;
    return entry.budgeted && Number(row.yearlyBudget) !== entry.yearlyBudget;
  });

  const isBusy = updateSettings.isPending || resetSettings.isPending;
  const isCustomised = types.some((entry) => !entry.isDefault);

  const handleSave = (e) => {
    e.preventDefault();
    if (hasError || !isDirty) return;

    const limits = Object.fromEntries(
      types.map((entry) => {
        const row = draft[entry.type];
        return [
          entry.type,
          {
            maxDaysPerRequest: Number(row.maxDaysPerRequest),
            // Omitted, not nulled: the server refuses a yearly allowance on a type
            // that has none rather than quietly dropping it.
            ...(entry.budgeted ? { yearlyBudget: Number(row.yearlyBudget) } : {}),
          },
        ];
      })
    );

    updateSettings.mutate({ limits });
  };

  const numberField = (entry, field, label) => {
    const value = draft[entry.type][field];
    const { min, max } = bounds[field];
    const showsError = fieldError(entry, field);
    const id = `limit-${entry.type}-${field}`;

    return (
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-xs font-normal text-muted-foreground md:sr-only">
          {entry.label}: {label}
        </Label>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          aria-invalid={showsError || undefined}
          onChange={(e) =>
            setDraft((current) => ({
              ...current,
              [entry.type]: { ...current[entry.type], [field]: e.target.value },
            }))
          }
          className="w-full"
          data-test={`limit-${entry.type}-${field}-input`}
        />
        {showsError ? (
          <p className="text-xs text-destructive">
            {min}–{max} days.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Default {entry.defaults[field]}</p>
        )}
      </div>
    );
  };

  return (
    <PagePanel className="px-5 py-6 md:px-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-base font-semibold leading-tight">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          Attendance request limits
        </div>
        <p className="text-sm text-muted-foreground">
          How many days an intern can ask for, per kind of request. Changing a limit binds what is
          asked for next — requests already decided keep what they were granted.
        </p>
      </div>

      <form className="mt-6 space-y-6" onSubmit={handleSave}>
        <div className="hidden gap-4 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[1fr_9rem_9rem]">
          <span>Request</span>
          <span>Days per request</span>
          <span>Days per year</span>
        </div>

        <div className="space-y-4">
          {types.map((entry) => (
            <div
              key={entry.type}
              className="grid gap-3 rounded-lg border bg-muted/20 px-4 py-4 md:grid-cols-[1fr_9rem_9rem] md:items-start md:gap-4 md:border-0 md:bg-transparent md:px-1 md:py-0"
            >
              <div className="text-sm font-medium md:pt-2">{entry.label}</div>

              {numberField(entry, 'maxDaysPerRequest', 'days per request')}

              {entry.budgeted ? (
                numberField(entry, 'yearlyBudget', 'days per year')
              ) : (
                <div className="text-sm text-muted-foreground md:pt-2">
                  No yearly limit
                  <p className="text-xs">By design</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {settings.updatedAt
              ? `Last changed ${format(new Date(settings.updatedAt), 'd MMM yyyy')}${
                  settings.updatedBy ? ` by ${settings.updatedBy}` : ''
                }.`
              : 'Never changed — running on the shipped defaults.'}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={isBusy || (!isCustomised && !isDirty)}
              onClick={() => resetSettings.mutate()}
              data-test="limits-reset-button"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to defaults
            </Button>
            <Button
              type="submit"
              disabled={isBusy || hasError || !isDirty}
              data-test="limits-save-button"
            >
              {updateSettings.isPending ? 'Saving…' : 'Save limits'}
            </Button>
          </div>
        </div>
      </form>
    </PagePanel>
  );
}
