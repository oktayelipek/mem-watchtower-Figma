CREATE TABLE `deep_metrics` (
	`file_key` text PRIMARY KEY NOT NULL,
	`json_size_mb` real NOT NULL,
	`node_count` integer NOT NULL,
	`estimated_ram_mb` real NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fast_metrics` (
	`file_key` text PRIMARY KEY NOT NULL,
	`page_count` integer NOT NULL,
	`frame_count` integer NOT NULL,
	`component_count` integer NOT NULL,
	`complexity_score` integer NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `files` (
	`key` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`thumbnail_url` text,
	`last_modified` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`team_id` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`files_synced` integer DEFAULT 0,
	`status` text DEFAULT 'running',
	`error` text
);
