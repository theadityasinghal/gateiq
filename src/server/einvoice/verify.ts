import "server-only";
import { createPublicKey, createVerify, X509Certificate, type KeyObject } from "node:crypto";
import { IRP_KEYS, type IrpKey } from "./irp-keys";

/**
 * Checks the signature on a GST e-invoice QR code. The QR is a JWT signed (RS256) by the Invoice Registration
 * Portal that issued the IRN, so a valid signature proves an IRP issued this invoice number, date and seller GSTIN.
 * That is the first value in GateIQ that is more than somebody's word.
 *
 * - verified:  a known IRP key verifies the signature.
 * - failed:    keys are loaded but none verifies it (tampered, or an IRP whose key we don't have).
 * - unchecked: no IRP keys are configured yet, so nothing could be checked.
 * - malformed: not a JWT, or not RS256.
 */
export type SignatureStatus = "verified" | "failed" | "unchecked" | "malformed";

type LoadedKey = { name: string; key: KeyObject; ids: string[] };

function load(k: IrpKey): LoadedKey | null {
  try {
    const text = k.pem.trim();
    if (text.includes("BEGIN CERTIFICATE")) {
      const cert = new X509Certificate(text);
      // A JWT names its key with x5t: the base64url SHA-1 thumbprint of the certificate.
      const sha1 = cert.fingerprint.replace(/:/g, "");
      const x5t = Buffer.from(sha1, "hex").toString("base64url");
      return { name: k.name, key: cert.publicKey, ids: [x5t, ...(k.kid ? [k.kid] : [])] };
    }
    return { name: k.name, key: createPublicKey(text), ids: k.kid ? [k.kid] : [] };
  } catch (e) {
    console.error(`IRP key "${k.name}" could not be loaded`, e);
    return null;
  }
}

let cached: LoadedKey[] | null = null;
const defaultKeys = () => (cached ??= IRP_KEYS.map(load).filter((k): k is LoadedKey => k !== null));

export function verifyIrpJwt(jwt: string, keys?: IrpKey[]): { status: SignatureStatus; keyName?: string } {
  const parts = jwt.trim().split(".");
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return { status: "malformed" };
  let header: { alg?: unknown; kid?: unknown; x5t?: unknown };
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    return { status: "malformed" };
  }
  // Only RS256: never let the token pick a weaker algorithm (or "none").
  if (header.alg !== "RS256") return { status: "malformed" };

  const loaded = keys ? keys.map(load).filter((k): k is LoadedKey => k !== null) : defaultKeys();
  if (!loaded.length) return { status: "unchecked" };

  const named = [header.kid, header.x5t].filter((x): x is string => typeof x === "string");
  // Try the key the token names first, then the rest: some IRPs don't name their key.
  const ordered = [...loaded.filter((k) => k.ids.some((id) => named.includes(id))), ...loaded.filter((k) => !k.ids.some((id) => named.includes(id)))];
  const signature = Buffer.from(parts[2], "base64url");
  for (const k of ordered) {
    const v = createVerify("RSA-SHA256");
    v.update(`${parts[0]}.${parts[1]}`);
    if (v.verify(k.key, signature)) return { status: "verified", keyName: k.name };
  }
  return { status: "failed" };
}
