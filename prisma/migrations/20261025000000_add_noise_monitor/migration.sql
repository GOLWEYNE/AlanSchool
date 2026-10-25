-- CreateTable
CREATE TABLE "NoiseMinute" (
    "id" SERIAL NOT NULL,
    "classId" INTEGER NOT NULL,
    "minute" TIMESTAMP(3) NOT NULL,
    "seconds" INTEGER NOT NULL,
    "sumDb" DOUBLE PRECISION NOT NULL,
    "maxDb" DOUBLE PRECISION NOT NULL,
    "overSeconds" INTEGER NOT NULL,
    "yellowSeconds" INTEGER NOT NULL,

    CONSTRAINT "NoiseMinute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoiseSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "limitDb" INTEGER NOT NULL DEFAULT 65,
    "yellowMargin" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "NoiseSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoiseMinute_minute_idx" ON "NoiseMinute"("minute");

-- CreateIndex
CREATE UNIQUE INDEX "NoiseMinute_classId_minute_key" ON "NoiseMinute"("classId", "minute");

-- AddForeignKey
ALTER TABLE "NoiseMinute" ADD CONSTRAINT "NoiseMinute_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
