import { Field, Input } from "@/components/ui/field";
import { Card, SectionTitle } from "@/components/ui/card";

/** File picker shared by every add-document form. Submitted as `file`. */
export function AttachFile({ error, required = false, title }: { error?: string; required?: boolean; title?: string }) {
  return (
    <Card>
      <SectionTitle
        title={title ?? (required ? "File" : "Scan or photo (optional)")}
        description="PDF, PNG or JPEG, up to 3.5 MB. Everyone on the case can open it."
      />
      <Field label={required ? "Choose file" : "Attach a copy"} htmlFor="file" error={error}>
        <Input id="file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" className="py-2.5" aria-invalid={!!error} />
      </Field>
    </Card>
  );
}
