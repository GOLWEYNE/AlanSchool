-- CreateTable
CREATE TABLE "NoiseDevice" (
    "classId" INTEGER NOT NULL,
    "deviceId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoiseDevice_pkey" PRIMARY KEY ("classId")
);

-- AddForeignKey
ALTER TABLE "NoiseDevice" ADD CONSTRAINT "NoiseDevice_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
