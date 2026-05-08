/**
 * Skeleton placeholder for the support conversation while the first sync is
 * in flight. Replaces the previous blank-page-with-spinner experience: the
 * bubble dimensions roughly match real messages so there's no layout shift
 * when real data arrives.
 */
export function SupportSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-3 pb-4" aria-hidden="true">
      <div className="text-center py-1">
        <span className="inline-block h-3 w-20 rounded bg-gray-200/80 dark:bg-muted animate-pulse" />
      </div>
      <SkeletonBubble side="left" widthPct={68} />
      <SkeletonBubble side="left" widthPct={42} />
      <SkeletonBubble side="right" widthPct={56} />
      <SkeletonBubble side="left" widthPct={75} />
    </div>
  );
}

function SkeletonBubble({ side, widthPct }: { side: "left" | "right"; widthPct: number }) {
  const align = side === "right" ? "flex justify-end" : "flex justify-start";
  const tone =
    side === "right"
      ? "rounded-br-md bg-gradient-to-br from-blue-200 to-indigo-300 dark:from-blue-900/50 dark:to-indigo-900/50"
      : "rounded-bl-md bg-white dark:bg-card border border-gray-100 dark:border-border";
  return (
    <div className={align}>
      <div
        className={`max-w-[84%] rounded-2xl px-4 py-3 shadow-sm animate-pulse ${tone}`}
        style={{ width: `${widthPct}%` }}
      >
        <div className="mb-2 h-2.5 w-16 rounded bg-gray-300/60 dark:bg-white/10" />
        <div className="h-3 rounded bg-gray-300/70 dark:bg-white/15" />
        <div className="mt-1.5 h-3 w-4/5 rounded bg-gray-300/70 dark:bg-white/15" />
      </div>
    </div>
  );
}
