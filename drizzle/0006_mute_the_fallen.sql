CREATE TABLE `budget_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`budgetId` int NOT NULL,
	`productId` int,
	`description` text NOT NULL,
	`quantity` int NOT NULL,
	`unitPrice` decimal(10,2) NOT NULL,
	`lineTotal` decimal(12,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budget_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`budgetNumber` varchar(50) NOT NULL,
	`budgetDate` date NOT NULL,
	`clientName` text NOT NULL,
	`clientRif` varchar(50),
	`clientAddress` text,
	`clientPhone` varchar(20),
	`clientContact` varchar(100),
	`subtotal` decimal(12,2) DEFAULT '0',
	`applyIVA` boolean DEFAULT true,
	`ivaAmount` decimal(12,2) DEFAULT '0',
	`total` decimal(12,2) DEFAULT '0',
	`observations` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budgets_id` PRIMARY KEY(`id`),
	CONSTRAINT `budgets_budgetNumber_unique` UNIQUE(`budgetNumber`)
);
--> statement-breakpoint
CREATE INDEX `budget_lines_budget_id_idx` ON `budget_lines` (`budgetId`);--> statement-breakpoint
CREATE INDEX `budget_lines_product_id_idx` ON `budget_lines` (`productId`);