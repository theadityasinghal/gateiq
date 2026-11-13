"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, TriangleAlert } from "lucide-react";
import { deleteCase } from "@/server/cases/actions";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";

/**
 * Deleting a case. You leave for the dashboard at once; if the server refuses, you are brought back to the
 * case with a message. Only the owner sees this.
 */
export function DeleteCaseCard({ caseCode }: { caseCode: string }) {
  const [typed, setTyped] = useState("");
  const router = useRouter();
  const toast = useToast();
  const ready = typed.trim().toUpperCase() === caseCode;

  async function onDelete() {
    router.push("/dashboard");
    const r = await deleteCase(caseCode, typed).catch(() => ({ ok: false as const, error: "Something went wrong." }));
    if (!r.ok) {
      toast.error(`Case ${caseCode} was not deleted. ${r.error}`);
      router.push(`/cases/${caseCode}`);
      return;
    }
    toast.success(`Case ${caseCode} deleted.`);
    router.refresh();
  }

  return (
    <Card className="space-y-4 border-error/40">
      <div>
        <h2 className="flex items-center gap-2 text-h5 text-error"><Trash2 size={20} strokeWidth={1.8} aria-hidden="true" />Delete this case</h2>
        <p className="text-body-sm text-slate">Removes the case, every document and file on it, the verified values and notes, and everyone&apos;s access. This can&apos;t be undone.</p>
      </div>
      <details>
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[14px] font-medium text-error">
          <TriangleAlert size={16} strokeWidth={1.8} aria-hidden="true" />
          I want to delete this case
        </summary>
        <div className="mt-4 space-y-3">
          <Field label={`Type the Case ID (${caseCode}) to confirm`} htmlFor="confirm-case">
            <Input id="confirm-case" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} className="font-mono" />
          </Field>
          <Button type="button" onClick={onDelete} disabled={!ready} className="!bg-error !text-on-primary disabled:!bg-hairline disabled:!text-muted">Delete case</Button>
        </div>
      </details>
    </Card>
  );
}
