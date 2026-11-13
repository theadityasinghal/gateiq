export default function DashboardLoading() {
  return (
    <div className="animate-fade-in space-y-8 [&>*]:animate-pulse" aria-busy="true" aria-label="Loading your cases">
      <div className="space-y-3">
        <div className="h-3 w-24 rounded bg-surface" />
        <div className="h-9 w-64 rounded-md bg-surface" />
      </div>
      <div className="h-72 rounded-lg bg-surface" />
    </div>
  );
}
