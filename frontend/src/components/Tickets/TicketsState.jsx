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
      <div className="flex items-center justify-center h-64 text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return children;
}
