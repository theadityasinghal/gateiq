CREATE TABLE "check_ack" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"check_key" text NOT NULL,
	"values_key" text NOT NULL,
	"note" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_submission" ADD COLUMN "supersedes_id" uuid;--> statement-breakpoint
ALTER TABLE "check_ack" ADD CONSTRAINT "check_ack_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ack" ADD CONSTRAINT "check_ack_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "check_ack_case_idx" ON "check_ack" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "case_submission_supersedes_idx" ON "case_submission" USING btree ("supersedes_id");