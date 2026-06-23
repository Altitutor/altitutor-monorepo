import { Card, CardContent, CardHeader, Skeleton } from "@altitutor/ui";

export function LearningCatalogPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-[220px] w-full rounded-ucatShell" />
      {[1, 2].map((section) => (
        <Card key={section}>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            {[1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-10 w-full rounded-md" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
