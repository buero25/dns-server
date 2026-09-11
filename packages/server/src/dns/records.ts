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

/**
 * Converts an absolute query name into the zone-relative record name used in
 * storage (e.g. "www.test.local" + zone "test.local" -> "www", and the zone
 * apex itself -> "@").
 */
export function toRelativeName(qname: string, zoneName: string): string {
  const name = qname.toLowerCase().replace(/\.$/, '');
  const zone = zoneName.toLowerCase().replace(/\.$/, '');
  if (name === zone) return '@';
  if (name.endsWith(`.${zone}`)) return name.slice(0, -(zone.length + 1));
  return name;
}

export async function findRecords(
  zoneId: string,
  zoneName: string,
  qname: string,
  qtype: string
): Promise<DbRecord[]> {
  const name = toRelativeName(qname, zoneName);
  return prisma.record.findMany({
    where: {
      zoneId,
      name,
      ...(qtype === 'ANY' ? {} : { type: qtype as DbRecord['type'] }),
    },
  });
}

export async function resolveCname(
  zoneId: string,
  zoneName: string,
  qname: string
): Promise<DbRecord | null> {
  const name = toRelativeName(qname, zoneName);
  return prisma.record.findFirst({ where: { zoneId, name, type: 'CNAME' } });
}
