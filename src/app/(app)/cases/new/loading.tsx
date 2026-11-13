export default function NewCaseLoading() {
  return (
    <div className="mx-auto max-w-[960px] animate-fade-in space-y-4 [&>*]:animate-pulse" aria-busy="true" aria-label="Loading the form">
      <div className="h-3 w-20 rounded bg-surface" />
      <div className="h-9 w-80 rounded-md bg-surface" />
      <div className="h-96 rounded-lg bg-surface" />
    </div>
  );
}
