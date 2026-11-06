import "server-only";
import { and, asc, desc, eq, inArray, max } from "drizzle-orm";
import { db } from "@/db";
import {
  caseDocument,
  caseGoodsLine,
  filedBaseline,
  filing,
  profile,
  shipmentCase,
} from "@/db/schema";
import { isValidCaseCode, normalizeCaseCode } from "@/lib/case-id";
import type { NormalizedShippingBill } from "@/lib/normalize/shipping-bill";

export async function listCasesForOwner(ownerId: string) {
  return db
    .select({
      id: shipmentCase.id,
      caseCode: shipmentCase.caseCode,
      status: shipmentCase.status,
      consigneeName: shipmentCase.consigneeName,
      destinationCountry: shipmentCase.destinationCountry,
      exportPortCode: shipmentCase.exportPortCode,
      createdAt: shipmentCase.createdAt,
    })
    .from(shipmentCase)
    .where(eq(shipmentCase.ownerId, ownerId))
    .orderBy(desc(shipmentCase.createdAt));
}

/** Holding a code is never enough: the case must also belong to this user. */
export async function getOwnedCase(code: string, ownerId: string) {
  const normalized = normalizeCaseCode(code);
  if (!isValidCaseCode(normalized)) return null;
  const [c] = await db
    .select()
    .from(shipmentCase)
    .where(and(eq(shipmentCase.caseCode, normalized), eq(shipmentCase.ownerId, ownerId)));
  if (!c) return null;
  const [lines, documents] = await Promise.all([
    db.select().from(caseGoodsLine).where(eq(caseGoodsLine.caseId, c.id)).orderBy(asc(caseGoodsLine.lineNo)),
    db.select().from(caseDocument).where(eq(caseDocument.caseId, c.id)).orderBy(asc(caseDocument.createdAt)),
  ]);
  return { ...c, lines, documents };
}

export type OwnedCase = NonNullable<Awaited<ReturnType<typeof getOwnedCase>>>;

/** The shipping-bill filing for a case and its latest baseline version (if any). */
export async function getShippingBillBaseline(caseId: string) {
  const [f] = await db.select().from(filing).where(and(eq(filing.caseId, caseId), eq(filing.kind, "shipping_bill")));
  if (!f) return null;
  const [latest] = await db
    .select()
    .from(filedBaseline)
    .where(eq(filedBaseline.filingId, f.id))
    .orderBy(desc(filedBaseline.version))
    .limit(1);
  const [{ versions }] = await db
    .select({ versions: max(filedBaseline.version) })
    .from(filedBaseline)
    .where(eq(filedBaseline.filingId, f.id));
  return latest
    ? {
        filing: f,
        baseline: { ...latest, normalized: latest.normalized as NormalizedShippingBill },
        versions: versions ?? 1,
      }
    : null;
}

export async function documentsForCases(caseIds: string[]) {
  if (!caseIds.length) return [];
  return db.select().from(caseDocument).where(inArray(caseDocument.caseId, caseIds));
}

/** The consignor's IEC from their profile, for the IEC row in the diff. */
export async function profileIec(userId: string) {
  const [p] = await db.select({ iec: profile.iec }).from(profile).where(eq(profile.userId, userId));
  return p?.iec ?? null;
}
