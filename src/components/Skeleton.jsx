/** Skeleton loading cards */
export function RepoCardSkeleton() {
  return (
    <div className="glass p-5">
      <div className="flex items-center gap-3">
        <div className="shimmer-line h-10 w-10 !rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="shimmer-line h-4 w-2/3" />
          <div className="shimmer-line h-3 w-1/3" />
        </div>
      </div>
      <div className="shimmer-line mt-4 h-3 w-full" />
      <div className="shimmer-line mt-2 h-3 w-5/6" />
      <div className="mt-4 flex gap-2">
        <div className="shimmer-line h-6 w-16 !rounded-full" />
        <div className="shimmer-line h-6 w-16 !rounded-full" />
        <div className="shimmer-line h-6 w-16 !rounded-full" />
      </div>
    </div>
  );
}

export function LineSkeleton({ className = "" }) {
  return <div className={`shimmer-line h-4 ${className}`} />;
}
