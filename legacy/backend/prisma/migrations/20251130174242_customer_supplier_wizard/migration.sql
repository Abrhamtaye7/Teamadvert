/*
  Warnings:

  - You are about to drop the column `phone` on the `Supplier` table. All the data in the column will be lost.
  - You are about to alter the column `address` on the `Supplier` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.

*/
-- AlterTable
ALTER TABLE `Supplier` DROP COLUMN `phone`,
    ADD COLUMN `phones` JSON NULL,
    MODIFY `address` JSON NULL;

-- CreateTable
CREATE TABLE `SupplierNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `supplierId` INTEGER NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SupplierNote` ADD CONSTRAINT `SupplierNote_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierNote` ADD CONSTRAINT `SupplierNote_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
