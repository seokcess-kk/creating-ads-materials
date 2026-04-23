import { PageContainer } from "@/components/layout/PageContainer";

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-muted/60 rounded-md ${className}`}
    />
  );
}

export default function Loading() {
  return (
    <PageContainer>
      <output className="sr-only" aria-live="polite">
        불러오는 중...
      </output>

      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-14" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/60 p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="h-3 w-1/2" />
            <div className="space-y-1.5 pt-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
