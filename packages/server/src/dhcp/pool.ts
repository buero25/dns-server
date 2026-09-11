import { prisma } from '../db/client.js';
import type { DhcpPool } from '@prisma/client';

function ipToInt(ip: string): number {
  const [a, b, c, d] = ip.split('.').map(Number);
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

export function subnetMaskFromCidr(subnet: string): string {
  const [, prefixStr] = subnet.split('/');
  const prefix = Number(prefixStr ?? 24);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return intToIp(mask);
}

/**
 * Picks the next free IP in the pool's range, skipping reserved and
 * currently-leased addresses.
 */
export async function allocateIp(pool: DhcpPool, excludeMac?: string): Promise<string | null> {
  const start = ipToInt(pool.rangeStart);
  const end = ipToInt(pool.rangeEnd);

  const [reservations, leases] = await Promise.all([
    prisma.dhcpReservation.findMany({ where: { poolId: pool.id } }),
    prisma.dhcpLease.findMany({ where: { poolId: pool.id, expiresAt: { gt: new Date() } } }),
  ]);

  const taken = new Set<string>([
    ...reservations.map((r) => r.ip),
    ...leases.filter((l) => l.macAddress !== excludeMac).map((l) => l.ip),
  ]);

  for (let ip = start; ip <= end; ip++) {
    const candidate = intToIp(ip);
    if (!taken.has(candidate)) return candidate;
  }
  return null;
}

export async function findReservation(poolId: string, macAddress: string) {
  return prisma.dhcpReservation.findUnique({
    where: { poolId_macAddress: { poolId, macAddress } },
  });
}
