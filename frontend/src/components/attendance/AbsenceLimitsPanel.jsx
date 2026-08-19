import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PagePanel } from '@/components/PageShell';
import { cn } from '@/lib/utils';
import {
  useAbsenceRequestSettings,
  useUpdateAbsenceRequestSettings,
  useResetAbsenceRequestSettings,
} from '@/queries/absenceRequestSettings';
import { useAdminCandidates } from '@/queries/users';

// No admin is ever this id, so it is safe as the Select's "cleared" sentinel —
// Radix refuses an empty-string item value outright.
const NO_PRIMARY_ADMIN = 'none';

/**
 * How many days an intern may ask for, per kind of request. Admin only.
 *
 * The panel renders entirely from the server's payload — the four types, their
 * labels and descriptions, which of them have a yearly allowance at all, the
 * bounds, and what each ships as. Nothing about the types is written down here, so
 * adding a fifth is still a row in `server/constants/absenceRequestTypes.js` and
 * no change to this file.
 *
 * Remote work and sick days have no yearly allowance by design, and the panel says
 * so rather than showing an empty box: nothing should bound an intern's remote
 * days (exam week must not become a queue of refusals), and an intern who is ill
 * past a cap cannot be refused their illness.
 *
 * ── Why a stepper rather than a bare number field ────────────────────────────
 *
 * Every value here is a small whole number nudged by one, and the bounds are known
 * before the keystroke — so the buttons can refuse an out-of-range value instead of
 * accepting it and complaining afterwards. Typing still works, and still validates
 * the old way, because "set it to 10" should not be ten clicks.
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

// The four columns of the limits table, shared by the header band and every row so
// they cannot drift apart.
//
// The first track has a 180px floor, not `minmax(0, 1fr)`. A zero-minimum first
// column is free to collapse to nothing once the three fixed tracks and the gaps
// exceed the container, and the request-type label then overlaps the cell beside
// it. The floor plus the row's own `min-w` is what makes the panel scroll instead
// of overlap.
const ROW_GRID =
  'md:grid md:min-w-[640px] md:grid-cols-[minmax(180px,1fr)_10.5rem_10.5rem_5rem] md:items-start md:gap-4';

export function AbsenceLimitsPanel() {
  const { data: settings, isPending, isError } = useAbsenceRequestSettings();
  const updateSettings = useUpdateAbsenceRequestSettings();
  const resetSettings = useResetAbsenceRequestSettings();
  const { data: adminCandidates } = useAdminCandidates();

  const [draft, setDraft] = useState(null);
  const [primaryAdminId, setPrimaryAdminId] = useState(NO_PRIMARY_ADMIN);

  // Re-seed whenever the server's copy changes — on load, after a save, and after
  // a reset, which is what puts the defaults back in the boxes without the panel
  // having to know what they are.
  useEffect(() => {
    if (settings?.types) setDraft(draftFrom(settings.types));
    if (settings) setPrimaryAdminId(settings.primaryAdmin?.id || NO_PRIMARY_ADMIN);
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
      <PagePanel className="px-5 py-6 text-sm text-[hsl(var(--tone-danger-fg))] md:px-6">
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

  const primaryAdminDirty = primaryAdminId !== (settings.primaryAdmin?.id || NO_PRIMARY_ADMIN);

  // Kept apart from `isDirty` below: "Reset to defaults" only ever touches the
  // per-type limits (see `resetSettings` — it never writes `primaryAdmin`), so
  // it must not light up for an unsaved primary-admin pick alone. Clicking it
  // would silently discard that pick (the draft re-seeds from the post-reset
  // settings, which still carry the old primaryAdmin) with a toast that never
  // mentions it.
  const limitsDirty = types.some((entry) => {
    const row = draft[entry.type];
    if (Number(row.maxDaysPerRequest) !== entry.maxDaysPerRequest) return true;
    return entry.budgeted && Number(row.yearlyBudget) !== entry.yearlyBudget;
  });

  const isDirty = primaryAdminDirty || limitsDirty;

  const isBusy = updateSettings.isPending || resetSettings.isPending;
  const isCustomised = types.some((entry) => !entry.isDefault);

  const setField = (type, field, value) =>
    setDraft((current) => ({
      ...current,
      [type]: { ...current[type], [field]: value },
    }));

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

    updateSettings.mutate({
      limits,
      ...(primaryAdminDirty
        ? { primaryAdmin: primaryAdminId === NO_PRIMARY_ADMIN ? null : primaryAdminId }
        : {}),
    });
  };

  const stepper = (entry, field, label) => {
    const value = draft[entry.type][field];
    const { min, max } = bounds[field];
    const showsError = fieldError(entry, field);
    const id = `limit-${entry.type}-${field}`;
    const current = Number(value);

    // A step is only offered where it lands somewhere legal — an empty or
    // half-typed box has no number to step from, so both buttons rest.
    const canStep = Number.isInteger(current);
    const step = (delta) => setField(entry.type, field, String(current + delta));

    const stepButton = (delta, Icon, verb) => (
      <button
        type="button"
        onClick={() => step(delta)}
        disabled={!canStep || current + delta < min || current + delta > max}
        aria-label={`${verb} ${entry.label.toLowerCase()} ${label}`}
        className="flex h-full w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    );

    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className="text-xs font-normal text-muted-foreground md:sr-only">
          {entry.label}: {label}
        </label>
        <div
          className={cn(
            'inline-flex h-9 items-center overflow-hidden rounded-[var(--r-control)] border bg-background focus-within:ring-1 focus-within:ring-ring',
            showsError ? 'border-destructive' : 'border-input'
          )}
        >
          {stepButton(-1, Minus, 'Decrease')}
          <input
            id={id}
            type="text"
            inputMode="numeric"
            value={value}
            aria-invalid={showsError || undefined}
            onChange={(e) => setField(entry.type, field, e.target.value.replace(/[^\d]/g, ''))}
            className="h-full w-12 border-x border-input bg-transparent text-center text-sm font-medium tabular-nums outline-none"
            data-test={`limit-${entry.type}-${field}-input`}
          />
          {stepButton(1, Plus, 'Increase')}
        </div>
        {showsError ? (
          <p className="text-xs text-[hsl(var(--tone-danger-fg))]">
            {min}–{max} days.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Default {entry.defaults[field]}</p>
        )}
      </div>
    );
  };

  return (
    <PagePanel>
      <form onSubmit={handleSave}>
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 md:px-5">
          <div className="min-w-0 space-y-1">
            <h2 className="text-[15px] font-semibold leading-tight">Absence request limits</h2>
            <p className="text-[13px] text-muted-foreground">
              How many days an intern can ask for, per kind of request. Applies to every hub.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isBusy || (!isCustomised && !limitsDirty)}
            onClick={() => resetSettings.mutate()}
            data-test="limits-reset-button"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to defaults
          </Button>
        </div>

        {/* Who an unaddressed request falls back to. Its own row rather than a
            fifth column in the table below — it applies once, to the whole
            feature, not per type. */}
        <div className="space-y-1.5 border-t border-separator px-4 py-4 md:px-5">
          <Label htmlFor="primary-admin-select" className="text-sm font-medium text-foreground">
            Primary admin
          </Label>
          <p className="text-xs text-muted-foreground">
            Who a request is addressed to when the intern doesn&apos;t pick someone else. They can
            always choose a different admin instead — for example, when the primary admin is away.
          </p>
          <Select value={primaryAdminId} onValueChange={setPrimaryAdminId} disabled={isBusy}>
            <SelectTrigger
              id="primary-admin-select"
              className="mt-1.5 max-w-xs"
              data-test="primary-admin-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PRIMARY_ADMIN}>No default — interns must choose</SelectItem>
              {(adminCandidates?.users || []).map((admin) => (
                <SelectItem key={admin._id} value={admin._id}>
                  {admin.fullname}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className={cn(
            'hidden border-y border-separator bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:px-5',
            ROW_GRID
          )}
        >
          <span>Request</span>
          <span>Days per request</span>
          <span>Days per year</span>
          <span className="text-right">State</span>
        </div>

        <div className="divide-y divide-separator border-b border-separator">
          {types.map((entry) => (
            <div key={entry.type} className={cn('gap-3 px-4 py-4 md:px-5', ROW_GRID)}>
              <div className="min-w-0 space-y-0.5 md:pt-1.5">
                <div className="text-sm font-medium">{entry.label}</div>
                {entry.description && (
                  <p className="text-xs text-muted-foreground">{entry.description}</p>
                )}
              </div>

              {stepper(entry, 'maxDaysPerRequest', 'days per request')}

              {entry.budgeted ? (
                stepper(entry, 'yearlyBudget', 'days per year')
              ) : (
                <div className="text-sm text-muted-foreground md:pt-1.5">
                  No yearly limit
                  <p className="text-xs">By design</p>
                </div>
              )}

              {/* Which rows are still as shipped, at a glance — the answer to "did
                  someone change this?" without diffing four numbers against their
                  defaults by eye. */}
              <div className="md:pt-1.5 md:text-right">
                <Badge
                  variant={entry.isDefault ? 'outline' : 'info'}
                  data-test={`limit-${entry.type}-state`}
                >
                  {entry.isDefault ? 'Default' : 'Custom'}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 px-4 py-3 md:px-5">
          <p className="text-xs text-muted-foreground">
            Changing a limit binds what is asked for next — requests already decided keep what they
            were granted.
            {settings.updatedAt
              ? ` Last changed ${format(new Date(settings.updatedAt), 'd MMM yyyy')}${
                  settings.updatedBy ? ` by ${settings.updatedBy}` : ''
                }.`
              : ''}
          </p>

          {/* Only once there is something to save. At rest the footer is a sentence
              of guidance, and a permanently greyed-out button beside it would say
              nothing the disabled state doesn't. */}
          {isDirty && (
            <Button
              type="submit"
              size="sm"
              className="h-9"
              disabled={isBusy || hasError}
              data-test="limits-save-button"
            >
              {updateSettings.isPending ? 'Saving…' : 'Save limits'}
            </Button>
          )}
        </div>
      </form>
    </PagePanel>
  );
}
