export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-[720px] animate-fade-in space-y-4 [&>*]:animate-pulse" aria-busy="true" aria-label="Loading your profile">
      <div className="h-3 w-32 rounded bg-surface" />
      <div className="h-9 w-40 rounded-md bg-surface" />
      <div className="h-80 rounded-lg bg-surface" />
    </div>
  );
}
