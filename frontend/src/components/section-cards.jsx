import { TrendingDownIcon, TrendingUpIcon, MinusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SectionCards({ stats, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 px-4 lg:grid-cols-4 lg:px-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="@container/card">
            <CardHeader className="relative">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-28" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "My Active Tickets",
      value: stats?.activeTickets || 0,
      trend: stats?.activeTrend || 0,
      description:
        stats?.activeTrend >= 0 ? "Increasing workload" : "Workload decreasing",
      footer: "Assigned to you (not done)",
    },
    {
      title: "In Progress",
      value: stats?.inProgress || 0,
      trend: stats?.inProgressTrend || 0,
      description:
        stats?.inProgressTrend > 0 ? "Active development" : "Low activity",
      footer: "Currently being worked on",
    },
    {
      title: "Completed This Month",
      value: stats?.completedThisMonth || 0,
      trend: stats?.completedTrend || 0,
      description:
        stats?.completedTrend >= 0 ? "Great progress" : "Below last month",
      footer: `Tickets completed in ${stats?.monthLabel || "this month"}`,
    },
    {
      title: "Blocked",
      value: stats?.blocked || 0,
      trend: stats?.blockedTrend || 0,
      description:
        stats?.blockedTrend <= 0 ? "Issues being resolved" : "Needs attention",
      footer: "Tickets needing unblock",
    },
  ];

  return (
    <div className="*:data-[slot=card]:shadow-xs grid grid-cols-2 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:grid-cols-4 lg:px-6">
      {cards.map((card, index) => {
        const isPositive = card.trend > 0;
        const isNegative = card.trend < 0;
        const TrendIcon = isPositive
          ? TrendingUpIcon
          : isNegative
            ? TrendingDownIcon
            : MinusIcon;
        const trendColor = isPositive
          ? "text-green-600"
          : isNegative
            ? "text-red-600"
            : "text-gray-600";
        const bgColor = isPositive
          ? "bg-green-50"
          : isNegative
            ? "bg-red-50"
            : "bg-gray-50";

        return (
          <Card key={index} className="@container/card">
            <CardHeader className="relative">
              <CardDescription>{card.title}</CardDescription>
              <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
                {card.value}
              </CardTitle>
              {card.trend !== 0 && (
                <div className="absolute right-4 top-4">
                  <Badge
                    variant="outline"
                    className={`flex gap-1 rounded-lg text-xs ${bgColor} ${trendColor} border-current`}
                  >
                    <TrendIcon className="size-3" />
                    {isPositive ? "+" : ""}
                    {card.trend}
                  </Badge>
                </div>
              )}
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                {card.description}
              </div>
              <div className="text-muted-foreground">{card.footer}</div>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
