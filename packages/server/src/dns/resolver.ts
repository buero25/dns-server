import type { Answer } from 'dns-packet';
import { findAuthoritativeZone, findRecords, resolveCname } from './records.js';
import { forwardQuery } from './forwarder.js';
import { prisma } from '../db/client.js';

export type QuerySource = 'AUTHORITATIVE' | 'CACHE' | 'FORWARDED' | 'NXDOMAIN';

export interface ResolveResult {
  answers: Answer[];
  source: QuerySource;
  authoritative: boolean;
}

function toAnswer(name: string, type: string, value: string, ttl: number, priority?: number | null): Answer {
  switch (type) {
    case 'A':
      return { type: 'A', name, ttl, data: value };
    case 'AAAA':
      return { type: 'AAAA', name, ttl, data: value };
    case 'CNAME':
      return { type: 'CNAME', name, ttl, data: value };
    case 'NS':
      return { type: 'NS', name, ttl, data: value };
    case 'PTR':
      return { type: 'PTR', name, ttl, data: value };
    case 'TXT':
      return { type: 'TXT', name, ttl, data: value };
    case 'MX':
      return { type: 'MX', name, ttl, data: { preference: priority ?? 10, exchange: value } };
    case 'SRV': {
      const [priorityStr, weightStr, portStr, target] = value.split(' ');
      return {
        type: 'SRV',
        name,
        ttl,
        data: {
          priority: Number(priorityStr ?? priority ?? 0),
          weight: Number(weightStr ?? 0),
          port: Number(portStr ?? 0),
          target: target ?? value,
        },
      };
    }
    default:
      return { type: 'TXT', name, ttl, data: value };
  }
}

/**
 * Resolves a single question: checks for a locally authoritative zone first
 * (following CNAME chains), otherwise forwards to upstream resolvers.
 */
export async function resolveQuestion(qname: string, qtype: string): Promise<ResolveResult> {
  const zone = await findAuthoritativeZone(qname);

  if (zone) {
    const records = await findRecords(zone.id, qname, qtype);

    if (records.length > 0) {
      return {
        answers: records.map((r) => toAnswer(r.name, r.type, r.value, r.ttl, r.priority)),
        source: 'AUTHORITATIVE',
        authoritative: true,
      };
    }

    if (qtype !== 'CNAME') {
      const cname = await resolveCname(zone.id, qname);
      if (cname) {
        return {
          answers: [toAnswer(cname.name, 'CNAME', cname.value, cname.ttl)],
          source: 'AUTHORITATIVE',
          authoritative: true,
        };
      }
    }

    return { answers: [], source: 'NXDOMAIN', authoritative: true };
  }

  const { answers, fromCache } = await forwardQuery(qname, qtype);
  return {
    answers,
    source: fromCache ? 'CACHE' : 'FORWARDED',
    authoritative: false,
  };
}

export async function logQuery(params: {
  queryName: string;
  queryType: string;
  clientIp: string;
  responseCode: string;
  source: QuerySource;
}): Promise<void> {
  try {
    await prisma.queryLog.create({ data: params });
  } catch {
    // Logging must never break DNS resolution.
  }
}
