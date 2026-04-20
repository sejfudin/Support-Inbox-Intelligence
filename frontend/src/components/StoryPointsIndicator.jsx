import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { normalizeStoryPoints, getStoryPointsStyle } from "@/helpers/storyPoints";

export default function StoryPointsIndicator({ value }) {
  const points = normalizeStoryPoints(value);

  if (points === null) {
    return <span className="text-gray-300">-</span>;
  }

  const style = getStoryPointsStyle(points);

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold px-2.5 py-0.5 border shadow-none transition-none",
        style.indicator,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full mr-1", style.dot)} />
      SP {points}
    </Badge>
  );
}
