/*
  Warnings:

  - You are about to drop the column `addressCity` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `addressHouse` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `addressRegion` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `addressSubcity` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `addressWoreda` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Customer` table. All the data in the column will be lost.
  - You are about to alter the column `validity` on the `Proforma` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to alter the column `bankInfoSnapshot` on the `Proforma` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `status` on the `Proforma` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(2))` to `Enum(EnumId(1))`.
  - You are about to drop the column `vat` on the `ProformaItem` table. All the data in the column will be lost.
  - Made the column `preparedById` on table `Proforma` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `ProformaItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Proforma` DROP FOREIGN KEY `Proforma_preparedById_fkey`;

-- DropIndex
DROP INDEX `idx_customer_phone` ON `Customer`;

-- AlterTable
ALTER TABLE `Customer` DROP COLUMN `addressCity`,
    DROP COLUMN `addressHouse`,
    DROP COLUMN `addressRegion`,
    DROP COLUMN `addressSubcity`,
    DROP COLUMN `addressWoreda`,
    DROP COLUMN `phone`,
    ADD COLUMN `address` JSON NULL,
    ADD COLUMN `phones` JSON NULL;

-- AlterTable
ALTER TABLE `Proforma` ADD COLUMN `customerSnapshot` JSON NULL,
    MODIFY `preparedById` INTEGER NOT NULL,
    MODIFY `validity` INTEGER NULL,
    MODIFY `bankInfoSnapshot` JSON NULL,
    MODIFY `status` ENUM('draft', 'approved', 'converted', 'expired') NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE `ProformaItem` DROP COLUMN `vat`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ADD COLUMN `vatPercent` DECIMAL(5, 2) NULL;

-- AddForeignKey
ALTER TABLE `Proforma` ADD CONSTRAINT `Proforma_preparedById_fkey` FOREIGN KEY (`preparedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
