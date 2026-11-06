import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { caseDocument } from "@/db/schema";
import { getCurrentUser } from "@/server/session";
import { getOwnedCase } from "@/server/cases/service";
import { signedDocumentUrl } from "@/server/storage";

/** Owner-only: redirects to a 5-minute signed link for a private case document. */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string; id: string }> }) {
  const { code, id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const c = await getOwnedCase(code, user.id);
  if (!c) return new NextResponse("Not found", { status: 404 });
  const [doc] = await db.select().from(caseDocument).where(and(eq(caseDocument.id, id), eq(caseDocument.caseId, c.id)));
  if (!doc) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(await signedDocumentUrl(doc.storagePath));
}
