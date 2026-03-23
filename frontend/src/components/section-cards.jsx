import { TrendingDownIcon, TrendingUpIcon, MinusIcon, Activity, CircleDashed, CheckCircle2, AlertTriangle } from "lucide-react";

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
      <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
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
      icon: Activity,
      iconClassName: "bg-primary",
    },
    {
      title: "In Progress",
      value: stats?.inProgress || 0,
      trend: stats?.inProgressTrend || 0,
      description:
        stats?.inProgressTrend > 0 ? "Active development" : "Low activity",
      footer: "Currently being worked on",
      icon: CircleDashed,
      iconClassName: "bg-cyan-500",
    },
    {
      title: "Completed This Month",
      value: stats?.completedThisMonth || 0,
      trend: stats?.completedTrend || 0,
      description:
        stats?.completedTrend >= 0 ? "Great progress" : "Below last month",
      footer: `Tickets completed in ${stats?.monthLabel || "this month"}`,
      icon: CheckCircle2,
      iconClassName: "bg-emerald-500",
    },
    {
      title: "Blocked",
      value: stats?.blocked || 0,
      trend: stats?.blockedTrend || 0,
      description:
        stats?.blockedTrend <= 0 ? "Issues being resolved" : "Needs attention",
      footer: "Tickets needing unblock",
      icon: AlertTriangle,
      iconClassName: "bg-amber-500",
    },
  ];

  return (
    <div className="app-page-content grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <Card key={index} className="@container/card overflow-hidden border-white/70 bg-gradient-to-br from-white via-white to-primary/5">
            <CardHeader className="relative pb-3">
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${card.iconClassName}`}>
                <card.icon className="h-5 w-5 text-white" />
              </div>
              <CardDescription>{card.title}</CardDescription>
              <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
                {card.value}
              </CardTitle>
              {card.trend !== 0 && (
                <div className="absolute right-4 top-4">
                  <Badge
                    variant="outline"
                    className={`flex gap-1 rounded-full text-xs ${bgColor} ${trendColor} border-current`}
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
