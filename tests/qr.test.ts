import { describe, expect, it } from "vitest";
import { parseQr, qrAppliesTo, qrDateToIso } from "@/lib/qr/parse";

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function signedQr(data: Record<string, unknown>) {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ data: JSON.stringify(data), iss: "NIC" }));
  return `${header}.${payload}.c2lnbmF0dXJl`;
}

const IRN = "a".repeat(32) + "0123456789abcdef0123456789abcdef";

describe("e-invoice QR", () => {
  it("reads the signed QR's payload into invoice fields", () => {
    const r = parseQr(
      signedQr({
        SellerGstin: "27ABCDE1234F1Z5",
        BuyerGstin: "URP",
        DocNo: "inv/26/001",
        DocTyp: "INV",
        DocDt: "30/10/2026",
        TotInvVal: 1250000,
        ItemCnt: 1,
        MainHsnCode: "39011010",
        Irn: IRN,
        IrnDt: "2026-10-30 11:02:00",
      }),
    );
    expect(r.kind).toBe("e_invoice");
    expect(r.values).toEqual({ invoiceNumber: "INV/26/001", invoiceDate: "2026-10-30", exporterGstin: "27ABCDE1234F1Z5", irn: IRN });
    expect(r.extras["Main HSN code"]).toBe("39011010");
    expect(r.extras["Invoice total (INR)"]).toBe("1250000");
    expect(r.signatureChecked).toBe(false);
    expect(qrAppliesTo(r, "commercial_invoice")).toBe(true);
    expect(qrAppliesTo(r, "eway_bill")).toBe(false);
  });

  it("ignores a three-part string that isn't a token", () => {
    expect(parseQr("a.b.c").kind).toBe("unknown");
  });
});

describe("e-way bill QR", () => {
  it("finds the number, GSTIN and date", () => {
    const r = parseQr("321008765432/27ABCDE1234F1Z5/05/11/2026 10:15:00 AM");
    expect(r.kind).toBe("eway_bill");
    expect(r.values).toEqual({ ewbNumber: "321008765432", fromGstin: "27ABCDE1234F1Z5", ewbDate: "2026-11-05" });
    expect(qrAppliesTo(r, "eway_bill")).toBe(true);
  });

  it("does not treat any 12-digit number as an e-way bill", () => {
    expect(parseQr("https://example.com/track/123456789012").kind).toBe("unknown");
  });
});

describe("qrDateToIso", () => {
  it("rejects impossible dates", () => {
    expect(qrDateToIso("31/02/2026")).toBeNull();
    expect(qrDateToIso("1-2-2026")).toBe("2026-02-01");
  });
});
