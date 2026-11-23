import { describe, expect, it, vi } from "vitest";
import { createSign, generateKeyPairSync } from "node:crypto";

vi.mock("server-only", () => ({}));
const { verifyIrpJwt } = await import("@/server/einvoice/verify");

const irp = generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = (k: typeof irp) => k.publicKey.export({ type: "spki", format: "pem" }).toString();

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
function token(key = irp, header: Record<string, unknown> = { alg: "RS256", kid: "irp1" }, data = { DocNo: "INV/26/001", SellerGstin: "27ABCDE1234F1Z5" }) {
  const body = `${b64(header)}.${b64({ data: JSON.stringify(data) })}`;
  const s = createSign("RSA-SHA256");
  s.update(body);
  return `${body}.${s.sign(key.privateKey).toString("base64url")}`;
}

const keys = [{ name: "Test IRP", pem: pem(irp), kid: "irp1" }];

describe("e-invoice QR signature", () => {
  it("verifies a token signed by a known IRP", () => {
    expect(verifyIrpJwt(token(), keys)).toEqual({ status: "verified", keyName: "Test IRP" });
  });

  it("verifies even when the token does not name its key", () => {
    expect(verifyIrpJwt(token(irp, { alg: "RS256" }), keys).status).toBe("verified");
  });

  it("fails a tampered payload", () => {
    const [h, , s] = token().split(".");
    const forged = `${h}.${b64({ data: JSON.stringify({ DocNo: "INV/26/999" }) })}.${s}`;
    expect(verifyIrpJwt(forged, keys).status).toBe("failed");
  });

  it("fails a token signed by a key we don't know", () => {
    expect(verifyIrpJwt(token(other), keys).status).toBe("failed");
  });

  it("refuses anything but RS256, and junk", () => {
    expect(verifyIrpJwt(token(irp, { alg: "none" }), keys).status).toBe("malformed");
    expect(verifyIrpJwt("not-a-token", keys).status).toBe("malformed");
  });

  it("says unchecked when no IRP keys are configured", () => {
    expect(verifyIrpJwt(token(), []).status).toBe("unchecked");
  });
});
