CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"check_in_at" timestamp with time zone,
	"check_out_at" timestamp with time zone,
	"status" varchar(16) DEFAULT 'present' NOT NULL,
	"total_hours" numeric(5, 2),
	"check_in_lat" numeric(9, 6),
	"check_in_lng" numeric(9, 6),
	"check_out_lat" numeric(9, 6),
	"check_out_lng" numeric(9, 6),
	"source" varchar(16) DEFAULT 'web' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_metric_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"metric_key" varchar(64) NOT NULL,
	"entry_date" date NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "department" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"head_member_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"phone_number" varchar(32) NOT NULL,
	"call_type" varchar(16) NOT NULL,
	"duration_sec" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"sim_slot" varchar(16),
	"sim_carrier" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eod_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"report_date" date NOT NULL,
	"summary" text NOT NULL,
	"hours_worked" numeric(5, 2),
	"task_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(16) DEFAULT 'submitted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_definition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"key" varchar(64) NOT NULL,
	"label" varchar(128) NOT NULL,
	"default_daily_target" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "target" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"metric_key" varchar(64) NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"period" varchar(16) DEFAULT 'daily' NOT NULL,
	"effective_from" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"assigned_to_member_id" uuid NOT NULL,
	"assigned_by_member_id" uuid,
	"priority" varchar(16) DEFAULT 'medium' NOT NULL,
	"status" varchar(16) DEFAULT 'todo' NOT NULL,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"metric_totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tasks_completed" integer DEFAULT 0 NOT NULL,
	"eod_submitted" integer DEFAULT 0 NOT NULL,
	"days_present" integer DEFAULT 0 NOT NULL,
	"employee_note" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_member_id_team_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."team_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_metric_entry" ADD CONSTRAINT "daily_metric_entry_member_id_team_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."team_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department" ADD CONSTRAINT "department_head_member_id_team_member_id_fk" FOREIGN KEY ("head_member_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_call" ADD CONSTRAINT "device_call_member_id_team_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."team_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eod_report" ADD CONSTRAINT "eod_report_member_id_team_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."team_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_definition" ADD CONSTRAINT "metric_definition_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target" ADD CONSTRAINT "target_member_id_team_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."team_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assigned_to_member_id_team_member_id_fk" FOREIGN KEY ("assigned_to_member_id") REFERENCES "public"."team_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assigned_by_member_id_team_member_id_fk" FOREIGN KEY ("assigned_by_member_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_report" ADD CONSTRAINT "weekly_report_member_id_team_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."team_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "att_ent_date_idx" ON "attendance" USING btree ("enterprise_id","work_date");--> statement-breakpoint
CREATE INDEX "att_ent_member_idx" ON "attendance" USING btree ("enterprise_id","member_id");--> statement-breakpoint
CREATE INDEX "dme_ent_date_idx" ON "daily_metric_entry" USING btree ("enterprise_id","entry_date");--> statement-breakpoint
CREATE INDEX "dme_ent_member_idx" ON "daily_metric_entry" USING btree ("enterprise_id","member_id");--> statement-breakpoint
CREATE INDEX "dept_ent_idx" ON "department" USING btree ("enterprise_id");--> statement-breakpoint
CREATE INDEX "dept_ent_head_idx" ON "department" USING btree ("enterprise_id","head_member_id");--> statement-breakpoint
CREATE INDEX "dc_ent_member_idx" ON "device_call" USING btree ("enterprise_id","member_id");--> statement-breakpoint
CREATE INDEX "dc_ent_started_idx" ON "device_call" USING btree ("enterprise_id","started_at");--> statement-breakpoint
CREATE INDEX "eod_ent_date_idx" ON "eod_report" USING btree ("enterprise_id","report_date");--> statement-breakpoint
CREATE INDEX "eod_ent_member_idx" ON "eod_report" USING btree ("enterprise_id","member_id");--> statement-breakpoint
CREATE INDEX "metricdef_ent_dept_idx" ON "metric_definition" USING btree ("enterprise_id","department_id");--> statement-breakpoint
CREATE INDEX "target_ent_member_idx" ON "target" USING btree ("enterprise_id","member_id");--> statement-breakpoint
CREATE INDEX "task_ent_assignee_idx" ON "task" USING btree ("enterprise_id","assigned_to_member_id");--> statement-breakpoint
CREATE INDEX "task_ent_status_idx" ON "task" USING btree ("enterprise_id","status");--> statement-breakpoint
CREATE INDEX "task_ent_due_idx" ON "task" USING btree ("enterprise_id","due_date");--> statement-breakpoint
CREATE INDEX "wr_ent_week_idx" ON "weekly_report" USING btree ("enterprise_id","week_start");--> statement-breakpoint
CREATE INDEX "wr_ent_member_idx" ON "weekly_report" USING btree ("enterprise_id","member_id");