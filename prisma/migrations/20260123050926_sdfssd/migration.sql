/*
  Warnings:

  - You are about to drop the `nodes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "nodes";

-- CreateTable
CREATE TABLE "nvm_versions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "nvm_versions_pkey" PRIMARY KEY ("id")
);
