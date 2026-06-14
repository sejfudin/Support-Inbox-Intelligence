export function FunnelRow({ label, count, total }) {
  const width = total > 0 ? Math.max(6, (count / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="capitalize">{label}</span>
        <span className="tabular-nums text-muted-foreground">{count}</span>
      </div>
      <div className="symphony-bar-track">
        <div className="symphony-bar-fill" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
