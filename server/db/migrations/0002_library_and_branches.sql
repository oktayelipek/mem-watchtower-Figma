ALTER TABLE `files` ADD `is_library` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE `branches` (
	`branch_key` text PRIMARY KEY NOT NULL,
	`parent_file_key` text NOT NULL,
	`name` text NOT NULL,
	`estimated_ram_mb` real,
	`fetched_at` integer NOT NULL
);