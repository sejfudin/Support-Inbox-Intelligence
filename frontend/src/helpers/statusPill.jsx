export const STATUS_STYLES = {
  todo: {
    pill: "bg-slate-50 text-slate-600",
    border: "border-slate-300",
  },
  inprogress: {
    pill: "bg-blue-50 text-blue-600",
    border: "border-blue-300",
  },
  blocked: {
    pill: "bg-red-50 text-red-600",
    border: "border-red-300",
  },
  staging: {
    pill: "bg-purple-50 text-purple-600",
    border: "border-purple-300",
  },
  done: {
    pill: "bg-green-50 text-green-600",
    border: "border-green-300",
  },
};

export function StatusPill({ status }) {

  const style = STATUS_STYLES[status] ?? STATUS_STYLES.todo;
  
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.pill}`}
    >
      {status}
    </span>
  );
}
