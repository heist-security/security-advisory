import { Skeleton } from "./ui/skeleton";

export function FeedSkeleton() {
  return (
    <section
      className="mb-8 space-y-3"
      aria-label="Security announcements"
      aria-busy="true"
    >
      <p role="status" className="sr-only">
        Loading advisories…
      </p>
      <div aria-hidden="true" className="space-y-3">
        <div className="border-b pb-3">
          <Skeleton className="h-4 w-28" />
        </div>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-lg border p-5">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-6 w-3/4 max-w-lg" />
            <Skeleton className="h-3 w-1/2 max-w-xs" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </section>
  );
}
