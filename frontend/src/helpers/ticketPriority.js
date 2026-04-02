import { AlertCircle, Minus, ArrowUp, ArrowDown } from "lucide-react";

export const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const PRIORITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    className: "text-red-500",
    dot: "bg-red-500",
    badge: "bg-red-100 text-red-700 hover:bg-red-200",
    label: "Critical",
    showAlways: true,
  },
  high: {
    icon: ArrowUp,
    className: "text-orange-500",
    dot: "bg-orange-500",
    badge: "bg-orange-100 text-orange-700 hover:bg-orange-200",
    label: "High",
    showAlways: true,
  },
  medium: {
    icon: Minus,
    className: "text-blue-500",
    dot: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700 hover:bg-blue-200",
    label: "Medium",
    showAlways: true,
  },
  low: {
    icon: ArrowDown,
    className: "text-slate-400",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    label: "Low",
    showAlways: true,
  },
};

export const getPriorityLabel = (priority) => {
  const option = PRIORITY_OPTIONS.find((p) => p.value === priority?.toLowerCase());
  return option?.label || priority || "Medium";
};
