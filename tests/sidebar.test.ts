import { describe, expect, it } from "vitest";
import { sectionOf } from "@/components/sidebar-nav";

describe("which section of a case a path is in", () => {
  const base = "/cases/GIQ-26-983BH5G2";
  it("treats the bare case path as the overview", () => {
    expect(sectionOf(base, base)).toBe("overview");
  });
  it("finds the section from the first segment, including the add-document pages below it", () => {
    expect(sectionOf(`${base}/documents`, base)).toBe("documents");
    expect(sectionOf(`${base}/documents/new/shipping-bill`, base)).toBe("documents");
    expect(sectionOf(`${base}/checks`, base)).toBe("checks");
    expect(sectionOf(`${base}/people`, base)).toBe("people");
  });
  it("is not in a case it is not in, even one that shares a prefix", () => {
    expect(sectionOf("/dashboard", base)).toBeNull();
    expect(sectionOf("/cases/new", base)).toBeNull();
    expect(sectionOf("/cases/GIQ-26-983BH5G2X/documents", base)).toBeNull();
  });
});
