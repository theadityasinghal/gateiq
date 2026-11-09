ALTER TYPE "public"."role" ADD VALUE 'consignee' BEFORE 'cha';--> statement-breakpoint
ALTER TABLE "case" ALTER COLUMN "consignee_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "case" ALTER COLUMN "consignee_address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "case" ALTER COLUMN "consignee_country" DROP NOT NULL;