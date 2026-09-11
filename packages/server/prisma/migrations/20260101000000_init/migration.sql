-- CreateEnum
CREATE TYPE "RecordType" AS ENUM ('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'PTR', 'SRV');

-- CreateEnum
CREATE TYPE "QuerySource" AS ENUM ('AUTHORITATIVE', 'CACHE', 'FORWARDED', 'NXDOMAIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "soaSerial" INTEGER NOT NULL DEFAULT 1,
    "soaRefresh" INTEGER NOT NULL DEFAULT 3600,
    "soaRetry" INTEGER NOT NULL DEFAULT 600,
    "soaExpire" INTEGER NOT NULL DEFAULT 604800,
    "soaMinTtl" INTEGER NOT NULL DEFAULT 300,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Record" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RecordType" NOT NULL,
    "value" TEXT NOT NULL,
    "ttl" INTEGER NOT NULL DEFAULT 3600,
    "priority" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upstream" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 53,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Upstream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DhcpPool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iface" TEXT NOT NULL,
    "subnet" TEXT NOT NULL,
    "rangeStart" TEXT NOT NULL,
    "rangeEnd" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "dnsServers" TEXT[],
    "leaseSeconds" INTEGER NOT NULL DEFAULT 86400,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DhcpPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DhcpReservation" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "macAddress" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "hostname" TEXT,

    CONSTRAINT "DhcpReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DhcpLease" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "macAddress" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "hostname" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DhcpLease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queryName" TEXT NOT NULL,
    "queryType" TEXT NOT NULL,
    "clientIp" TEXT NOT NULL,
    "responseCode" TEXT NOT NULL,
    "source" "QuerySource" NOT NULL,

    CONSTRAINT "QueryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_name_key" ON "Zone"("name");

-- CreateIndex
CREATE INDEX "Record_zoneId_name_type_idx" ON "Record"("zoneId", "name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "DhcpReservation_poolId_macAddress_key" ON "DhcpReservation"("poolId", "macAddress");

-- CreateIndex
CREATE INDEX "DhcpLease_macAddress_idx" ON "DhcpLease"("macAddress");

-- CreateIndex
CREATE UNIQUE INDEX "DhcpLease_poolId_ip_key" ON "DhcpLease"("poolId", "ip");

-- CreateIndex
CREATE INDEX "QueryLog_timestamp_idx" ON "QueryLog"("timestamp");

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpReservation" ADD CONSTRAINT "DhcpReservation_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "DhcpPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpLease" ADD CONSTRAINT "DhcpLease_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "DhcpPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
