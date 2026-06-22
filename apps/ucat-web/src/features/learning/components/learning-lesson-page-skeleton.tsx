import { Card, CardContent, CardHeader, Skeleton } from "@altitutor/ui";

export function LearningLessonPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-6">
          <div className="space-y-4">
            <Skeleton className="h-4 w-48" />
            <div className="flex items-start gap-3">
              <Skeleton className="size-9 shrink-0 rounded-ucatControl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-8 w-2/3 max-w-md" />
                <Skeleton className="h-4 w-full max-w-lg" />
              </div>
            </div>
          </div>
          <Skeleton className="h-[280px] w-full rounded-ucatShell" />
        </div>

        <aside className="flex w-full flex-col gap-3 lg:w-72 lg:shrink-0">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full rounded-ucatControl" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-20" />
            </CardHeader>
            <CardContent className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-8 w-full rounded-md" />
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
