import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { caseDocument, caseSubmission } from "@/db/schema";
import { getCurrentUser } from "@/server/session";
import { getCaseForUser } from "@/server/cases/service";
import { signedDocumentUrl } from "@/server/storage";

/** Anyone on the case (owner or accepted member): redirects to a 5-minute signed link for a private case document. */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string; id: string }> }) {
  const { code, id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const c = await getCaseForUser(code, user.id);
  if (!c) return new NextResponse("Not found", { status: 404 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  // Files of a submission its adder took back are no longer served.
  const [doc] = await db
    .select({ storagePath: caseDocument.storagePath })
    .from(caseDocument)
    .innerJoin(caseSubmission, eq(caseSubmission.id, caseDocument.submissionId))
    .where(and(eq(caseDocument.id, id), eq(caseDocument.caseId, c.id), isNull(caseSubmission.removedAt)));
  if (!doc) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(await signedDocumentUrl(doc.storagePath));
}
