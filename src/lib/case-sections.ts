/** The six sections of a case. They share one page: switching between them never asks the server for anything. */
export const CASE_SECTIONS = [
  { key: "overview", label: "Overview", path: "" },
  { key: "verified", label: "Verified info", path: "/verified" },
  { key: "documents", label: "Documents", path: "/documents" },
  { key: "checks", label: "Checks", path: "/checks" },
  { key: "people", label: "People & invites", path: "/people" },
  { key: "activity", label: "Activity", path: "/activity" },
] as const;

export type CaseSectionKey = (typeof CASE_SECTIONS)[number]["key"];

export const isCaseSection = (v: string): v is CaseSectionKey => CASE_SECTIONS.some((s) => s.key === v);

/** The section a `[[...section]]` URL segment names: none is the overview; anything unknown is null (not found). */
export function sectionFromSegments(segments: string[] | undefined): CaseSectionKey | null {
  if (!segments?.length) return "overview";
  if (segments.length > 1) return null;
  const key = segments[0];
  return key !== "overview" && isCaseSection(key) ? key : null;
}

/** Which section of a case a path is in: /cases/CODE is the overview, /cases/CODE/documents/new/… is documents. */
export function sectionOf(pathname: string, base: string): CaseSectionKey | null {
  if (pathname === base) return "overview";
  if (!pathname.startsWith(`${base}/`)) return null;
  const seg = pathname.slice(base.length + 1).split("/")[0];
  return isCaseSection(seg) ? seg : "overview";
}
