/**
 * Checks the generated files the way the app will meet them: `npm run mocks:verify` (after mocks:generate).
 *  - every QR code is decoded from the final file with jsQR (the library the browser uses) and read by parseQr;
 *  - PDFs are rasterised with macOS Quick Look (skipped with a note elsewhere) and decoded the same way;
 *  - GSTIN, IEC and container numbers are re-validated with the repo's validators;
 *  - sizes are within the 3.5 MB upload limit (except the deliberately oversized file) and PDFs are one page.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import jsQR from "jsqr";
import sharp from "sharp";
import { isValidContainerNo } from "@/lib/iso6346";
import { parseQr } from "@/lib/qr/parse";
import { verifyGstin, verifyIec } from "@/lib/verify/identifiers";
import { A, B, C, withBadCheckDigit, type Ship } from "./shipments";

const OUT = join(process.cwd(), "mock_assets");
const MAX = 3.5 * 1024 * 1024;
let failures = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};

async function decode(png: string): Promise<string | null> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

async function main() {
  if (!existsSync(OUT)) throw new Error("mock_assets/ not found. Run `npm run mocks:generate` first.");
  const files = walk(OUT).filter((f) => !f.endsWith("README.md"));

  // Identifiers.
  for (const s of [A, B, C]) {
    ok(verifyGstin(s.exporter.gstin).level === "format_valid", `${s.id}: exporter GSTIN ${s.exporter.gstin}`);
    ok(verifyGstin(s.transporter.gstin).level === "format_valid", `${s.id}: transporter GSTIN ${s.transporter.gstin}`);
    ok(verifyIec(s.exporter.iec, s.exporter.gstin).level === "format_valid", `${s.id}: IEC ${s.exporter.iec} matches the GSTIN's PAN`);
    for (const b of s.boxes) ok(isValidContainerNo(b.no), `${s.id}: container ${b.no} passes ISO 6346`);
  }

  // Sizes and pages.
  for (const f of files) {
    const rel = f.slice(OUT.length + 1);
    const size = statSync(f).size;
    if (rel.includes("oversized")) ok(size > MAX, `${rel} is over 3.5 MB (${(size / 1048576).toFixed(1)} MB) as intended`);
    else ok(size <= MAX, `${rel} is within 3.5 MB (${(size / 1024).toFixed(0)} KB)`);
    if (f.endsWith(".pdf")) {
      const pages = (readFileSync(f).toString("latin1").match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;
      ok(pages === 1, `${rel} is one page`);
    }
  }

  // Form-values files: present, complete for their scenario, and planted marks only where intended.
  const spaced = (no: string) => `${no.slice(0, 4)} ${no.slice(4, 10)} ${no.slice(10)}`;
  const fvFile = (folder: string, letter: string) => {
    const path = join(OUT, folder, `${letter}_FORM_VALUES.txt`);
    ok(existsSync(path), `${folder}/${letter}_FORM_VALUES.txt exists`);
    return existsSync(path) ? readFileSync(path, "utf8") : "";
  };
  for (const [s, plantedCount] of [[A, 0], [B, 9], [C, 0]] as Array<[Ship, number]>) {
    const text = fvFile(s.folder, s.id);
    const docs = readdirSync(join(OUT, s.folder)).filter((f) => f.endsWith(".pdf"));
    for (const d of docs) ok(text.includes(d), `${s.id}_FORM_VALUES lists ${d}`);
    ok((text.match(/^STEP \d+\./gm) ?? []).length === docs.length + 2, `${s.id}_FORM_VALUES has a step for the case, the invitations and each of ${docs.length} documents`);
    const needles: Array<[string, string]> = [
      ["origin", s.originPlace], ["port", s.portCode], ["SB number", s.sb.no], ["invoice number", s.invoice.no], ["e-way bill number", s.ewb.no],
      ["LR number", s.lr.no], ["booking", s.booking], ["exporter GSTIN", s.exporter.gstin], ["exporter IEC", s.exporter.iec], ["consignee", s.consignee.name],
      ...s.lines.map((l, i): [string, string] => [`HS code line ${i + 1}`, l.hsCode]),
      ...s.boxes.flatMap((b): Array<[string, string]> => [[`container ${b.no}`, spaced(b.no)], [`e-seal ${b.eSeal}`, b.eSeal]]),
    ];
    for (const [what, needle] of needles) ok(text.includes(needle), `${s.id}_FORM_VALUES contains ${what} (${needle})`);
    if (s.id === "B") ok(text.includes(spaced(withBadCheckDigit(s.boxes[0].no))), "B_FORM_VALUES shows the mistyped container number from the packing list");
    ok((text.match(/ {3}<- planted: /g) ?? []).length === plantedCount, `${s.id}_FORM_VALUES has ${plantedCount} planted marks`);
  }
  const dText = fvFile("D_junk-and-photos", "D");
  for (const prefix of ["D3_", "D4_", "D6_", "D7_"]) {
    const f = readdirSync(join(OUT, "D_junk-and-photos")).find((x) => x.startsWith(prefix));
    ok(!!f && dText.includes(f), `D_FORM_VALUES lists ${f}`);
  }

  // QR codes, from the final files.
  const tmp = mkdtempSync(join(tmpdir(), "gateiq-verify-"));
  try {
    const qrFiles: Array<{ rel: string; kind: "e_invoice" | "eway_bill"; png?: string }> = [
      { rel: "D_junk-and-photos/D6_qr-only-e-invoice.png", kind: "e_invoice" },
      { rel: "D_junk-and-photos/D7_qr-only-eway-bill.png", kind: "eway_bill" },
      { rel: "D_junk-and-photos/D4_desk-photo-invoice-with-qr.jpg", kind: "e_invoice" },
      { rel: "A_clean/A2_commercial-invoice.pdf", kind: "e_invoice" },
      { rel: "A_clean/A4_e-way-bill.pdf", kind: "eway_bill" },
      { rel: "C_two-containers-hazmat/C2_commercial-invoice.pdf", kind: "e_invoice" },
      { rel: "C_two-containers-hazmat/C4_e-way-bill.pdf", kind: "eway_bill" },
    ];
    for (const q of qrFiles) {
      const path = join(OUT, q.rel);
      let image = path;
      if (q.rel.endsWith(".pdf")) {
        if (process.platform !== "darwin") {
          console.log(`SKIP  ${q.rel} (PDF rasterising uses macOS Quick Look)`);
          continue;
        }
        // Quick Look draws the first page from the vector data; 2400 px wide is about the app's 3.5x render.
        execFileSync("qlmanage", ["-t", "-s", "2400", "-o", tmp, path], { stdio: "pipe" });
        image = join(tmp, `${q.rel.split("/").pop()}.png`);
      }
      const text = await decode(image);
      const parsed = text ? parseQr(text) : null;
      ok(!!parsed && parsed.kind === q.kind, `${q.rel}: QR decoded and read as ${q.kind}${parsed ? ` (${JSON.stringify(parsed.values).slice(0, 110)})` : ""}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
