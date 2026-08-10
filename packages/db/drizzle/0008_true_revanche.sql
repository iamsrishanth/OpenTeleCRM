ALTER TABLE "team_member" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "team_member" ADD COLUMN "manager_id" uuid;--> statement-breakpoint
ALTER TABLE "team_member" ADD COLUMN "join_date" date;--> statement-breakpoint
ALTER TABLE "team_member" ADD COLUMN "employment_status" varchar(16) DEFAULT 'active' NOT NULL;