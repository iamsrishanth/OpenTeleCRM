CREATE TABLE "consent_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"contact_jid" varchar(128) NOT NULL,
	"channel" varchar(16) NOT NULL,
	"opted_in" boolean NOT NULL,
	"source" varchar(24) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"wa_session_id" uuid NOT NULL,
	"contact_jid" varchar(128) NOT NULL,
	"contact_name" varchar(255),
	"lead_id" uuid,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_group" boolean DEFAULT false NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"suppressed_for_broadcast" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"wa_message_id" varchar(128),
	"direction" varchar(16) NOT NULL,
	"type" varchar(32) DEFAULT 'text' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"status" varchar(16) DEFAULT 'received' NOT NULL,
	"media_url" text,
	"mime_type" varchar(128),
	"reply_to_id" varchar(128),
	"assigned_user_id" uuid,
	"source" varchar(32) DEFAULT 'whatsapp' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_broadcast" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"template_id" uuid,
	"text" text,
	"agent_session_id" uuid NOT NULL,
	"throttle_per_minute" integer DEFAULT 120 NOT NULL,
	"use_cloud_api" boolean DEFAULT false NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"total_recipients" integer DEFAULT 0 NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"screen_name" varchar(128),
	"status" varchar(32) DEFAULT 'connecting' NOT NULL,
	"qr_code" text,
	"creds" jsonb,
	"auth_version" integer DEFAULT 1,
	"last_paired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"category" varchar(48) DEFAULT 'UTILITY',
	"language_code" varchar(16) DEFAULT 'en',
	"body" text NOT NULL,
	"header" jsonb,
	"footer" text,
	"buttons" jsonb,
	"cloud_template_id" varchar(128),
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wa_message" ADD CONSTRAINT "wa_message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_broadcast" ADD CONSTRAINT "wa_broadcast_template_id_wa_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."wa_template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_ent_idx" ON "consent_ledger" USING btree ("enterprise_id","contact_jid","channel");--> statement-breakpoint
CREATE INDEX "convo_ent_idx" ON "conversation" USING btree ("enterprise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "convo_session_jid_uq" ON "conversation" USING btree ("enterprise_id","wa_session_id","contact_jid");--> statement-breakpoint
CREATE INDEX "convo_lastmsg_idx" ON "conversation" USING btree ("enterprise_id","last_message_at");--> statement-breakpoint
CREATE INDEX "wamsg_ent_idx" ON "wa_message" USING btree ("enterprise_id");--> statement-breakpoint
CREATE INDEX "wamsg_convo_idx" ON "wa_message" USING btree ("enterprise_id","conversation_id","sent_at");--> statement-breakpoint
CREATE INDEX "wabcst_ent_idx" ON "wa_broadcast" USING btree ("enterprise_id");--> statement-breakpoint
CREATE INDEX "wabcst_ent_status_idx" ON "wa_broadcast" USING btree ("enterprise_id","status");--> statement-breakpoint
CREATE INDEX "wasession_ent_idx" ON "wa_session" USING btree ("enterprise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wasession_ent_name_uq" ON "wa_session" USING btree ("enterprise_id","screen_name");--> statement-breakpoint
CREATE INDEX "watmpl_ent_idx" ON "wa_template" USING btree ("enterprise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watmpl_ent_name_uq" ON "wa_template" USING btree ("enterprise_id","name");