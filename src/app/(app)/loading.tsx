export default function Loading() {
  return (
    <div className="animate-fade-in space-y-4 [&>*]:animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-72 rounded-md bg-surface" />
      <div className="h-4 w-96 max-w-full rounded-md bg-surface" />
      <div className="h-48 rounded-lg bg-surface" />
    </div>
  );
}
