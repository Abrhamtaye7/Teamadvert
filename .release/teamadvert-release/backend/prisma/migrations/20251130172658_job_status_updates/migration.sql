/*
  Warnings:

  - You are about to drop the column `financeStatus` on the `JobOrder` table. All the data in the column will be lost.
  - You are about to drop the column `locked` on the `JobOrder` table. All the data in the column will be lost.
  - You are about to drop the column `measurements` on the `JobOrder` table. All the data in the column will be lost.
  - You are about to drop the column `productionStatus` on the `JobOrder` table. All the data in the column will be lost.
  - You are about to alter the column `status` on the `JobOrder` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(2))` to `Enum(EnumId(2))`.
  - Added the required column `total` to the `JobItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `JobItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `JobItem` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `total` DECIMAL(14, 2) NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `JobOrder` DROP COLUMN `financeStatus`,
    DROP COLUMN `locked`,
    DROP COLUMN `measurements`,
    DROP COLUMN `productionStatus`,
    ADD COLUMN `customerSnapshot` JSON NULL,
    ADD COLUMN `jobType` VARCHAR(191) NULL,
    MODIFY `priority` VARCHAR(191) NULL DEFAULT 'normal',
    MODIFY `status` ENUM('pending_approval', 'approved', 'in_progress', 'completed', 'finance_review', 'closed') NOT NULL DEFAULT 'pending_approval';
