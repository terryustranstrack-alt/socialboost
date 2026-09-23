-- AlterTable
ALTER TABLE "post_targets" ADD COLUMN     "commentCount" INTEGER,
ADD COLUMN     "likeCount" INTEGER,
ADD COLUMN     "metricsFetchedAt" TIMESTAMP(3),
ADD COLUMN     "shareCount" INTEGER;
