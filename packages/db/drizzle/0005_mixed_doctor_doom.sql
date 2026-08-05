CREATE TABLE "automation_quota" (
	"enterprise_id" uuid PRIMARY KEY NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 60 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automation_quota" ADD CONSTRAINT "automation_quota_enterprise_id_enterprise_id_fk" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprise"("id") ON DELETE cascade ON UPDATE no action;