CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `validation_assumptions` (
	`id` text PRIMARY KEY NOT NULL,
	`idea_id` text NOT NULL,
	`assumption` text NOT NULL,
	`status` text DEFAULT 'Unknown' NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `barriers` (
	`id` text PRIMARY KEY NOT NULL,
	`idea_id` text NOT NULL,
	`type` text NOT NULL,
	`rating` real,
	`explanation` text DEFAULT '' NOT NULL,
	`mitigation` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `competitors` (
	`id` text PRIMARY KEY NOT NULL,
	`idea_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`target_customer` text DEFAULT '' NOT NULL,
	`pricing` text DEFAULT '' NOT NULL,
	`positioning` text DEFAULT '' NOT NULL,
	`strengths` text DEFAULT '' NOT NULL,
	`weaknesses` text DEFAULT '' NOT NULL,
	`features` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `competitors_idea_idx` ON `competitors` (`idea_id`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`sync_id` text NOT NULL,
	`idea_id` text,
	`idea_label` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`cost_type` text DEFAULT '' NOT NULL,
	`item` text DEFAULT '' NOT NULL,
	`low` real,
	`high` real,
	`actual` real,
	`essential` text DEFAULT '' NOT NULL,
	`due_date` text,
	`notes` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'site' NOT NULL,
	`source_workbook` text,
	`source_sheet` text,
	`source_row` integer,
	`imported_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expenses_sync_id_unique` ON `expenses` (`sync_id`);--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`sync_id` text NOT NULL,
	`idea_id` text,
	`idea_label` text DEFAULT '' NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Planned' NOT NULL,
	`start_date` text,
	`decision_date` text,
	`hypothesis` text DEFAULT '' NOT NULL,
	`test_action` text DEFAULT '' NOT NULL,
	`budget` real,
	`time_budget` real,
	`actual_hours` real,
	`leads` real,
	`replies` real,
	`sales` real,
	`revenue` real,
	`direct_costs` real,
	`sheet_net_cash` real,
	`sheet_net_hourly` real,
	`success_signal` text DEFAULT '' NOT NULL,
	`result` text DEFAULT '' NOT NULL,
	`learning` text DEFAULT '' NOT NULL,
	`final_decision` text DEFAULT '' NOT NULL,
	`assumption_id` text,
	`source` text DEFAULT 'site' NOT NULL,
	`source_workbook` text,
	`source_sheet` text,
	`source_row` integer,
	`imported_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experiments_sync_id_unique` ON `experiments` (`sync_id`);--> statement-breakpoint
CREATE INDEX `experiments_idea_idx` ON `experiments` (`idea_id`);--> statement-breakpoint
CREATE TABLE `financial_assumptions` (
	`idea_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `discovery_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`idea_id` text,
	`scope` text DEFAULT 'Global' NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`confidence` text DEFAULT '' NOT NULL,
	`cites` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `guardrails` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `history` (
	`id` text PRIMARY KEY NOT NULL,
	`idea_id` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`kind` text NOT NULL,
	`summary` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `history_idea_idx` ON `history` (`idea_id`);--> statement-breakpoint
CREATE INDEX `history_at_idx` ON `history` (`at`);--> statement-breakpoint
CREATE TABLE `ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`sync_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`horizon` text NOT NULL,
	`income_style` text NOT NULL,
	`opportunity_type` text DEFAULT 'Other' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Exploring' NOT NULL,
	`stage` text DEFAULT 'Discover' NOT NULL,
	`tier` text DEFAULT '' NOT NULL,
	`sheet_ref` real,
	`personal_fit_angle` text DEFAULT '' NOT NULL,
	`how_it_earns` text DEFAULT '' NOT NULL,
	`income_model` text DEFAULT '' NOT NULL,
	`first_cash_estimate` text DEFAULT '' NOT NULL,
	`weeks_to_first` real,
	`startup_low` real,
	`startup_high` real,
	`monthly_cost` real,
	`weekly_hours` real,
	`monthly_income_low` real,
	`monthly_income_high` real,
	`maintenance_hours` real,
	`speed_score` real,
	`fit_score` real,
	`demand_score` real,
	`scale_score` real,
	`low_cost_score` real,
	`low_risk_score` real,
	`skill_fit` real,
	`interest` real,
	`risk_comfort` real,
	`passive_potential` real,
	`setup_effort` real,
	`ongoing_effort` real,
	`sales_effort` real,
	`complexity` real,
	`overall_effort` real,
	`sheet_short_score` real,
	`sheet_fit_score` real,
	`first_test` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`details` text NOT NULL,
	`source` text DEFAULT 'site' NOT NULL,
	`source_workbook` text,
	`source_sheet` text,
	`source_row` integer,
	`imported_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ideas_sync_id_unique` ON `ideas` (`sync_id`);--> statement-breakpoint
CREATE INDEX `ideas_horizon_idx` ON `ideas` (`horizon`);--> statement-breakpoint
CREATE INDEX `ideas_deleted_idx` ON `ideas` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`sync_id` text NOT NULL,
	`idea_id` text,
	`idea_label` text DEFAULT '' NOT NULL,
	`month` real,
	`title` text DEFAULT '' NOT NULL,
	`stage` text DEFAULT 'Discover' NOT NULL,
	`target_date` text,
	`status` text DEFAULT 'Not Started' NOT NULL,
	`spending_cap` real,
	`time_budget` real,
	`target_income` real,
	`actual_income` real,
	`next_action` text DEFAULT '' NOT NULL,
	`evidence_notes` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'site' NOT NULL,
	`source_workbook` text,
	`source_sheet` text,
	`source_row` integer,
	`imported_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `milestones_sync_id_unique` ON `milestones` (`sync_id`);--> statement-breakpoint
CREATE TABLE `research` (
	`id` text PRIMARY KEY NOT NULL,
	`idea_id` text,
	`area` text DEFAULT 'General' NOT NULL,
	`kind` text DEFAULT 'Note' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`date` text,
	`confidence` text DEFAULT '' NOT NULL,
	`tags` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `research_idea_idx` ON `research` (`idea_id`);--> statement-breakpoint
CREATE TABLE `sprint_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`sync_id` text NOT NULL,
	`idea_id` text,
	`day` text DEFAULT '' NOT NULL,
	`status` text DEFAULT '' NOT NULL,
	`action` text DEFAULT '' NOT NULL,
	`deliverable` text DEFAULT '' NOT NULL,
	`time` text DEFAULT '' NOT NULL,
	`cost_cap` real,
	`success_signal` text DEFAULT '' NOT NULL,
	`result_notes` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'site' NOT NULL,
	`source_workbook` text,
	`source_sheet` text,
	`source_row` integer,
	`imported_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sprint_actions_sync_id_unique` ON `sprint_actions` (`sync_id`);--> statement-breakpoint
CREATE TABLE `sync_baselines` (
	`id` text PRIMARY KEY NOT NULL,
	`tab` text NOT NULL,
	`sync_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`values` text NOT NULL,
	`row` integer,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sync_baselines_entity_idx` ON `sync_baselines` (`entity_id`);--> statement-breakpoint
CREATE TABLE `sync_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`tab` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`sync_id` text NOT NULL,
	`field` text NOT NULL,
	`header` text NOT NULL,
	`label` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`site_value` text DEFAULT '' NOT NULL,
	`sheet_value` text DEFAULT '' NOT NULL,
	`base_value` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Open' NOT NULL,
	`resolution` text,
	`created_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE TABLE `sync_events` (
	`id` text PRIMARY KEY NOT NULL,
	`at` text NOT NULL,
	`direction` text NOT NULL,
	`tab` text DEFAULT '' NOT NULL,
	`entity_type` text DEFAULT '' NOT NULL,
	`sync_id` text DEFAULT '' NOT NULL,
	`action` text NOT NULL,
	`status` text NOT NULL,
	`details` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sync_events_at_idx` ON `sync_events` (`at`);