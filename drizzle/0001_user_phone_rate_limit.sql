CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "phone_country" text;--> statement-breakpoint
-- Existing numbers were validated as Indian mobiles and stored as +91XXXXXXXXXX.
UPDATE "user" SET "phone" = "profile"."phone", "phone_country" = 'IN' FROM "profile" WHERE "profile"."user_id" = "user"."id" AND "profile"."phone" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" DROP COLUMN "phone";