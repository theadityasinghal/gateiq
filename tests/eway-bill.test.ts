import { describe, expect, it } from "vitest";
import { ewayBillSchema } from "@/lib/case-schema";
import { normalizeEwayBill, normalizeVehicleNumber } from "@/lib/normalize/eway-bill";

const form = {
  ewbNumber: "1810 0123 4567",
  ewbDate: "2026-11-02",
  validUntil: "2026-11-05",
  fromGstin: "27aapfu0939f1zv",
  toGstin: "urp",
  fromPincode: "411001",
  toPincode: "400707",
  docType: "INV",
  docNumber: "inv/26/104",
  docDate: "2026-11-01",
  transportMode: "ROAD",
  distanceKm: "152",
  transporterId: "",
  vehicleNumber: "mh 04-ab 1234",
  lines: [{ description: " Coffee  beans ", hsCode: "0901", quantity: "9800", uqc: "KGS", value: "4200000" }],
};

describe("e-way bill", () => {
  it("accepts a typical export e-way bill and tidies identifiers", () => {
    const r = ewayBillSchema.safeParse(form);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.ewbNumber).toBe("181001234567");
    expect(r.data.toGstin).toBe("URP");
    expect(r.data.vehicleNumber).toBe("MH04AB1234");
    expect(r.data.transporterId).toBeNull();
  });

  it("lets Part B wait: vehicle number is optional", () => {
    expect(ewayBillSchema.safeParse({ ...form, vehicleNumber: "" }).success).toBe(true);
  });

  it("rejects bad numbers, GSTINs, plates and dates", () => {
    const bad = (patch: Record<string, unknown>, path: string) => {
      const r = ewayBillSchema.safeParse({ ...form, ...patch });
      expect(r.success).toBe(false);
      expect(r.error?.issues.some((i) => i.path.join(".") === path)).toBe(true);
    };
    bad({ ewbNumber: "12345" }, "ewbNumber");
    bad({ toGstin: "NOTAGSTIN" }, "toGstin");
    bad({ vehicleNumber: "1234" }, "vehicleNumber");
    bad({ docDate: "2026-11-03" }, "docDate");
    bad({ validUntil: "2026-11-01" }, "validUntil");
  });

  it("normalises into the standard record", () => {
    const parsed = ewayBillSchema.parse(form);
    const { normalized } = normalizeEwayBill(parsed);
    expect(normalized.documentNumber).toBe("181001234567");
    expect(normalized.invoice).toEqual({ type: "INV", number: "INV/26/104", date: "2026-11-01" });
    expect(normalized.transport.vehicleNumber).toBe("MH04AB1234");
    expect(normalized.lines[0].description).toBe("Coffee beans");
    expect(normalized.totals.value).toBe(4200000);
    expect(normalizeVehicleNumber("ka-01 ab-1234")).toBe("KA01AB1234");
  });
});
