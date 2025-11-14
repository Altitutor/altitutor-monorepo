export function MessageThreadSkeleton() {
  return (
    <div className="flex-1 p-4 space-y-4">
      {/* Inbound message skeleton */}
      <div className="flex gap-2 items-end">
        <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
        <div className="max-w-[80%] space-y-2">
          <div className="h-12 bg-muted rounded-md animate-pulse" />
          <div className="h-3 w-20 bg-muted rounded animate-pulse" />
        </div>
      </div>
      
      {/* Outbound message skeleton */}
      <div className="flex gap-2 items-end flex-row-reverse">
        <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
        <div className="max-w-[80%] space-y-2">
          <div className="h-16 bg-brand-lightBlue/50 rounded-md animate-pulse ml-auto" />
          <div className="h-3 w-24 bg-muted rounded animate-pulse ml-auto" />
        </div>
      </div>
      
      {/* Another inbound message */}
      <div className="flex gap-2 items-end">
        <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
        <div className="max-w-[80%] space-y-2">
          <div className="h-10 bg-muted rounded-md animate-pulse" />
          <div className="h-3 w-20 bg-muted rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}





