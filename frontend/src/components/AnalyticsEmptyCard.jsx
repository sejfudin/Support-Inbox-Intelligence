import { ChartNoAxesCombined } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AnalyticsEmptyCard({ title, description }) {
  return (
    <Card className="app-panel">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-[260px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/80 bg-muted/30 text-muted-foreground">
          <ChartNoAxesCombined className="h-8 w-8 opacity-50" />
          <p className="text-sm font-medium">No activity in selected period</p>
          <p className="text-xs">Try a longer date range or create/update tickets.</p>
        </div>
      </CardContent>
    </Card>
  );
}
