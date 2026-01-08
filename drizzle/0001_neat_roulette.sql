CREATE TABLE `excel_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(255) NOT NULL,
	`rowCount` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `excel_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `search_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`excelFileId` int NOT NULL,
	`searchCode` varchar(50) NOT NULL,
	`resultsJson` text NOT NULL,
	`aiSummary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `search_results_id` PRIMARY KEY(`id`)
);
