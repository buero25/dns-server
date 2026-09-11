import { prisma } from '../db/client.js';
import type { DhcpPool } from '@prisma/client';
import { allocateIp, findReservation } from './pool.js';

/**
 * Resolves the IP to offer/assign for a MAC address: reservation first,
 * then an existing active lease, then a freshly allocated address.
 */
export async function resolveLeaseIp(pool: DhcpPool, macAddress: string): Promise<string | null> {
  const reservation = await findReservation(pool.id, macAddress);
  if (reservation) return reservation.ip;

  const existing = await prisma.dhcpLease.findFirst({
    where: { poolId: pool.id, macAddress, expiresAt: { gt: new Date() } },
  });
  if (existing) return existing.ip;

  return allocateIp(pool, macAddress);
}

export async function commitLease(pool: DhcpPool, macAddress: string, ip: string, hostname?: string) {
  const expiresAt = new Date(Date.now() + pool.leaseSeconds * 1000);
  await prisma.dhcpLease.upsert({
    where: { poolId_ip: { poolId: pool.id, ip } },
    update: { macAddress, hostname, expiresAt },
    create: { poolId: pool.id, macAddress, ip, hostname, expiresAt },
  });
}

export async function releaseLease(macAddress: string, ip: string) {
  await prisma.dhcpLease.deleteMany({ where: { macAddress, ip } });
}

export async function findPoolForInterface(iface?: string): Promise<DhcpPool | null> {
  return prisma.dhcpPool.findFirst({
    where: { enabled: true, ...(iface ? { iface } : {}) },
  });
}
