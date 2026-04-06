export default function TicketsState({
  isLoading,
  isError,
  isEmpty,
  emptyMessage = "No results.",
  loadingSlot = null,
  children,
}) {
  if (isLoading) {
    if (loadingSlot) return loadingSlot;
    return (
      <div className="flex items-center justify-center h-64 font-medium text-gray-500">
        Loading tickets...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        Something went wrong.
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="app-panel flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 rounded-xl border border-slate-200 bg-slate-50" />
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return children;
}
