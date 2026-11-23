ALTER TABLE "case_fact" ADD COLUMN "replace_reason" text;--> statement-breakpoint
ALTER TABLE "check_ack" ADD COLUMN "self" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "document_extraction" ADD COLUMN "qr_signature" text;--> statement-breakpoint
ALTER TABLE "document_extraction" ADD COLUMN "qr_signed_values" jsonb;