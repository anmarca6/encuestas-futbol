CREATE TABLE `predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`match_id` text NOT NULL,
	`home_score` integer NOT NULL,
	`away_score` integer NOT NULL,
	`lineup` text,
	`scorers` text DEFAULT '[]' NOT NULL,
	`mvp` text,
	`published_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_predictions_user_match` ON `predictions` (`user_id`,`match_id`);--> statement-breakpoint
CREATE INDEX `idx_predictions_match_published` ON `predictions` (`match_id`,`published_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`nickname` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_nickname` ON `users` (`nickname`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);