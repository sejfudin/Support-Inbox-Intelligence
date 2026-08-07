export function TicketCategoryField({ isArchived, categories, currentCategory, onCategoryChange }) {
  if (isArchived) {
    const selected = categories.find((c) => String(c._id) === String(currentCategory));
    if (!selected) {
      return (
        <div className="mt-2">
          <span className="text-sm text-muted-foreground">None</span>
        </div>
      );
    }
    return (
      <div className="mt-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold text-background"
          style={{ backgroundColor: selected.color, borderColor: selected.color }}
        >
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.7)' }}
          />
          {selected.name}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      <button
        type="button"
        onClick={() => onCategoryChange(null)}
        data-test="ticket-modal-category-option-none"
        className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
          currentCategory === null
            ? 'bg-foreground text-background border-foreground'
            : 'bg-muted text-muted-foreground border-border hover:bg-muted'
        }`}
      >
        None
      </button>
      {categories.map((cat) => (
        <button
          key={cat._id}
          type="button"
          onClick={() => onCategoryChange(cat._id)}
          data-test={`ticket-modal-category-option-${cat._id}`}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
            currentCategory === cat._id
              ? 'text-background border-transparent'
              : 'bg-muted text-foreground border-border hover:bg-muted'
          }`}
          style={
            currentCategory === cat._id
              ? { backgroundColor: cat.color, borderColor: cat.color }
              : {}
          }
        >
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{
              backgroundColor: currentCategory === cat._id ? 'rgba(255,255,255,0.7)' : cat.color,
            }}
          />
          {cat.name}
        </button>
      ))}
    </div>
  );
}
