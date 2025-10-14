ALTER TABLE "User" ALTER COLUMN "password" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "first_name" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "last_name" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "linkedin" varchar(255);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "company_name" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "role" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "interests" text[] NOT NULL;