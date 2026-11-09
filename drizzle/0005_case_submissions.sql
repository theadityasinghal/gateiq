-- One table for everything people add to a case. Existing filings (latest baseline of each) and uploaded
-- files are carried over as submissions by the consignor who added them; then the old filing tables go.
CREATE TYPE "public"."submission_source" AS ENUM('manual', 'upload', 'ulip');--> statement-breakpoint
CREATE TABLE "case_submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"type" text NOT NULL,
	"added_by" text NOT NULL,
	"added_by_role" "role" NOT NULL,
	"source" "submission_source" NOT NULL,
	"document_number" text,
	"document_date" date,
	"raw" jsonb,
	"raw_sha256" text,
	"normalized" jsonb,
	"provenance" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by" text
);
--> statement-breakpoint
ALTER TABLE "case_submission" ADD CONSTRAINT "case_submission_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_submission" ADD CONSTRAINT "case_submission_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_submission" ADD CONSTRAINT "case_submission_removed_by_user_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_submission_case_type_idx" ON "case_submission" USING btree ("case_id","type");--> statement-breakpoint
CREATE INDEX "case_submission_added_by_idx" ON "case_submission" USING btree ("added_by");--> statement-breakpoint
INSERT INTO "case_submission" ("case_id", "type", "added_by", "added_by_role", "source", "document_number", "document_date", "raw", "raw_sha256", "normalized", "provenance", "created_at")
SELECT f."case_id", f."kind", coalesce(r."received_by", c."owner_id"), 'consignor', f."source"::text::"submission_source",
       f."document_number", f."document_date", r."payload", r."sha256", b."normalized", b."provenance", b."created_at"
FROM (SELECT DISTINCT ON ("filing_id") * FROM "filed_baseline" ORDER BY "filing_id", "version" DESC) b
JOIN "filing" f ON f."id" = b."filing_id"
JOIN "filing_raw_record" r ON r."id" = b."raw_record_id"
JOIN "case" c ON c."id" = f."case_id";--> statement-breakpoint
ALTER TABLE "case_document" ADD COLUMN "submission_id" uuid;--> statement-breakpoint
INSERT INTO "case_submission" ("id", "case_id", "type", "added_by", "added_by_role", "source", "created_at")
SELECT d."id", d."case_id",
       CASE
         WHEN d."kind" = 'msds' THEN 'msds'
         WHEN d."kind" = 'temperature_spec' THEN 'temperature_spec'
         WHEN c."perishable"->>'certificateType' ILIKE '%fumig%' THEN 'fumigation_certificate'
         ELSE 'quality_certificate'
       END,
       d."uploaded_by", 'consignor', 'upload', d."created_at"
FROM "case_document" d
JOIN "case" c ON c."id" = d."case_id";--> statement-breakpoint
UPDATE "case_document" SET "submission_id" = "id";--> statement-breakpoint
ALTER TABLE "case_document" ALTER COLUMN "submission_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "case_document" ADD CONSTRAINT "case_document_submission_id_case_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."case_submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_document_submission_idx" ON "case_document" USING btree ("submission_id");--> statement-breakpoint
ALTER TABLE "case_document" DROP COLUMN "kind";--> statement-breakpoint
DROP TABLE "filed_baseline" CASCADE;--> statement-breakpoint
DROP TABLE "filing_raw_record" CASCADE;--> statement-breakpoint
DROP TABLE "filing" CASCADE;--> statement-breakpoint
DROP TYPE "public"."filing_source";--> statement-breakpoint
UPDATE "case" c SET "status" = CASE
  WHEN EXISTS (SELECT 1 FROM "case_submission" s WHERE s."case_id" = c."id" AND s."type" = 'shipping_bill' AND s."removed_at" IS NULL)
  THEN 'filed_baseline_ready'::"case_status" ELSE 'filing_pending'::"case_status" END;
