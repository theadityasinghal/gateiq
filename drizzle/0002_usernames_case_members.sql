CREATE TYPE "public"."case_member_status" AS ENUM('pending', 'accepted');--> statement-breakpoint
CREATE TABLE "case_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"invited_by" text NOT NULL,
	"role" "role" NOT NULL,
	"status" "case_member_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "case_member" ADD CONSTRAINT "case_member_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_member" ADD CONSTRAINT "case_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_member" ADD CONSTRAINT "case_member_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "case_member_case_user_uq" ON "case_member" USING btree ("case_id","user_id");--> statement-breakpoint
CREATE INDEX "case_member_user_status_idx" ON "case_member" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "case_member_invited_by_idx" ON "case_member" USING btree ("invited_by");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE("username");