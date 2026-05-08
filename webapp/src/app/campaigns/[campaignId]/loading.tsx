import { PageContainer } from "@/components/layout/PageContainer";

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-muted/60 rounded-md ${className}`}
    />
  );
}

export default function CampaignDetailLoading() {
  return (
    <PageContainer size="wide">
      <output className="sr-only" aria-live="polite">
        캠페인 불러오는 중...
      </output>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-12" />
        <span className="text-muted-foreground/40">/</span>
        <Skeleton className="h-3 w-20" />
        <span className="text-muted-foreground/40">/</span>
        <Skeleton className="h-3 w-24" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 min-w-0 flex-1">
          <Skeleton className="h-7 w-72" />
          <div className="flex flex-wrap gap-2 pt-1">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-14" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 shrink-0" />
      </div>

      {/* MaterialSwitcher */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-3 w-24" />
          <div className="flex gap-1">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-7 w-32" />
        </div>
      </div>

      {/* Meta panels */}
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-12 w-full" />

      {/* Stepper navbar */}
      <div className="flex items-center gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 shrink-0" />
        ))}
      </div>

      {/* Active stage content */}
      <div className="rounded-xl border border-border/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-border/60 p-4 space-y-3"
            >
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
