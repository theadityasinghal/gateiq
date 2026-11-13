/** Shown while a case loads: its header, section tabs and a card, so the page doesn't jump when it arrives. */
export default function CaseLoading() {
  return (
    <div className="animate-fade-in space-y-6 [&>*]:animate-pulse" aria-busy="true" aria-label="Loading the case">
      <div className="space-y-3">
        <div className="h-3 w-16 rounded bg-surface" />
        <div className="h-9 w-72 rounded-md bg-surface" />
        <div className="h-5 w-48 rounded-md bg-surface" />
      </div>
      <div className="h-11 rounded-md bg-surface lg:hidden" />
      <div className="h-44 rounded-lg bg-surface" />
      <div className="h-64 rounded-lg bg-surface" />
    </div>
  );
}
