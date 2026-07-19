-- =============================================================================
-- Migration: add_project_type
-- Agrega enum ProjectType al modelo Project para identificar
-- qué estrategia de módulo aplica a cada proyecto.
-- =============================================================================

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('WELVER', 'MANZANA', 'MEXUS', 'GENERIC');

-- AlterTable
ALTER TABLE "Project"
  ADD COLUMN "projectType" "ProjectType" NOT NULL DEFAULT 'GENERIC';

-- Index para queries por tipo de proyecto
CREATE INDEX "Project_projectType_idx" ON "Project"("projectType");
