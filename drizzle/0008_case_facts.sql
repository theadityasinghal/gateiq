CREATE TYPE "public"."fact_level" AS ENUM('declared', 'source_verified', 'observed');--> statement-breakpoint
CREATE TABLE "case_fact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"fact_key" text NOT NULL,
	"scope" text DEFAULT 'case' NOT NULL,
	"value" jsonb NOT NULL,
	"display" text NOT NULL,
	"level" "fact_level" DEFAULT 'declared' NOT NULL,
	"set_by" text NOT NULL,
	"set_by_role" "role" NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	"superseded_by" uuid
);
--> statement-breakpoint
CREATE TABLE "case_fact_confirmation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fact_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_fact" ADD CONSTRAINT "case_fact_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_fact" ADD CONSTRAINT "case_fact_set_by_user_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_fact_confirmation" ADD CONSTRAINT "case_fact_confirmation_fact_id_case_fact_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."case_fact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_fact_confirmation" ADD CONSTRAINT "case_fact_confirmation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_fact_case_idx" ON "case_fact" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "case_fact_current_uq" ON "case_fact" USING btree ("case_id","fact_key","scope") WHERE "case_fact"."superseded_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "case_fact_confirmation_uq" ON "case_fact_confirmation" USING btree ("fact_id","user_id");