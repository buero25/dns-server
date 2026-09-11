import { prisma } from '../db/client.js';
import type { Record as DbRecord } from '@prisma/client';

/**
 * Finds the most specific zone that is authoritative for `qname`
 * (exact match or longest matching parent domain).
 */
export async function findAuthoritativeZone(qname: string) {
  const name = qname.toLowerCase().replace(/\.$/, '');
  const parts = name.split('.');

  for (let i = 0; i < parts.length; i++) {
    const candidate = parts.slice(i).join('.');
    const zone = await prisma.zone.findUnique({ where: { name: candidate } });
    if (zone) return zone;
  }
  return null;
}

export async function findRecords(
  zoneId: string,
  qname: string,
  qtype: string
): Promise<DbRecord[]> {
  const name = qname.toLowerCase().replace(/\.$/, '');
  return prisma.record.findMany({
    where: {
      zoneId,
      name,
      ...(qtype === 'ANY' ? {} : { type: qtype as DbRecord['type'] }),
    },
  });
}

export async function resolveCname(zoneId: string, qname: string): Promise<DbRecord | null> {
  const name = qname.toLowerCase().replace(/\.$/, '');
  return prisma.record.findFirst({ where: { zoneId, name, type: 'CNAME' } });
}
