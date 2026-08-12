/*
  Warnings:

  - You are about to drop the column `roles` on the `Agent` table. All the data in the column will be lost.
  - You are about to drop the column `projectType` on the `Project` table. All the data in the column will be lost.
  - Added the required column `ecosystemId` to the `Organization` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Project_projectType_idx";

-- AlterTable
ALTER TABLE "Agent" DROP COLUMN "roles",
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "ecosystemId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "projectType";

-- DropEnum
DROP TYPE "ProjectType";

-- CreateTable
CREATE TABLE "Ecosystem" (
    "id" TEXT NOT NULL,
    "firebaseProjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ecosystem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ecosystem_firebaseProjectId_key" ON "Ecosystem"("firebaseProjectId");

-- CreateIndex
CREATE INDEX "Ecosystem_firebaseProjectId_idx" ON "Ecosystem"("firebaseProjectId");

-- CreateIndex
CREATE INDEX "Organization_ecosystemId_idx" ON "Organization"("ecosystemId");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ecosystemId_fkey" FOREIGN KEY ("ecosystemId") REFERENCES "Ecosystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
