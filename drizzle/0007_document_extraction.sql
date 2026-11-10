ALTER TYPE "public"."submission_source" ADD VALUE 'extracted';--> statement-breakpoint
CREATE TABLE "document_extraction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"storage_path" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"qr_text" text,
	"model" text,
	"prompt_version" text NOT NULL,
	"output" jsonb,
	"offered" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_submission" ADD COLUMN "extraction_id" uuid;--> statement-breakpoint
ALTER TABLE "document_extraction" ADD CONSTRAINT "document_extraction_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_extraction" ADD CONSTRAINT "document_extraction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_extraction_case_idx" ON "document_extraction" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "case_submission_extraction_uq" ON "case_submission" USING btree ("extraction_id");