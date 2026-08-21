/**
 * FROZEN — the pre-overhaul ticket list, kept byte-for-byte from the commit before
 * the UI overhaul and used by `UserDashboard` alone.
 *
 * The dashboards are explicitly out of the overhaul's scope and have to render
 * exactly as they did; the list they embed is shared with Tickets/Archive/Backlog,
 * which the overhaul does change. Rather than branch the shared components on a
 * prop — which the next person would quietly re-couple — the old version lives
 * here, once, and nothing else imports it.
 *
 * Do not "tidy" this file: any edit here is a change to a dashboard.
 */
export default function LegacyTicketsState({
  isLoading,
  isError,
  isEmpty,
  emptyMessage = 'No results.',
  loadingSlot = null,
  children,
}) {
  if (isLoading) {
    if (loadingSlot) return loadingSlot;
    return (
      <div className="flex items-center justify-center h-64 font-medium text-muted-foreground">
        Loading tickets...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-[hsl(var(--tone-danger))]">
        Something went wrong.
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="app-panel flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 rounded-xl border border-border bg-muted" />
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return children;
}
