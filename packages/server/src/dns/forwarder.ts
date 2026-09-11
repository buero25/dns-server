import dgram from 'node:dgram';
import dnsPacket, { type Packet, type Answer } from 'dns-packet';
import { config } from '../config.js';
import { getCached, setCached } from './cache.js';
import { prisma } from '../db/client.js';

async function queryUpstream(
  upstream: string,
  question: Packet['questions']
): Promise<Packet> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const id = Math.floor(Math.random() * 65534) + 1;

    const query = dnsPacket.encode({
      type: 'query',
      id,
      flags: dnsPacket.RECURSION_DESIRED,
      questions: question,
    });

    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error(`Upstream ${upstream} timed out`));
    }, config.dns.forwardTimeoutMs);

    socket.once('message', (msg) => {
      clearTimeout(timeout);
      socket.close();
      try {
        resolve(dnsPacket.decode(msg));
      } catch (err) {
        reject(err);
      }
    });

    socket.once('error', (err) => {
      clearTimeout(timeout);
      socket.close();
      reject(err);
    });

    socket.send(query, 53, upstream);
  });
}

async function getUpstreams(): Promise<string[]> {
  const rows = await prisma.upstream.findMany({ orderBy: { order: 'asc' } });
  if (rows.length === 0) return config.dns.defaultUpstreams;
  return rows.map((r) => r.address);
}

function minTtl(answers: Answer[]): number {
  if (answers.length === 0) return 0;
  return Math.min(...answers.map((a) => ('ttl' in a && a.ttl ? a.ttl : 300)));
}

/**
 * Forwards a query to upstream resolvers, using an in-memory cache keyed by
 * name+type. Tries upstreams in order until one responds.
 */
export async function forwardQuery(
  qname: string,
  qtype: string
): Promise<{ answers: Answer[]; fromCache: boolean }> {
  const cached = getCached(qname, qtype);
  if (cached) {
    return { answers: cached as Answer[], fromCache: true };
  }

  const upstreams = await getUpstreams();
  let lastError: unknown;

  for (const upstream of upstreams) {
    try {
      const response = await queryUpstream(upstream, [{ type: qtype as never, name: qname }]);
      const answers = response.answers ?? [];
      setCached(qname, qtype, answers, minTtl(answers));
      return { answers, fromCache: false };
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw lastError ?? new Error('No upstream DNS servers configured');
}
