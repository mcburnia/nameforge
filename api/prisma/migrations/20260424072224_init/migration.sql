-- CreateEnum
CREATE TYPE "Jurisdiction" AS ENUM ('FR', 'UK', 'EU');

-- CreateEnum
CREATE TYPE "CheckType" AS ENUM ('DOMAIN', 'COMPANY', 'TRADEMARK');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'SIMILAR_FOUND', 'UNKNOWN', 'ERROR');

-- CreateTable
CREATE TABLE "nmf_search_request" (
    "id" TEXT NOT NULL,
    "proposed_name" TEXT NOT NULL,
    "normalised_name" TEXT NOT NULL,
    "jurisdictions" "Jurisdiction"[],
    "checks" "CheckType"[],
    "domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nmf_search_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nmf_search_result" (
    "id" TEXT NOT NULL,
    "search_request_id" TEXT NOT NULL,
    "check_type" "CheckType" NOT NULL,
    "jurisdiction" "Jurisdiction",
    "source" TEXT NOT NULL,
    "status" "ResultStatus" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nmf_search_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nmf_finding" (
    "id" TEXT NOT NULL,
    "search_result_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "matched_name" TEXT,
    "similarity_score" DOUBLE PRECISION,
    "risk_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nmf_finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nmf_evidence_record" (
    "id" TEXT NOT NULL,
    "search_result_id" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "source_url" TEXT,
    "retrieved_at" TIMESTAMP(3) NOT NULL,
    "raw_reference" TEXT,
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nmf_evidence_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nmf_search_request_normalised_name_idx" ON "nmf_search_request"("normalised_name");

-- CreateIndex
CREATE INDEX "nmf_search_result_search_request_id_idx" ON "nmf_search_result"("search_request_id");

-- CreateIndex
CREATE INDEX "nmf_finding_search_result_id_idx" ON "nmf_finding"("search_result_id");

-- CreateIndex
CREATE INDEX "nmf_evidence_record_search_result_id_idx" ON "nmf_evidence_record"("search_result_id");

-- AddForeignKey
ALTER TABLE "nmf_search_result" ADD CONSTRAINT "nmf_search_result_search_request_id_fkey" FOREIGN KEY ("search_request_id") REFERENCES "nmf_search_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nmf_finding" ADD CONSTRAINT "nmf_finding_search_result_id_fkey" FOREIGN KEY ("search_result_id") REFERENCES "nmf_search_result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nmf_evidence_record" ADD CONSTRAINT "nmf_evidence_record_search_result_id_fkey" FOREIGN KEY ("search_result_id") REFERENCES "nmf_search_result"("id") ON DELETE CASCADE ON UPDATE CASCADE;
