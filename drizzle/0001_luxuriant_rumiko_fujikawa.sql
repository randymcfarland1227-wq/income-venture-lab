CREATE TABLE `investment_account_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`investment_id` text NOT NULL,
	`rule_key` text NOT NULL,
	`rule_year` integer NOT NULL,
	`value` text NOT NULL,
	`unit` text NOT NULL,
	`summary` text NOT NULL,
	`source_name` text NOT NULL,
	`source_url` text NOT NULL,
	`observation_date` text NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `investment_rules_lookup_idx` ON `investment_account_rules` (`investment_id`,`rule_year`);--> statement-breakpoint
CREATE TABLE `investment_experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`sync_id` text NOT NULL,
	`investment_id` text,
	`investment_label` text DEFAULT '' NOT NULL,
	`name` text NOT NULL,
	`mode` text DEFAULT 'Paper' NOT NULL,
	`status` text DEFAULT 'Planned' NOT NULL,
	`hypothesis` text DEFAULT '' NOT NULL,
	`benchmark` text DEFAULT '' NOT NULL,
	`start_date` text,
	`review_date` text,
	`starting_amount` real,
	`recurring_contribution` real,
	`start_price` real,
	`current_price` real,
	`current_value` real,
	`return_dollars` real,
	`return_pct` real,
	`fees` real,
	`distributions` real,
	`notes` text DEFAULT '' NOT NULL,
	`learning` text DEFAULT '' NOT NULL,
	`final_decision` text DEFAULT '' NOT NULL,
	`data_source` text DEFAULT '' NOT NULL,
	`last_refreshed` text,
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
CREATE UNIQUE INDEX `investment_experiments_sync_id_unique` ON `investment_experiments` (`sync_id`);--> statement-breakpoint
CREATE INDEX `investment_experiments_investment_idx` ON `investment_experiments` (`investment_id`);--> statement-breakpoint
CREATE TABLE `investment_live_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`investment_id` text NOT NULL,
	`metric` text NOT NULL,
	`value` real NOT NULL,
	`unit` text NOT NULL,
	`observation_date` text NOT NULL,
	`fetched_at` text NOT NULL,
	`provider` text NOT NULL,
	`source_name` text NOT NULL,
	`source_url` text NOT NULL,
	`methodology` text NOT NULL,
	`is_delayed` integer DEFAULT false NOT NULL,
	`is_stale` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `investment_metrics_lookup_idx` ON `investment_live_metrics` (`investment_id`,`metric`,`observation_date`);--> statement-breakpoint
CREATE INDEX `investment_metrics_fetched_idx` ON `investment_live_metrics` (`fetched_at`);--> statement-breakpoint
CREATE TABLE `investment_options` (
	`id` text PRIMARY KEY NOT NULL,
	`sync_id` text NOT NULL,
	`name` text NOT NULL,
	`classification` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`account_or_asset` text DEFAULT 'Asset' NOT NULL,
	`symbol` text DEFAULT '' NOT NULL,
	`benchmark` text DEFAULT '' NOT NULL,
	`definition` text DEFAULT '' NOT NULL,
	`return_mechanism` text DEFAULT '' NOT NULL,
	`horizon` text DEFAULT '' NOT NULL,
	`liquidity` text DEFAULT '' NOT NULL,
	`income_frequency` text DEFAULT '' NOT NULL,
	`passive_level` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Learn' NOT NULL,
	`personal_interest` real,
	`personal_understanding` real,
	`risk_comfort` real,
	`liquidity_fit` real,
	`long_term_fit` real,
	`research_status` text DEFAULT '' NOT NULL,
	`first_experiment` text DEFAULT '' NOT NULL,
	`minimum_access_notes` text DEFAULT '' NOT NULL,
	`fees_expense_notes` text DEFAULT '' NOT NULL,
	`tax_account_notes` text DEFAULT '' NOT NULL,
	`diversification` text DEFAULT '' NOT NULL,
	`income_generation` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`last_reviewed` text,
	`source_name` text DEFAULT '' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`current_metric` text DEFAULT '' NOT NULL,
	`current_value` real,
	`observation_date` text,
	`data_source` text DEFAULT '' NOT NULL,
	`ytd_pct` real,
	`one_year_pct` real,
	`five_year_annualized_pct` real,
	`risk_profile` text NOT NULL,
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
CREATE UNIQUE INDEX `investment_options_sync_id_unique` ON `investment_options` (`sync_id`);--> statement-breakpoint
CREATE INDEX `investment_options_category_idx` ON `investment_options` (`category`);--> statement-breakpoint
CREATE INDEX `investment_options_status_idx` ON `investment_options` (`status`);--> statement-breakpoint
CREATE TABLE `investment_sources` (
	`provider` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`last_attempt_at` text,
	`last_success_at` text,
	`last_error` text,
	`stale_after_minutes` integer NOT NULL,
	`source_url` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `discovery_findings` ADD `investment_id` text;--> statement-breakpoint
ALTER TABLE `research` ADD `investment_id` text;